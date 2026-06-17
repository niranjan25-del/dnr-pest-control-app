# backend/Dockerfile
# Multi-stage build for the NestJS backend. Stage 1 installs all deps + builds (incl. Prisma
# client generation); stage 2 ships a slim production image with only prod deps + the compiled
# dist + the Prisma schema/engine. Uses the built-in `node` user from the base image.

# ---------- Stage 1: build ----------
FROM node:20-slim AS builder
WORKDIR /app

# OpenSSL is required by Prisma's query engine.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .
RUN npx prisma generate && npm run build

# Prune dev dependencies for the runtime copy.
RUN npm prune --omit=dev

# ---------- Stage 2: runtime ----------
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/package.json ./package.json

USER node
EXPOSE 3000

# Sync schema (db push is idempotent — no-op when schema is already in sync), then start.
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node dist/main.js"]
