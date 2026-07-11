#!/usr/bin/env bash

#------------------------------------------------------------------------------
# Builds Simon's Blog (Hugo + LoveIt) on Cloudflare Workers.
# https://gohugo.io/host-and-deploy/host-on-cloudflare/
#------------------------------------------------------------------------------

set -euo pipefail

DART_SASS_VERSION=1.101.0
HUGO_VERSION=0.164.0
NODE_VERSION=24.18.0

TZ=Asia/Shanghai
HUGO_CACHEDIR="${PWD}/.cache/hugo"

cleanup() {
  if [[ -n "${build_temp_dir:-}" && -d "${build_temp_dir}" ]]; then
    rm -rf "${build_temp_dir}"
  fi
}

trap cleanup EXIT SIGINT SIGTERM

main() {
  export TZ
  export HUGO_CACHEDIR
  export HUGO_ENV=production

  build_temp_dir=$(mktemp -d)
  mkdir -p "${HOME}/.local"

  echo "Installing Dart Sass ${DART_SASS_VERSION}..."
  curl -sfL --output-dir "${build_temp_dir}" -O \
    "https://github.com/sass/dart-sass/releases/download/${DART_SASS_VERSION}/dart-sass-${DART_SASS_VERSION}-linux-x64.tar.gz"
  tar -C "${HOME}/.local" -xf "${build_temp_dir}/dart-sass-${DART_SASS_VERSION}-linux-x64.tar.gz"
  export PATH="${HOME}/.local/dart-sass:${PATH}"

  echo "Installing Hugo Extended ${HUGO_VERSION}..."
  curl -sfL --output-dir "${build_temp_dir}" -O \
    "https://github.com/gohugoio/hugo/releases/download/v${HUGO_VERSION}/hugo_extended_${HUGO_VERSION}_linux-amd64.tar.gz"
  mkdir -p "${HOME}/.local/hugo"
  tar -C "${HOME}/.local/hugo" -xf "${build_temp_dir}/hugo_extended_${HUGO_VERSION}_linux-amd64.tar.gz"
  export PATH="${HOME}/.local/hugo:${PATH}"

  if [[ -f package-lock.json ]]; then
    echo "Installing Node.js ${NODE_VERSION}..."
    curl -sfL --output-dir "${build_temp_dir}" -O \
      "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.gz"
    tar -C "${HOME}/.local" -xf "${build_temp_dir}/node-v${NODE_VERSION}-linux-x64.tar.gz"
    export PATH="${HOME}/.local/node-v${NODE_VERSION}-linux-x64/bin:${PATH}"
  fi

  echo "Logging tool versions..."
  command -v sass &>/dev/null && echo "Dart Sass: $(sass --version)" || echo "Dart Sass: not installed"
  command -v hugo &>/dev/null && echo "Hugo: $(hugo version)" || echo "Hugo: not installed"
  command -v node &>/dev/null && echo "Node.js: $(node --version)" || echo "Node.js: not installed"

  echo "Configuring Git..."
  git config --global core.quotepath false

  if [[ $(git rev-parse --is-shallow-repository) == true ]]; then
    echo "Fetching full Git history..."
    git fetch --unshallow
  fi

  if [[ -f .gitmodules ]]; then
    echo "Initializing Git submodules..."
    git submodule update --init --recursive
  fi

  if [[ -f package-lock.json ]]; then
    echo "Installing Node.js dependencies..."
    npm ci
  fi

  echo "Building the project..."
  if [[ -n "${HUGO_BASEURL:-}" ]]; then
    hugo build --gc --minify --baseURL "${HUGO_BASEURL}"
  else
    hugo build --gc --minify
  fi
}

main "$@"
