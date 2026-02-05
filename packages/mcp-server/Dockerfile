# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files from monorepo root and package
COPY package*.json ./
COPY packages/mcp-server/package*.json ./packages/mcp-server/

# Install dependencies
RUN npm ci

# Copy source code
COPY packages/mcp-server/src ./packages/mcp-server/src
COPY packages/mcp-server/tsconfig.json ./packages/mcp-server/

# Build the application
RUN npm run build --workspace=packages/mcp-server

# Stage 2: Runtime
FROM node:20-alpine

WORKDIR /app

# Create data directory
RUN mkdir -p /data

# Copy package files
COPY package*.json ./
COPY packages/mcp-server/package*.json ./packages/mcp-server/

# Install production dependencies
RUN npm ci --production

# Copy built files
COPY --from=builder /app/packages/mcp-server/dist ./packages/mcp-server/dist

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Environment
ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/data

# Run
CMD ["node", "packages/mcp-server/dist/index.js"]
