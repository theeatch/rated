# syntax=docker/dockerfile:1

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache curl

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src

EXPOSE 4000
USER node

HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -fsS http://localhost:4000/api/health/live || exit 1

CMD ["node", "src/index.js"]
