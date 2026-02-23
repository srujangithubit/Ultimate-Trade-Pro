# ==============================================================================
# Stage 1: Install dependencies
# ==============================================================================
FROM node:20-alpine AS deps

WORKDIR /app

# Copy dependency manifests
COPY package.json package-lock.json ./
COPY prisma ./prisma/

# Install production dependencies only
# Dummy DATABASE_URL required by prisma.config.ts during generate (not used at runtime)
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
RUN npm ci --omit=dev && \
    npx prisma generate

# ==============================================================================
# Stage 2: Build application
# ==============================================================================
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma client and build
# Dummy DATABASE_URL required by prisma.config.ts during generate (not used at runtime)
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
RUN npx prisma generate && \
    npm run build

# ==============================================================================
# Stage 3: Production image
# ==============================================================================
FROM node:20-alpine AS production

LABEL maintainer="Trading Platform Team"
LABEL description="Trading Platform API - NestJS Backend"

# Security: run as non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

WORKDIR /app

# Copy production dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy compiled application from build stage
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json

# Copy Prisma schema and generated client
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Expose API port
EXPOSE 3000

# Switch to non-root user
USER nestjs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start the application
CMD ["node", "dist/main.js"]
