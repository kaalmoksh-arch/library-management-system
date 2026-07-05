# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

# sqlite3 needs python3 + make + g++ to compile its native binding
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# SQLite database stored in /app/data — mount a volume here in production
RUN mkdir -p /app/data && chown -R appuser:appgroup /app

USER appuser

EXPOSE 5000

ENV NODE_ENV=production
ENV PORT=5000

CMD ["node", "server.js"]
