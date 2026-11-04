# --- Etape 1 : compilation TypeScript ---
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src src
RUN npm run build && npm prune --omit=dev

# --- Etape 2 : image finale legere, sans privileges root ---
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules node_modules
COPY --from=build --chown=node:node /app/dist dist
COPY --from=build --chown=node:node /app/package.json package.json
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
