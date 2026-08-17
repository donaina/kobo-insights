# ---------- Builder ----------
FROM node:20-alpine AS builder
WORKDIR /app

# Install build deps
RUN apk add --no-cache python3 make g++

# Copy package files & install
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# Copy source & build
COPY . .
RUN npm run build

# ---------- Runner ----------
FROM node:20-alpine AS runner
WORKDIR /app

# Install OpenSSL 1.1 compat for Prisma query engine
RUN apk add --no-cache openssl1.1-compat

# Non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001 -G nodejs

# Copy built assets + prisma + node_modules
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma

# Data directory for SQLite (mounted as volume)
RUN mkdir -p /data && chown nestjs:nodejs /data

USER nestjs

EXPOSE 3001

# Run migrations then start (same pattern as NIP sim)
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]