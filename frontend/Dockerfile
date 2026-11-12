# --- Etape 1 : build de l'application React ---
# Images de base epinglees par leur empreinte (@sha256) : le cache de construction du registre GitLab reste valide tant que l'empreinte
# ne change pas. Avec la seule etiquette, chaque mise a jour de l'image sur Docker Hub invalidait tout le cache : les `npm ci` etaient
# refaits et le job `image-tests` depassait sa limite de 6 minutes. Mise a jour VOLONTAIRE : `docker buildx imagetools inspect <image>`
# (ligne Digest), puis remplacer l'empreinte dans les Dockerfile de api, moderation-service et frontend.
FROM node:24-alpine@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- Etape 2 : image finale legere, sans privileges root ---
FROM nginxinc/nginx-unprivileged:1.30-alpine@sha256:f5116ed4606f3eb015dd4a8e28cb9b351476dc0ad4bc6e9f93b19cec130cdf03
# L'image de base est publiee avec des paquets Alpine en retard sur leurs correctifs de securite (Trivy : brotli, curl, expat,
# musl, zlib...). Mise a jour des paquets installes, puis retour a l'utilisateur sans privileges de l'image (uid 101).
USER root
RUN apk upgrade --no-cache
USER 101
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
