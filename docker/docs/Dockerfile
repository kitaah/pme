# Image de la documentation technique : site statique MkDocs servi par nginx.
#   docker build -f docker/docs/Dockerfile -t pme-docs:dev .     (ou : make docs-image)
# Le contexte de construction est la racine du depot : l'image a besoin de mkdocs.yml, de docs/ et des dependances de docker/docs/requirements.txt.

# --- Etape 1 : outillage MkDocs (versions exactes), reutilise par "make docs-serve" et "make docs-check" ---
FROM python:3.12-slim AS deps
ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONDONTWRITEBYTECODE=1
WORKDIR /docs
# Dependances seules : cette couche reste en cache tant que docker/docs/requirements.txt ne change pas
COPY docker/docs/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# --- Etape 2 : construction du site ---
FROM deps AS build
COPY mkdocs.yml .
COPY docs/ docs/
# --strict : un lien casse ou une page absente du menu fait echouer la construction de l'image
RUN mkdocs build --strict

# --- Etape 3 : image finale legere, sans privileges root, sans Python ni sources Markdown ---
FROM nginxinc/nginx-unprivileged:1.30-alpine
COPY docker/docs/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /docs/site /usr/share/nginx/html
EXPOSE 8080