# syntax=docker/dockerfile:1

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install

FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# NEXT_PUBLIC_* is inlined into the client bundle at build time, so these have
# to arrive as build args — setting them at runtime would have no effect.
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
ARG NEXT_PUBLIC_POLL_INTERVAL_MS=2000
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_POLL_INTERVAL_MS=$NEXT_PUBLIC_POLL_INTERVAL_MS

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# `output: 'standalone'` bundles only the server files that are actually used.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
USER node

CMD ["node", "server.js"]
