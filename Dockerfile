# Stage 1: Build static bundle & compile Ink stories
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Lightweight Node.js production runtime with optional auth gate
FROM node:20-alpine AS runner
LABEL org.opencontainers.image.source="https://github.com/q-marijn/curu-os"
LABEL org.opencontainers.image.description="Curu-OS narrative desktop simulation engine"
LABEL org.opencontainers.image.licenses="MIT"
WORKDIR /app

COPY --from=builder /app/dist /usr/share/nginx/html
COPY server /app/server

ENV NODE_ENV=production
ENV PORT=80
ENV CURU_STATIC_DIR=/usr/share/nginx/html

EXPOSE 80
CMD ["node", "/app/server/index.mjs"]
