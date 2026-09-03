#!/usr/bin/env bash
#
# Despliegue de Corehub en la VPS compartida.
#
# Vive en el servidor y es lo UNICO que la llave de GitHub Actions puede correr:
# en authorized_keys va atada con command="/opt/corehub/deploy-vps.sh". Si el
# secreto se filtra, lo peor que consigue un atacante es desplegar tu propia
# aplicacion — no una shell en una maquina con 7 sistemas de clientes.
#
# Uso (desde el runner):
#   ssh deploy@host "dev-<sha>" < docker/compose.vps.yml
#
# El tag llega como comando (SSH_ORIGINAL_COMMAND) y el compose.yml por stdin,
# porque una llave con command= no admite scp.
set -euo pipefail

ENV_DIR=/opt/corehub/dev
TAG="${SSH_ORIGINAL_COMMAND:-}"

# El tag entra en un sed y en un docker pull. La llave ya esta acotada, pero un
# argumento sin validar es la grieta por donde esa restriccion se pierde.
if [[ ! "$TAG" =~ ^(dev|prod)-[0-9a-f]{40}$ ]]; then
  echo "deploy: tag invalido: '${TAG}'" >&2
  exit 1
fi

cd "$ENV_DIR"

# ─── compose.yml por stdin ───────────────────────────────────────────────────
incoming=$(mktemp)
trap 'rm -f "$incoming"' EXIT
cat > "$incoming"

if [ ! -s "$incoming" ]; then
  echo "deploy: no llego compose.yml por stdin" >&2
  exit 1
fi

# Se valida ANTES de reemplazar. Un compose roto que ya piso al bueno deja el
# stack sin forma de volver a arrancar, y a esta maquina se entra por SSH.
cp compose.yml compose.yml.prev
cp "$incoming" compose.yml
if ! docker compose config >/dev/null 2>&1; then
  cp compose.yml.prev compose.yml
  echo "deploy: compose.yml invalido — se restauro el anterior, nada se toco" >&2
  docker compose config 2>&1 | head -5 >&2
  exit 1
fi

# ─── tag exacto, nunca 'latest' ──────────────────────────────────────────────
# Un deploy tiene que ser reproducible: 'latest' se mueve debajo tuyo y dos
# despliegues del mismo commit pueden traer imagenes distintas. El rollback es
# volver a correr esto con el sha anterior.
sed -i "s|^IMAGE_TAG=.*|IMAGE_TAG=${TAG}|" .env
grep -q "^IMAGE_TAG=${TAG}$" .env || { echo "deploy: no se pudo fijar IMAGE_TAG" >&2; exit 1; }

echo "deploy: desplegando ${TAG}"
docker compose pull --quiet
# Las migraciones son servicios de un disparo y `up` espera a que terminen:
# si fallan, ninguna API arranca contra un schema viejo.
docker compose up -d --remove-orphans
docker compose ps
