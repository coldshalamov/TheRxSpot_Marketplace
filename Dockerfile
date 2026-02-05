# ==========================================
# TheRxSpot Marketplace - Production Dockerfile
# Multi-stage build for optimized production image
# ==========================================

# ------------------------------------------
# Stage 1: Builder
# ------------------------------------------
FROM node:20-alpine AS builder

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

# Set working directory
WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./
COPY .yarnrc.yml ./

# Install all dependencies (including devDependencies for build)
RUN npm ci && npm cache clean --force

# Copy source code
COPY . .

# Build the application
RUN npm run build

# ------------------------------------------
# Stage 2: Production
# ------------------------------------------
FROM node:20-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init curl

# Create non-root user and group
RUN addgroup -g 1001 -S nodejs && \
    adduser -S medusa -u 1001 -G nodejs

# Set working directory
WORKDIR /app

# Copy only production artifacts from builder
COPY --from=builder --chown=medusa:nodejs /app/.medusa ./.medusa
COPY --from=builder --chown=medusa:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=medusa:nodejs /app/package*.json ./
COPY --from=builder --chown=medusa:nodejs /app/medusa-config.ts ./

# Create uploads directory for document storage
RUN mkdir -p uploads && chown -R medusa:nodejs uploads

# Switch to non-root user
USER medusa

# Expose the application port
EXPOSE 9000

# Health check configuration
HEALTHCHECK --interval=30s \
            --timeout=10s \
            --start-period=60s \
            --retries=3 \
            CMD curl -f http://localhost:9000/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["npm", "start"]
