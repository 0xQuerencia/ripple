# syntax=docker/dockerfile:1

# Build the interface. The server itself has no npm dependencies, so only `dist/` survives this stage.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Run: Node's own modules plus the code in server/ and shared/. Nothing else is needed.
FROM node:22-alpine AS run
ENV NODE_ENV=production
WORKDIR /app
COPY package.json ./
COPY shared ./shared
COPY server ./server
COPY --from=build /app/dist ./dist
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8787/api/status >/dev/null || exit 1
CMD ["node", "server/index.mjs"]
