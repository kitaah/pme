# --- Etape 1 : build de l'application React ---
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- Etape 2 : image finale legere, sans privileges root ---
FROM nginxinc/nginx-unprivileged:1.30-alpine
# L'image de base est publiee avec des paquets Alpine en retard sur leurs correctifs de securite (Trivy : brotli, curl, expat,
# musl, zlib...). Mise a jour des paquets installes, puis retour a l'utilisateur sans privileges de l'image (uid 101).
USER root
RUN apk upgrade --no-cache
USER 101
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
