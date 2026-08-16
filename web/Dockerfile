# ---------- Builder ----------
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---------- Runner (nginx) ----------
FROM nginx:alpine AS runner

# Copy built SPA
COPY --from=builder /app/dist /usr/share/nginx/html

# Nginx config with API proxy + SPA fallback
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]