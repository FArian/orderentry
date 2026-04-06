#!/usr/bin/env bash
# =============================================================================
# build.sh — Docker Build Script für OrderEntry
#
# Usage (lokal, multi-arch mit push):
#   chmod +x build.sh
#   ./build.sh
#
# Usage (nur für aktuelle Plattform, kein push — z.B. auf Hetzner arm64):
#   ./build.sh --local
# =============================================================================

set -euo pipefail

# ── Konfiguration ─────────────────────────────────────────────────────────────
IMAGE="farian/orderentry"
VERSION=$(node -e "process.stdout.write(require('./package.json').version)" 2>/dev/null || echo "0.0.0")
GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
GIT_COUNT=$(git rev-list --count HEAD 2>/dev/null || echo "0")

LAB_ORG_ID="${NEXT_PUBLIC_LAB_ORG_ID:-zlz}"
LAB_NAME="${NEXT_PUBLIC_LAB_NAME:-ZLZ Zentrallabor AG}"
SERVICE_TYPES="${NEXT_PUBLIC_ORDER_SERVICE_TYPES:-MIBI,ROUTINE,POC}"

BUILD_ARGS=(
  --build-arg GIT_COMMIT="$GIT_COMMIT"
  --build-arg GIT_BRANCH="$GIT_BRANCH"
  --build-arg GIT_COUNT="$GIT_COUNT"
  --build-arg NEXT_PUBLIC_LAB_ORG_ID="$LAB_ORG_ID"
  --build-arg "NEXT_PUBLIC_LAB_NAME=$LAB_NAME"
  --build-arg NEXT_PUBLIC_ORDER_SERVICE_TYPES="$SERVICE_TYPES"
)

TAGS=(
  -t "$IMAGE:v$VERSION"
  -t "$IMAGE:latest"
)

echo "============================================="
echo " OrderEntry Docker Build"
echo " Version : v$VERSION"
echo " Commit  : $GIT_COMMIT ($GIT_BRANCH)"
echo " Image   : $IMAGE"
echo " Org ID  : $LAB_ORG_ID"
echo "============================================="

# ── Build-Modus ───────────────────────────────────────────────────────────────
if [[ "${1:-}" == "--local" ]]; then
  # Nur für aktuelle Plattform bauen (kein Push) — für Hetzner native builds
  echo "[mode] Lokaler Build (aktuelle Plattform, kein Push)"
  docker build \
    "${BUILD_ARGS[@]}" \
    "${TAGS[@]}" \
    -f docker/Dockerfile \
    .
  echo ""
  echo "✓ Build fertig. Image lokal verfügbar: $IMAGE:latest"
  echo ""
  echo "Starten mit:"
  echo "  cd infrastructure/docker && docker compose up -d orderentry"
else
  # Multi-arch Build + Push zu Docker Hub
  echo "[mode] Multi-arch Build (linux/amd64 + linux/arm64) + Push"
  docker buildx build \
    --platform linux/amd64,linux/arm64 \
    "${BUILD_ARGS[@]}" \
    "${TAGS[@]}" \
    --push \
    -f docker/Dockerfile \
    .
  echo ""
  echo "✓ Build fertig und gepusht: $IMAGE:latest und $IMAGE:v$VERSION"
fi
