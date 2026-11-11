# Construction des trois images en parallele avec BuildKit (docker buildx bake).
#   docker buildx bake                 -> pme-api:dev, pme-moderation:dev, pme-frontend:dev
#   TAG=ci-1a2b3c4 docker buildx bake  -> memes images avec une autre etiquette (utilise par la CI)
variable "TAG" {
  default = "dev"
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
}

target "moderation" {
  context    = "."
  dockerfile = "moderation-service/Dockerfile"
  tags       = ["pme-moderation:${TAG}"]
}

target "frontend" {
  context = "frontend"
  tags    = ["pme-frontend:${TAG}"]
}
