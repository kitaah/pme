# Contexte de construction : la RACINE du depot (docker build -f api/Dockerfile .), car l'image embarque aussi
# le module commun libs/common (@pme/common), partage avec l'autre service. Voir docker-bake.hcl et `make image`.

# --- Etape 1 : dependances de production seules ---
# Etape separee de la compilation : elle ne depend que des package.json et du package-lock.json, donc le cache de construction
# la reutilise tant que les dependances ne changent pas (sinon `npm prune` refaisait ce travail a chaque modification de code).
FROM node:24-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY libs/common/package.json libs/common/
COPY api/package.json api/
COPY moderation-service/package.json moderation-service/
RUN npm ci --omit=dev --workspace=api --workspace=libs/common

# --- Etape 2 : compilation TypeScript ---
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
 && npm run build --workspace=api

# --- Etape 3 : image finale legere, sans privileges root ---
FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
# node_modules/@pme/common est un lien vers libs/common : le module commun compile doit donc etre present a ce chemin.
COPY --from=prod-deps --chown=node:node /app/node_modules node_modules
COPY --from=build --chown=node:node /app/libs/common/package.json libs/common/package.json
COPY --from=build --chown=node:node /app/libs/common/dist libs/common/dist
COPY --from=build --chown=node:node /app/api/dist dist
COPY --from=build --chown=node:node /app/api/package.json package.json
# Ni npm, ni corepack, ni yarn a l'execution : ces outils de build sont livres avec l'image de base node. Inutiles pour lancer
# l'application, leurs paquets embarques (brace-expansion, undici) portent des failles que Trivy signale, hors de nos dependances.
RUN rm -rf /usr/local/lib/node_modules /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
    /opt/yarn-* /usr/local/bin/yarn /usr/local/bin/yarnpkg
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
