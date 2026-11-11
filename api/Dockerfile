# Contexte de construction : la RACINE du depot (docker build -f api/Dockerfile .), car l'image embarque aussi
# le module commun libs/common (@pme/common), partage avec l'autre service. Voir docker-bake.hcl et `make image`.

# --- Etape 1 : compilation TypeScript ---
FROM node:24-alpine AS build
WORKDIR /app
# Workspaces npm : un seul package-lock.json, a la racine. Les package.json des trois workspaces doivent etre presents
# pour que npm ci verifie ce fichier ; seules les dependances de ce service et du module commun sont installees.
COPY package.json package-lock.json ./
COPY libs/common/package.json libs/common/
COPY api/package.json api/
COPY moderation-service/package.json moderation-service/
RUN npm ci --workspace=api --workspace=libs/common
# Le module commun d'abord : le service le lit dans sa version compilee (libs/common/dist).
COPY libs/common/tsconfig.json libs/common/tsconfig.build.json libs/common/
COPY libs/common/src libs/common/src
COPY api/tsconfig.json api/tsconfig.build.json api/nest-cli.json api/
COPY api/src api/src
RUN npm run build --workspace=libs/common \
 && npm run build --workspace=api \
 && npm prune --omit=dev --workspace=api --workspace=libs/common

# --- Etape 2 : image finale legere, sans privileges root ---
FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
# node_modules/@pme/common est un lien vers libs/common : le module commun compile doit donc etre present a ce chemin.
COPY --from=build --chown=node:node /app/node_modules node_modules
COPY --from=build --chown=node:node /app/libs/common/package.json libs/common/package.json
COPY --from=build --chown=node:node /app/libs/common/dist libs/common/dist
COPY --from=build --chown=node:node /app/api/dist dist
COPY --from=build --chown=node:node /app/api/package.json package.json
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
