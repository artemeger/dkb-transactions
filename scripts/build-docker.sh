#!/bin/bash
set -e

TARGET="${1:-win}"
echo "Building Electron artifacts for: ${TARGET}"

# Detect compose command
if command -v docker &>/dev/null && docker compose version &>/dev/null 2>&1; then
  COMPOSE_RUN="docker compose run --rm"
elif command -v docker-compose &>/dev/null; then
  COMPOSE_RUN="docker-compose run --rm"
else
  echo "ERROR: Neither 'docker compose' nor 'docker-compose' found."
  exit 1
fi

run_docker_build() {
  ${COMPOSE_RUN} electron-builder \
    bash -c "npm ci && npm run build && npx electron-builder --win --config build-docker-config.json"
}

case "${TARGET}" in
  win)
    echo "Building Windows artifacts via Docker..."
    run_docker_build
    ;;
  linux)
    echo "Building Linux artifacts natively..."
    npm run dist:linux
    ;;
  mac)
    echo "ERROR: macOS builds require a Mac or GitHub Actions."
    echo "Consider using GitHub Actions for macOS builds."
    exit 1
    ;;
  all)
    echo "Building Linux artifacts natively..."
    npm run dist:linux

    echo ""
    echo "Building Windows artifacts via Docker..."
    run_docker_build
    ;;
  *)
    echo "Usage: $0 [win|linux|mac|all]"
    exit 1
    ;;
esac

echo ""
echo "Build complete! Artifacts are in ./dist-electron/"
