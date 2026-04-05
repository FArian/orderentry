#!/usr/bin/env bash
# =============================================================================
# z2Lab OrderEntry — Start Script (Linux / macOS)
# =============================================================================
#
# Usage:
#   ./start.sh               # use prebuilt image (pull if needed)
#   ./start.sh --build       # force local build
#   ./start.sh --compose     # use docker compose (detached)
#   ./start.sh --sqlserver   # start with SQL Server
#   ./start.sh --stop        # stop running container
#   ./start.sh --logs        # follow container logs
#   ./start.sh --help        # show this help
#
# Environment:
#   IMAGE      — Docker image name (default: farian/orderentry:latest)
#   PORT       — Host port        (default: 3000)
#   FHIR_URL   — FHIR base URL    (default: https://hapi.fhir.org/baseR4)
#   AUTH_SECRET — Session secret  (default: dev-only-change-in-production!!)
# =============================================================================

set -euo pipefail

# ── Config (override via environment) ─────────────────────────────────────────
IMAGE="${IMAGE:-farian/orderentry:latest}"
PORT="${PORT:-3000}"
ORDERENTRY_FHIR__BASE_URL="${ORDERENTRY_FHIR__BASE_URL:-https://hapi.fhir.org/baseR4}"
ORDERENTRY_AUTH__SECRET="${ORDERENTRY_AUTH__SECRET:-dev-only-change-in-production!!}"
CONTAINER_NAME="orderentry"

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'

info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }
header()  { echo -e "\n${BOLD}$*${NC}"; }

# ── Flag parsing ──────────────────────────────────────────────────────────────
FLAG_BUILD=false
FLAG_COMPOSE=false
FLAG_SQLSERVER=false
FLAG_STOP=false
FLAG_LOGS=false

for arg in "$@"; do
  case "$arg" in
    --build)      FLAG_BUILD=true ;;
    --compose)    FLAG_COMPOSE=true ;;
    --sqlserver)  FLAG_SQLSERVER=true; FLAG_COMPOSE=true ;;
    --stop)       FLAG_STOP=true ;;
    --logs)       FLAG_LOGS=true ;;
    --help|-h)
      sed -n '2,20p' "$0" | sed 's/^# \?//'
      exit 0 ;;
    *)
      error "Unknown flag: $arg"
      exit 1 ;;
  esac
done

# ── Check Docker ──────────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  error "Docker is not installed. Install from https://docs.docker.com/get-docker/"
  exit 1
fi

# ── Stop ──────────────────────────────────────────────────────────────────────
if $FLAG_STOP; then
  header "Stopping OrderEntry..."
  if docker ps -q --filter "name=$CONTAINER_NAME" | grep -q .; then
    docker stop "$CONTAINER_NAME" && docker rm "$CONTAINER_NAME"
    success "Container stopped."
  else
    warn "Container '$CONTAINER_NAME' is not running."
  fi
  exit 0
fi

# ── Logs ──────────────────────────────────────────────────────────────────────
if $FLAG_LOGS; then
  docker logs -f "$CONTAINER_NAME"
  exit 0
fi

# ── Docker Compose mode ───────────────────────────────────────────────────────
if $FLAG_COMPOSE; then
  COMPOSE_FILES="-f docker/docker-compose.yml"
  $FLAG_BUILD      && COMPOSE_FILES="$COMPOSE_FILES -f docker/docker-compose.build.yml"
  $FLAG_SQLSERVER  && COMPOSE_FILES="$COMPOSE_FILES -f docker/docker-compose.sqlserver.yml"

  header "Starting with Docker Compose..."
  info "Files: $COMPOSE_FILES"

  if $FLAG_BUILD; then
    info "Building image locally..."
    GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "")
    GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
    GIT_COUNT=$(git rev-list --count HEAD 2>/dev/null || echo "0")
    export GIT_COMMIT GIT_BRANCH GIT_COUNT
    docker compose $COMPOSE_FILES build
    success "Build complete."
  fi

  docker compose $COMPOSE_FILES up -d
  echo ""
  success "OrderEntry started!"
  echo -e "  ${BOLD}URL:${NC}    http://localhost:${PORT}"
  echo -e "  ${BOLD}Logs:${NC}   docker compose $COMPOSE_FILES logs -f"
  echo -e "  ${BOLD}Stop:${NC}   docker compose $COMPOSE_FILES down"
  echo -e "  ${BOLD}Health:${NC} http://localhost:${PORT}/api/health/db  (login required)"
  exit 0
fi

# ── Standalone mode (docker run) ──────────────────────────────────────────────
header "z2Lab OrderEntry Starter"

# Build if --build flag or image not present
if $FLAG_BUILD || ! docker image inspect "$IMAGE" &>/dev/null; then
  if $FLAG_BUILD; then
    info "Building image (--build flag set)..."
  else
    warn "Image '$IMAGE' not found locally. Building from source..."
  fi

  GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "")
  GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
  GIT_COUNT=$(git rev-list --count HEAD 2>/dev/null || echo "0")

  docker build \
    -f docker/Dockerfile \
    --build-arg GIT_COMMIT="$GIT_COMMIT" \
    --build-arg GIT_BRANCH="$GIT_BRANCH" \
    --build-arg GIT_COUNT="$GIT_COUNT" \
    -t "$IMAGE" \
    .

  success "Image built: $IMAGE"
else
  info "Using existing image: $IMAGE"
fi

# Stop existing container if running
if docker ps -q --filter "name=$CONTAINER_NAME" | grep -q .; then
  warn "Stopping existing container '$CONTAINER_NAME'..."
  docker stop "$CONTAINER_NAME" >/dev/null
  docker rm   "$CONTAINER_NAME" >/dev/null
fi

# Create data directory
mkdir -p data logs

info "Starting container..."
docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  -p "${PORT}:3000" \
  -e "ORDERENTRY_AUTH__SECRET=${ORDERENTRY_AUTH__SECRET}" \
  -e "ORDERENTRY_FHIR__BASE_URL=${ORDERENTRY_FHIR__BASE_URL}" \
  -e "ORDERENTRY_DB__PROVIDER=sqlite" \
  -e "DATABASE_URL=file:/app/data/orderentry.db" \
  -e "ORDERENTRY_LOG__LEVEL=info" \
  -e "ORDERENTRY_LOG__FILE=/app/logs/zetlab.log" \
  -e "ORDERENTRY_FHIR__SEED_ENABLED=true" \
  -e "ORDERENTRY_FHIR__SEED_DEMO=false" \
  -e "ORDERENTRY_LAB__INTERNAL_ORG_IDS=zlz,zetlab,zlz-notfall" \
  -e "ORDERENTRY_SNOMED__ROLE_INTERNAL=159418007,159011000" \
  -e "ORDERENTRY_SNOMED__ROLE_ORG_ADMIN=224608005,394572006" \
  -e "ORDERENTRY_SNOMED__ROLE_PHYSICIAN=309343006,59058001,106289002" \
  -e "ORDERENTRY_SNOMED__ORG_LABORATORY=708175003" \
  -e "ORDERENTRY_SNOMED__ORG_HOSPITAL=22232009" \
  -e "ORDERENTRY_SNOMED__ORG_OUTPATIENT=33022008" \
  -e "ORDERENTRY_SNOMED__ORG_HOLDING=224891009" \
  -v "$(pwd)/data:/app/data" \
  -v "$(pwd)/logs:/app/logs" \
  "$IMAGE"

echo ""
success "OrderEntry is running!"
echo -e "  ${BOLD}URL:${NC}    http://localhost:${PORT}"
echo -e "  ${BOLD}Login:${NC}  admin / Admin1234!  (change after first login!)"
echo -e "  ${BOLD}Logs:${NC}   ./start.sh --logs"
echo -e "  ${BOLD}Stop:${NC}   ./start.sh --stop"
echo -e "  ${BOLD}Health:${NC} http://localhost:${PORT}/api/health/db"
