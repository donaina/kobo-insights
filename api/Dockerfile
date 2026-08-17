# ---------- Builder ----------
FROM node:20-slim AS builder
WORKDIR /app

# Install build deps
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*

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
FROM node:20-slim AS runner
WORKDIR /app

# Non-root user
RUN addgroup --gid 1001 --system nodejs && adduser --uid 1001 --system --ingroup nodejs nestjs

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