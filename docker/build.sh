#!/bin/bash

set -e

IMAGE_NAME="dein-username/orderentry"
VERSION=$(git describe --tags --always --dirty || echo "dev")

echo "Building image: $IMAGE_NAME:$VERSION"

docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -f docker/Dockerfile \
  --build-arg GIT_COMMIT=$(git rev-parse --short HEAD) \
  --build-arg GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD) \
  --build-arg GIT_COUNT=$(git rev-list --count HEAD) \
  -t $IMAGE_NAME:$VERSION \
  -t $IMAGE_NAME:latest \
  --push .

echo "Done 🚀"