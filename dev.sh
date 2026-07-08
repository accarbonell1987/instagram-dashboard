#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="$(dirname "$0")/docker-compose.dev.yml"
COMPOSE_ARGS=(-f "$COMPOSE_FILE")

cmd="${1:-up}"
shift 2>/dev/null || true

case "$cmd" in
  up)
    echo "🔧 Building and starting Corehub dev stack..."
    docker compose "${COMPOSE_ARGS[@]}" up --build -d "$@"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Hub:    http://localhost:3001"
    echo "  API:    http://localhost:8080"
    echo "  Docs:   http://localhost:3002"
    echo "  MailDev: http://localhost:1080"
    echo "  Adminer: http://localhost:8081"
    echo ""
    echo "  docker compose -f docker-compose.dev.yml logs -f"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    ;;
  down)
    docker compose "${COMPOSE_ARGS[@]}" down "$@"
    ;;
  down-v|reset)
    echo "🗑  Stopping and removing volumes (DB data will be lost)..."
    docker compose "${COMPOSE_ARGS[@]}" down -v "$@"
    ;;
  build)
    docker compose "${COMPOSE_ARGS[@]}" build "$@"
    ;;
  logs)
    docker compose "${COMPOSE_ARGS[@]}" logs -f "$@"
    ;;
  ps|status)
    docker compose "${COMPOSE_ARGS[@]}" ps "$@"
    ;;
  *)
    echo "Usage: dev.sh <command>"
    echo ""
    echo "Commands:"
    echo "  up       Build and start all services (default)"
    echo "  down     Stop all services"
    echo "  reset    Stop and wipe DB volumes"
    echo "  build    Rebuild images"
    echo "  logs     Tail all logs"
    echo "  ps       Show service status"
    exit 1
    ;;
esac
