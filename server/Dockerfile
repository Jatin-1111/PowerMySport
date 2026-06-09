# ── Stage 1: Builder ──────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first (better layer caching)
COPY package*.json ./

# Install ALL deps (including devDeps for TypeScript build)
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript → dist/
RUN npm run build


# ── Stage 2: Runner (lean production image) ───────
FROM node:20-alpine AS runner

WORKDIR /app

# Copy package files
COPY package*.json ./

# Set production environment
ENV NODE_ENV=production

# Install ONLY production deps
RUN npm ci --omit=dev

# Copy compiled dist/ from builder stage
COPY --from=builder /app/dist ./dist

# Expose your server port (change if yours is different)
EXPOSE 8080

# Start the server
CMD ["node", "dist/server.js"]