#!/bin/bash

IMAGE_NAME="farian/orderentry:latest"

docker run -d \
  -p 3000:3000 \
  -e FHIR_BASE_URL=https://hapi.fhir.org/baseR4 \
  -e AUTH_SECRET=dev-secret \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/logs:/app/logs \
  --name orderentry \
  $IMAGE_NAME