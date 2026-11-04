# --- Etape 1 : build de l'application React ---
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- Etape 2 : image finale legere, sans privileges root ---
FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY proxy-common.conf /etc/nginx/conf.d/proxy-common.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
