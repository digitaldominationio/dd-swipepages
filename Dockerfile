# =============================================================================
# Stage 1: Build the admin panel (React/Vite SPA)
# =============================================================================
FROM node:20-alpine AS admin-builder

ENV NODE_ENV=development

WORKDIR /app/admin

COPY admin/package*.json ./
RUN npm ci

COPY admin/ ./
RUN npm run build

# =============================================================================
# Stage 2: Build the backend (install deps, generate Prisma client)
# =============================================================================
FROM node:20-alpine AS backend-builder

ENV NODE_ENV=development

WORKDIR /app

COPY backend/package*.json ./
RUN npm ci

COPY backend/ ./
RUN npx prisma generate

# =============================================================================
# Stage 3: Production image
# =============================================================================
FROM node:20-alpine

WORKDIR /app

# Install tini for proper PID 1 signal handling
RUN apk add --no-cache tini

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy package files and install production dependencies only
COPY backend/package*.json ./
RUN npm ci --omit=dev

# Copy generated Prisma client from builder
COPY --from=backend-builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=backend-builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy Prisma schema and migrations (needed for migrate deploy)
COPY --from=backend-builder /app/prisma ./prisma
COPY --from=backend-builder /app/prisma.config.ts ./

# Copy backend source code
COPY --from=backend-builder /app/src ./src

# Copy seed script
COPY --from=backend-builder /app/prisma/seed.js ./prisma/seed.js

# Copy public static files (privacy policy, etc.)
COPY --from=backend-builder /app/public ./public

# Copy built admin panel into public/admin for static serving
COPY --from=admin-builder /app/admin/dist ./public/admin

# Create uploads directory for persistent file storage
RUN mkdir -p /app/uploads

# Copy startup script
COPY backend/scripts/start.sh ./start.sh
RUN chmod +x ./start.sh

# Set ownership to non-root user
RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => { if (r.statusCode !== 200) throw new Error(); })"

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["./start.sh"]
