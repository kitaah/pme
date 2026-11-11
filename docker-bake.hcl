# Construction des trois images en parallele avec BuildKit (docker buildx bake).
#   docker buildx bake                 -> pme-api:dev, pme-moderation:dev, pme-frontend:dev
#   TAG=ci-1a2b3c4 docker buildx bake  -> memes images avec une autre etiquette (utilise par la CI)
variable "TAG" {
  default = "dev"
}

# Cache de construction partage dans le registre (la CI y met les couches, notamment `npm ci`, pour ne pas les refaire a
# chaque pipeline). Vide en local : aucun cache distant. Exemple CI : registry.gitlab.com/kitaah/pme/cache
# Exige un builder de type docker-container (docker buildx create --driver docker-container --use).
# `ignore-error` : un cache indisponible ou un envoi refuse ne doit jamais faire echouer la construction.
variable "CACHE_REPO" {
  default = ""
}

group "default" {
  targets = ["api", "moderation", "frontend"]
}

# api et moderation partagent le module commun libs/common : leur contexte est la racine du depot.
# La liste blanche de chaque image est dans <service>/Dockerfile.dockerignore.
target "api" {
  context    = "."
  dockerfile = "api/Dockerfile"
  tags       = ["pme-api:${TAG}"]
  cache-from = CACHE_REPO != "" ? ["type=registry,ref=${CACHE_REPO}/api:buildcache"] : []
  cache-to   = CACHE_REPO != "" ? ["type=registry,ref=${CACHE_REPO}/api:buildcache,mode=max,ignore-error=true"] : []
}

target "moderation" {
  context    = "."
  dockerfile = "moderation-service/Dockerfile"
  tags       = ["pme-moderation:${TAG}"]
  cache-from = CACHE_REPO != "" ? ["type=registry,ref=${CACHE_REPO}/moderation:buildcache"] : []
  cache-to   = CACHE_REPO != "" ? ["type=registry,ref=${CACHE_REPO}/moderation:buildcache,mode=max,ignore-error=true"] : []
}

target "frontend" {
  context = "frontend"
  tags    = ["pme-frontend:${TAG}"]
  cache-from = CACHE_REPO != "" ? ["type=registry,ref=${CACHE_REPO}/frontend:buildcache"] : []
  cache-to   = CACHE_REPO != "" ? ["type=registry,ref=${CACHE_REPO}/frontend:buildcache,mode=max,ignore-error=true"] : []
}
