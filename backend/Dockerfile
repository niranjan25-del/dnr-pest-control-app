# backend/Dockerfile
# Multi-stage Alpine build — avoids apt-get entirely (more reliable on Railway).
# Prisma binaryTarget linux-musl-openssl-3.0.x matches Alpine's musl libc.

# ---------- Stage 1: build ----------
FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .
RUN npx prisma generate && npm run build

RUN npm prune --omit=dev

# ---------- Stage 2: runtime ----------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache openssl

COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/package.json ./package.json

USER node
EXPOSE 3000

CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node dist/main.js"]
