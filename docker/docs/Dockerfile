# Image de la documentation technique : site statique MkDocs servi par nginx.
#   docker build -f docker/docs/Dockerfile -t pme-docs:dev .     (ou : make docs-image)
# Le contexte de construction est la racine du depot : l'image a besoin de mkdocs.yml, de docs/ et des dependances de docker/docs/requirements.txt.

# --- Etape 1 : outillage MkDocs (versions exactes), reutilise par "make docs-serve" et "make docs-check" ---
FROM python:3.12-slim AS deps
ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONDONTWRITEBYTECODE=1
WORKDIR /docs
# D2 : binaire qui transforme les blocs ```d2 en schemas SVG a la construction (plugin mkdocs-d2-plugin).
# Version epinglee et somme de controle SHA-256 verifiee, pour chaque architecture (PC Intel/AMD ou Mac Apple Silicon).
# Le telechargement est retente jusqu'a 5 fois (delai maximal de 60 s par essai) : GitHub peut repondre par une erreur passagere.
ARG TARGETARCH
ARG D2_VERSION=0.7.1
ARG D2_SHA256_AMD64=eb172adf59f38d1e5a70ab177591356754ffaf9bebb84e0ca8b767dfb421dad7
ARG D2_SHA256_ARM64=ce3a0b985a8f91335a826c254b3a88736fd81afcdd08b58f6c749d2add6864b0
RUN set -eux; \
    case "${TARGETARCH}" in \
      amd64) sha="${D2_SHA256_AMD64}" ;; \
      arm64) sha="${D2_SHA256_ARM64}" ;; \
      *) echo "Architecture non prise en charge : ${TARGETARCH}" >&2; exit 1 ;; \
    esac; \
    url="https://github.com/terrastruct/d2/releases/download/v${D2_VERSION}/d2-v${D2_VERSION}-linux-${TARGETARCH}.tar.gz"; \
    for essai in 1 2 3 4 5; do \
      python -c "import shutil, sys, urllib.request as u; shutil.copyfileobj(u.urlopen(sys.argv[1], timeout=60), open(sys.argv[2], 'wb'))" \
        "${url}" /tmp/d2.tar.gz && break; \
      echo "Telechargement de D2 echoue (essai ${essai}/5), nouvelle tentative dans 10 s" >&2; \
      sleep 10; \
    done; \
    test -s /tmp/d2.tar.gz; \
    printf '%s  %s\n' "${sha}" /tmp/d2.tar.gz > /tmp/d2.sha256; \
    sha256sum -c /tmp/d2.sha256; \
    tar -xzf /tmp/d2.tar.gz -C /tmp; \
    install -m 0755 "/tmp/d2-v${D2_VERSION}/bin/d2" /usr/local/bin/d2; \
    rm -rf /tmp/d2.tar.gz /tmp/d2.sha256 "/tmp/d2-v${D2_VERSION}"; \
    d2 --version

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