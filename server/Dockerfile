# Build context is the monorepo ROOT (see scripts/deploy.js) — server needs
# packages/shared-types, which lives outside the server/ directory.

# ── Stage 0: shared-types ──────────────────────────
# @powermysport/shared-types ships raw .ts source for the Next.js apps (which
# resolve it directly via their bundler's TS resolution). server isn't an npm
# workspace member — it keeps its own package-lock.json — and consumes this
# package as a `file:` dependency, so it needs real compiled JS a plain
# `node dist/server.js` can require at runtime.
FROM node:20-alpine AS shared-types
WORKDIR /app/packages/shared-types
COPY packages/shared-types/package.json ./
COPY packages/shared-types/tsconfig*.json ./
COPY packages/shared-types/src ./src
RUN npm install -g typescript@5.9.3 && tsc -p tsconfig.build.json


# ── Stage 1: Builder ──────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app/server

# Copy package files first (better layer caching)
COPY server/package*.json ./
COPY --from=shared-types /app/packages/shared-types /app/packages/shared-types

# Install ALL deps (including devDeps for TypeScript build)
RUN npm ci

# Copy source code
COPY server/. .

# Build TypeScript → dist/
RUN npm run build


# ── Stage 2: Runner (lean production image) ───────
FROM node:20-alpine AS runner

# # Create non-root user for security
# RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app/server

# Copy package files
COPY server/package*.json ./
COPY --from=shared-types /app/packages/shared-types /app/packages/shared-types

# Set production environment
ENV NODE_ENV=production

# Install ONLY production deps
RUN npm ci --omit=dev

# Copy compiled dist/ from builder stage
COPY --from=builder /app/server/dist ./dist

# # Use non-root user
# USER appuser

# Expose your server port (change if yours is different)
EXPOSE 8080

# Health check — Docker + EB load balancer checks /api/health
# Uses $PORT so local runs (PORT=5000) and EB (PORT=8080) both resolve correctly
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:${PORT:-8080}/api/health || exit 1

# Start the server
CMD ["node", "dist/server.js"]
