# Stage 1: Build static bundle & compile Ink stories
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Lightweight Nginx production runtime
FROM nginx:alpine AS runner
LABEL org.opencontainers.image.source="https://github.com/q-marijn/curu-os"
LABEL org.opencontainers.image.description="Curu-OS narrative desktop simulation engine"
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
