# Deployment Guide

Complete deployment instructions for TheRxSpot Medusa.js Telehealth Marketplace.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [Local Development Setup](#local-development-setup)
- [Production Deployment](#production-deployment)
- [Docker Deployment](#docker-deployment)
- [Database Migrations](#database-migrations)
- [Health Checks](#health-checks)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| Node.js | 20.x LTS | 20.x LTS |
| PostgreSQL | 14.x | 15.x |
| Redis | 6.x | 7.x |
| Memory | 4 GB | 8 GB |
| Disk | 20 GB SSD | 50 GB SSD |

### External Services

- **Domain Name** (for production; wildcard `*.therxspot.com` recommended)
- **Render** (backend + managed Postgres + Redis) or equivalent hosting
- **Vercel** (storefront) or equivalent hosting
- **SendGrid** (optional, for email fallback on dispatch failures)
- **S3-compatible storage** (optional, for documents/uploads if enabled)

---

## Environment Variables

Create a `.env` file in the project root:

```bash
# =============================================================================
# Core Configuration
# =============================================================================

NODE_ENV=production
PORT=9000

# =============================================================================
# Database Configuration
# =============================================================================

# Primary database connection
DATABASE_URL=postgresql://user:password@host:5432/therxspot

# Connection pool settings
DATABASE_POOL_MIN=5
DATABASE_POOL_MAX=20
DATABASE_TIMEOUT=60000

# =============================================================================
# Redis Configuration
# =============================================================================

REDIS_URL=redis://localhost:6379

# Redis for caching (optional - defaults to REDIS_URL)
REDIS_CACHE_URL=redis://localhost:6379/1

# Redis for job queue (optional - defaults to REDIS_URL)
REDIS_JOB_URL=redis://localhost:6379/2

# =============================================================================
# Security + CORS Configuration
# =============================================================================

# JWT Secret (generate with: openssl rand -hex 64)
# Must be at least 64 characters (see src/utils/env-validator.ts)
JWT_SECRET=your_super_secret_jwt_key_at_least_128_characters_long_here...

# Cookie Secret (generate with: openssl rand -hex 64)
COOKIE_SECRET=your_super_secret_cookie_key_at_least_128_characters_long...

# CORS settings (comma-separated lists are allowed)
STORE_CORS=https://*.therxspot.com
ADMIN_CORS=https://admin.therxspot.com
AUTH_CORS=https://*.therxspot.com

# Optional: admin UI backlink
MEDUSA_BACKEND_URL=https://api.therxspot.com

# =============================================================================
# Multi-tenant hostnames
# =============================================================================

# Exact-match only; do NOT suffix-match.
# Examples: api/admin/root domains and localhost entries.
PLATFORM_HOSTNAMES=therxspot.com,api.therxspot.com,admin.therxspot.com,localhost,127.0.0.1

# Used for auto-provisioning default tenant domains via Hub provisioning.
TENANT_PLATFORM_BASE_DOMAIN=therxspot.com

# =============================================================================
# Hub provisioning bridge (PHP Hub → Marketplace)
# =============================================================================

# Shared secret used to sign POST /admin/hub/provision requests.
HUB_PROVISIONING_SECRET=replace_me_with_a_long_random_secret

# =============================================================================
# PHI encryption (recommended in production)
# =============================================================================

# Enable field-level encryption for selected PHI/PII values at rest.
PHI_ENCRYPTION_ENABLED=true

# 32-byte key (hex or base64). Required when PHI_ENCRYPTION_ENABLED=true.
ENCRYPTION_KEY_CURRENT=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

# Optional key rotation list (JSON array or comma-separated)
# ENCRYPTION_KEY_OLD=["...","..."]

# =============================================================================
# Document Storage Configuration (AWS S3)
# =============================================================================

# Storage provider: s3, gcs, azure, or local
DOCUMENT_STORAGE_PROVIDER=s3

# AWS Credentials
DOCUMENT_STORAGE_ACCESS_KEY=AKIA...
DOCUMENT_STORAGE_SECRET_KEY=...
DOCUMENT_STORAGE_BUCKET=therxspot-documents
DOCUMENT_STORAGE_REGION=us-east-1

# Optional: Custom S3 endpoint (for MinIO)
# DOCUMENT_STORAGE_ENDPOINT=https://minio.yourdomain.com
# DOCUMENT_STORAGE_FORCE_PATH_STYLE=true

# =============================================================================
# Email Configuration (SendGrid)
# =============================================================================

SENDGRID_API_KEY=SG.xxx...
FROM_EMAIL=noreply@therxspot.com
FROM_NAME="TheRxSpot"

# =============================================================================
# Fulfillment dispatch (Outbox → webhook + email fallback)
# =============================================================================

# Default partner endpoint (can be overridden per-business via business.settings.fulfillment_webhook_url)
DEFAULT_FULFILLMENT_WEBHOOK_URL=https://partner.example.com/webhooks/rxspot

# Optional signing secret for webhook requests
OUTBOX_SIGNING_SECRET=replace_me_with_a_long_random_secret

# Email fallback recipient (can be overridden per-business via business.settings.fulfillment_email / ops_email)
DEFAULT_FULFILLMENT_EMAIL=ops@therxspot.com

# Optional: secret for partner → RxSpot status callbacks (POST /webhooks/partner/status)
PARTNER_STATUS_WEBHOOK_SECRET=replace_me_with_a_long_random_secret

# =============================================================================
# Logging Configuration
# =============================================================================

# Log level: error, warn, info, debug, silly
LOG_LEVEL=info

# Audit log retention (days) - HIPAA requires 7 years = 2555 days
AUDIT_LOG_RETENTION_DAYS=2555

# =============================================================================
# Feature Flags
# =============================================================================

# Enable/disable features
ENABLE_CONSULT_GATING=true
ENABLE_AUTO_PAYOUTS=true
ENABLE_DOMAIN_VERIFICATION=true

# Checkout is intentionally out-of-scope for MVP.
CHECKOUT_ENABLED=false

# =============================================================================
# Performance Tuning
# =============================================================================

# Worker concurrency
WORKER_CONCURRENCY=4

# Job timeout (ms)
JOB_TIMEOUT=300000
```

### Generating Secure Secrets

```bash
# Generate JWT Secret (128+ characters)
openssl rand -hex 64

# Generate Cookie Secret
openssl rand -hex 64

# Generate Database Password
openssl rand -base64 32
```

---

## Local Development Setup

### 1. Clone Repository

```bash
git clone https://github.com/your-org/therxspot.git
cd therxspot
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Setup Environment

```bash
# Copy environment template
cp .env.template .env

# Edit .env with your values
nano .env
```

### 4. Setup Database

```bash
# Create database (if using local PostgreSQL)
createdb therxspot

# Run migrations
npx medusa db:migrate

# Seed data (optional)
npm run seed
```

### 5. Start Development Server

```bash
npm run dev
```

The server will be available at `http://localhost:9000`

---

## Production Deployment

### Target deployment shape (MVP)

- Storefront: Vercel (`TheRxSpot_Marketplace-storefront/`)
- Backend: Render (Docker + managed Postgres + Redis recommended)
- Domain routing: wildcard `*.therxspot.com` → Vercel; platform hostnames (e.g. `api.therxspot.com`) → backend
- Vercel rewrite: `TheRxSpot_Marketplace-storefront/vercel.json` rewrites `/api/*` → `https://api.therxspot.com/*`

### 1. Prepare Server

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt-get install -y postgresql postgresql-contrib

# Install Redis
sudo apt-get install -y redis-server

# Install PM2 for process management
sudo npm install -g pm2
```

### 2. Configure PostgreSQL

```bash
# Switch to postgres user
sudo -u postgres psql

# Create database and user
CREATE DATABASE therxspot;
CREATE USER therxspot_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE therxspot TO therxspot_user;

# Exit
\q
```

### 3. Configure Redis

```bash
# Edit Redis configuration
sudo nano /etc/redis/redis.conf

# Set memory limit
maxmemory 256mb
maxmemory-policy allkeys-lru

# Enable persistence (optional)
save 900 1
save 300 10
save 60 10000

# Restart Redis
sudo systemctl restart redis
```

### 4. Deploy Application

```bash
# Create app directory
mkdir -p /var/www/therxspot
cd /var/www/therxspot

# Clone repository
git clone https://github.com/your-org/therxspot.git .

# Install production dependencies
npm ci --production

# Build application
npm run build

# Setup environment
nano .env

# Run migrations
npx medusa db:migrate

# Start with PM2
pm2 start medusa-config.ts --name therxspot

# Save PM2 config
pm2 save
pm2 startup
```

### 5. Configure Nginx (Reverse Proxy)

```bash
# Install Nginx
sudo apt-get install -y nginx

# Create Nginx config
sudo nano /etc/nginx/sites-available/therxspot
```

```nginx
server {
    listen 80;
    server_name api.therxspot.com;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req zone=api burst=20 nodelay;

    location / {
        proxy_pass http://localhost:9000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Health check endpoint (no rate limiting)
    location /health {
        proxy_pass http://localhost:9000/health;
        access_log off;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/therxspot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 6. Setup SSL (Let's Encrypt)

```bash
# Install Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d api.therxspot.com

# Auto-renewal is configured automatically
```

---

## Docker Deployment

### Using Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "9000:9000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/therxspot
      - REDIS_URL=redis://redis:6379
    env_file:
      - .env
    depends_on:
      - db
      - redis
    networks:
      - therxspot-network
    restart: unless-stopped

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=therxspot
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - therxspot-network
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    networks:
      - therxspot-network
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - app
    networks:
      - therxspot-network
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:

networks:
  therxspot-network:
    driver: bridge
```

Create `Dockerfile`:

```dockerfile
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Build
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/medusa-config.ts ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S medusa -u 1001

# Change ownership
RUN chown -R medusa:nodejs /app
USER medusa

EXPOSE 9000

CMD ["npm", "start"]
```

Deploy:

```bash
# Build and start
docker-compose up -d

# Run migrations
docker-compose exec app npx medusa db:migrate

# View logs
docker-compose logs -f app
```

---

## Database Migrations

### Running Migrations

```bash
# Development
npx medusa db:migrate

# Production
NODE_ENV=production npx medusa db:migrate

# Docker
docker-compose exec app npx medusa db:migrate
```

### Creating Migrations

```bash
# Generate migration from model changes
npx medusa db:generate

# Create empty migration
npx medusa db:create
```

### Rollback (if needed)

```bash
# Rollback last migration
npx medusa db:rollback

# Rollback specific number
npx medusa db:rollback --count 3
```

---

## Health Checks

### Health Check Endpoint

```bash
# Basic health check
curl https://api.therxspot.com/health

# Expected response:
{
  "status": "ok",
  "timestamp": "2026-02-03T12:00:00.000Z",
  "services": {
    "database": "connected",
    "redis": "connected"
  }
}
```

### PM2 Health Monitoring

```bash
# Monitor application
pm2 monit

# View logs
pm2 logs therxspot

# Restart application
pm2 restart therxspot
```

### Database Health Check

```bash
# Check PostgreSQL
sudo -u postgres pg_isready

# Check Redis
redis-cli ping
```

---

## Monitoring Setup

### Application Metrics

```bash
# Install PM2 monitoring
pm2 install pm2-logrotate
pm2 install pm2-server-monit
```

### Database Monitoring

```bash
# Enable PostgreSQL statistics
sudo -u postgres psql -c "CREATE EXTENSION IF NOT EXISTS pg_stat_statements;"
```

### Log Aggregation

```bash
# Example: Configure Filebeat for ELK stack
sudo nano /etc/filebeat/filebeat.yml
```

```yaml
filebeat.inputs:
- type: log
  enabled: true
  paths:
    - /var/www/therxspot/logs/*.log
  fields:
    service: therxspot

output.elasticsearch:
  hosts: ["localhost:9200"]
```

---

## Backup and Recovery

### Database Backup

```bash
# Automated backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump therxspot | gzip > /backups/therxspot_$DATE.sql.gz

# Keep only last 30 days
find /backups -name "therxspot_*.sql.gz" -mtime +30 -delete
```

### Document Backup

```bash
# Sync S3 bucket
aws s3 sync s3://therxspot-documents s3://therxspot-documents-backup
```

### Recovery

```bash
# Restore database
gunzip < /backups/therxspot_20260203_120000.sql.gz | psql therxspot
```

---

## Troubleshooting

### Common Issues

#### Database Connection Errors

```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check connection
psql $DATABASE_URL -c "SELECT 1;"

# Check logs
sudo tail -f /var/log/postgresql/postgresql-15-main.log
```

#### Redis Connection Errors

```bash
# Check Redis status
sudo systemctl status redis

# Test connection
redis-cli ping

# Check logs
sudo tail -f /var/log/redis/redis-server.log
```

#### Application Won't Start

```bash
# Check logs
pm2 logs therxspot

# Verify environment variables
pm2 env therxspot

# Check for missing migrations
npx medusa db:migrate
```

#### High Memory Usage

```bash
# Check memory usage
pm2 monit

# Restart with more memory
pm2 restart therxspot --max-memory-restart 1G
```

#### Slow Queries

```bash
# Enable query logging in PostgreSQL
sudo -u postgres psql -c "ALTER SYSTEM SET log_min_duration_statement = 1000;"
sudo systemctl restart postgresql
```

### Debug Mode

```bash
# Enable debug logging
DEBUG=* npm start

# Or specific modules
DEBUG=medusa:* npm start
```

---

## Scaling

### Horizontal Scaling

```yaml
# docker-compose.scale.yml
version: '3.8'

services:
  app:
    deploy:
      replicas: 3
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://...
      - REDIS_URL=redis://...
```

```bash
# Scale application
docker-compose -f docker-compose.scale.yml up -d --scale app=3
```

### Database Scaling

- Use PostgreSQL read replicas for query scaling
- Implement connection pooling with PgBouncer
- Consider sharding for multi-tenant data

---

## Security Checklist

- [ ] Secrets stored securely (not in code)
- [ ] Database credentials rotated regularly
- [ ] SSL/TLS enabled for all connections
- [ ] Security headers configured
- [ ] Rate limiting enabled
- [ ] Input validation on all endpoints
- [ ] Audit logging enabled
- [ ] PII encrypted at rest
- [ ] Access controls tested
- [ ] Dependencies updated regularly

---

## Support

For deployment support:
- Documentation: https://docs.therxspot.com
- Issues: https://github.com/your-org/therxspot/issues
- Email: support@therxspot.com
