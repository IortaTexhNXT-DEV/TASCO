# syntax=docker/dockerfile:1.7
# TASCO Growth Platform — production image (multi-stage, non-root (uid 1000), read-only FS friendly).

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

FROM node:22-alpine AS runtime
ENV NODE_ENV=production \
    PORT=8080 \
    NODE_OPTIONS="--max-old-space-size=384"
WORKDIR /app
# Files are root-owned and read-only for the runtime user (uid 1000 "node").
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY config ./config
COPY db ./db
COPY public ./public
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/health/live || exit 1
# The server handles SIGTERM/SIGINT itself (graceful drain); run with `--init` / K8s for zombie reaping.
CMD ["node", "src/server.js"]
