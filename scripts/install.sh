#!/bin/sh
set -e

# OMP-Dev Coding Agent Installer
# Fork of oh-my-pi — installs as 'omp-dev', not 'omp'
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/buihongduc132/oh-my-pi/main/scripts/install.sh | sh
#   ./scripts/install.sh              (auto-detects: local if inside repo, binary otherwise)
#   ./scripts/install.sh --help
#
# Options:
#   --local [dir]  Install from already-cloned repo (default: current dir)  [dev workflow]
#   --source        Clone git ref and install via bun  (default if --ref given)
#   --bun           Alias for --source
#   --binary        Download prebuilt binary from GitHub releases
#   --ref <ref>     Tag/branch/commit for --source mode
#   -r <ref>        Shorthand for --ref
#   -h, --help      Show this help

REPO="buihongduc132/oh-my-pi"
PACKAGE="@oh-my-pi/pi-coding-agent-dev"
INSTALL_DIR="${PI_INSTALL_DIR:-$HOME/.local/bin}"
BINARY_NAME="omp-dev"
MIN_BUN_VERSION="1.3.7"

# Parse arguments
MODE=""
LOCAL_DIR=""
REF=""
while [ $# -gt 0 ]; do
    case "$1" in
        -h|--help)
            cat <<'HELP'
OMP-Dev Installer
Fork of oh-my-pi — installs as 'omp-dev', not 'omp'

Usage:
  curl -fsSL https://raw.githubusercontent.com/buihongduc132/oh-my-pi/main/scripts/install.sh | sh
  ./scripts/install.sh              (auto-detects: local if inside repo, binary otherwise)
  ./scripts/install.sh --help

Options:
  --local [dir]  Install from already-cloned repo (default: current dir)
  --source       Clone git ref and install via bun
  --bun          Alias for --source
  --binary       Download prebuilt binary from GitHub releases
  --ref <ref>    Tag/branch/commit for --source mode
  -r <ref>       Shorthand for --ref
  -h, --help     Show this help

Without options, auto-detects: local if inside repo, binary otherwise.
HELP
            exit 0
            ;;
        --local)
            MODE="local"
            shift
            # Next non-flag arg is the path
            if [ -n "$1" ] && [ "${1#-}" = "$1" ]; then
                LOCAL_DIR="$1"
                shift
            fi
            ;;
        --source|--bun)
            MODE="source"
            shift
            ;;
        --binary)
            MODE="binary"
            shift
            ;;
        --ref)
            shift
            [ -z "$1" ] && echo "Missing value for --ref" && exit 1
            REF="$1"; shift
            ;;
        --ref=*)
            REF="${1#*=}"; shift
            [ -z "$REF" ] && echo "Missing value for --ref" && exit 1
            ;;
        -r)
            shift
            [ -z "$1" ] && echo "Missing value for -r" && exit 1
            REF="$1"; shift
            ;;
        *)
            echo "Unknown option: $1  (use --help for usage)"
            exit 1
            ;;
    esac
done

# Auto-detect mode when none given
if [ -z "$MODE" ]; then
    if [ -d ".git" ] && [ -d "packages/coding-agent" ]; then
        LOCAL_DIR="${LOCAL_DIR:-.}"
        MODE="local"
    elif [ -n "$REF" ]; then
        MODE="source"
    else
        MODE="binary"
    fi
fi

# -------------------------------------------------------------------
has() { command -v "$1" >/dev/null 2>&1; }

version_ge() {
    # Returns 0 if current >= minimum
    cur="$1"; min="$2"
    for v in 1 2 3; do
        cur_v="${cur%%.*}"; cur="${cur#*.}"
        min_v="${min%%.*}"; min="${min#*.}"
        [ "$cur_v" -gt "$min_v" ] && return 0
        [ "$cur_v" -lt "$min_v" ] && return 1
    done
    return 0
}

install_bun() {
    echo "Installing bun..."
    has bash \
        && curl -fsSL https://bun.sh/install | bash \
        || curl -fsSL https://bun.sh/install | sh
    export BUN_INSTALL="$HOME/.bun"
    export PATH="$BUN_INSTALL/bin:$PATH"
}

require_bun_version() {
    version_clean=$(bun --version 2>/dev/null || echo "0.0.0")
    version_clean=${version_clean%%-*}
    version_ge "$version_clean" "$MIN_BUN_VERSION" || {
        echo "Bun ${MIN_BUN_VERSION}+ required. Current: ${version_clean}"
        echo "Upgrade: https://bun.sh/docs/installation"
        exit 1
    }
}

# -------------------------------------------------------------------
# Mode: local — install from already-cloned repo
# -------------------------------------------------------------------
install_via_local() {
    TARGET_DIR="$(cd "${LOCAL_DIR:-.}" && pwd)"
    if [ ! -d "$TARGET_DIR/packages/coding-agent" ]; then
        echo "Error: $TARGET_DIR does not contain packages/coding-agent"
        echo "Run --local from inside the cloned oh-my-pi repo,"
        echo "or: --local /path/to/oh-my-pi"
        exit 1
    fi
    echo "Installing from local source: $TARGET_DIR"
    echo "Installing dependencies..."
    (cd "$TARGET_DIR" && npm install) || bun install --prefix "$TARGET_DIR" || {
        echo "Failed to install dependencies"
        exit 1
    }
    mkdir -p "$HOME/.local/bin"
    ln -sf "$TARGET_DIR/packages/coding-agent/src/cli.ts" "$HOME/.local/bin/$BINARY_NAME"
    echo ""
    echo "✓ Installed $BINARY_NAME to ~/.local/bin/$BINARY_NAME"
    echo "Run '$BINARY_NAME' to get started!"
}

# -------------------------------------------------------------------
# Mode: source — clone git ref then install via bun
# -------------------------------------------------------------------
install_via_source() {
    has git || { echo "git is required for --source installs"; exit 1; }
    echo "Cloning $REPO (ref: ${REF:-main})..."
    TMP_DIR="$(mktemp -d)"
    trap 'rm -rf "$TMP_DIR"' EXIT

    if ! git clone --depth 1 --branch "${REF:-main}" \
        "https://github.com/${REPO}.git" "$TMP_DIR" 2>/dev/null; then
        git clone "https://github.com/${REPO}.git" "$TMP_DIR"
        (cd "$TMP_DIR" && git checkout "$REF")
    fi
    has git-lfs && (cd "$TMP_DIR" && git lfs pull) || true

    [ -d "$TMP_DIR/packages/coding-agent" ] || {
        echo "packages/coding-agent not found in clone"
        exit 1
    }

    echo "Installing dependencies..."
    bun install --prefix "$TMP_DIR" || npm install --prefix "$TMP_DIR" || {
        echo "Failed to install dependencies"
        exit 1
    }

    mkdir -p "$HOME/.local/bin"
    ln -sf "$TMP_DIR/packages/coding-agent/src/cli.ts" "$HOME/.local/bin/$BINARY_NAME"
    echo ""
    echo "✓ Installed $BINARY_NAME to ~/.local/bin/$BINARY_NAME"
    echo "Run '$BINARY_NAME' to get started!"
}

# -------------------------------------------------------------------
# Mode: binary — download prebuilt binary from GitHub releases
# -------------------------------------------------------------------
install_binary() {
    OS="$(uname -s)"; ARCH="$(uname -m)"
    case "$OS" in
        Linux)  PLATFORM="linux" ;;
        Darwin) PLATFORM="darwin" ;;
        *)      echo "Unsupported OS: $OS"; exit 1 ;;
    esac
    case "$ARCH" in
        x86_64|amd64)  ARCH="x64" ;;
        arm64|aarch64) ARCH="arm64" ;;
        *)             echo "Unsupported architecture: $ARCH"; exit 1 ;;
    esac

    BINARY="omp-dev-${PLATFORM}-${ARCH}"

    if [ -n "$REF" ]; then
        echo "Fetching release $REF..."
        RELEASE_JSON=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/tags/${REF}") || {
            echo "Release tag not found: $REF  (use --source for branch/commit installs)"
            exit 1
        }
    else
        echo "Fetching latest release..."
        RELEASE_JSON=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest")
    fi
    LATEST=$(echo "$RELEASE_JSON" | grep '"tag_name"' | head -1 | sed -E 's/.*"([^"]+)".*/\1/')
    [ -z "$LATEST" ] && echo "Failed to fetch release tag" && exit 1
    echo "Using version: $LATEST"

    mkdir -p "$INSTALL_DIR"
    echo "Downloading ${BINARY}..."
    curl -fsSL "https://github.com/${REPO}/releases/download/${LATEST}/${BINARY}" \
        -o "${INSTALL_DIR}/omp-dev"
    chmod +x "${INSTALL_DIR}/omp-dev"

    # Native addon(s)
    if [ "$ARCH" = "x64" ]; then
        for variant in modern baseline; do
            ADDON="pi_natives.${PLATFORM}-${ARCH}-${variant}.node"
            echo "Downloading ${ADDON}..."
            curl -fsSL "https://github.com/${REPO}/releases/download/${LATEST}/${ADDON}" \
                -o "${INSTALL_DIR}/${ADDON}" || { echo "Failed to download ${ADDON}"; exit 1; }
        done
    else
        ADDON="pi_natives.${PLATFORM}-${ARCH}.node"
        echo "Downloading ${ADDON}..."
        curl -fsSL "https://github.com/${REPO}/releases/download/${LATEST}/${ADDON}" \
            -o "${INSTALL_DIR}/${ADDON}"
    fi

    echo ""
    echo "✓ Installed $BINARY_NAME to ${INSTALL_DIR}/$BINARY_NAME"
    case ":$PATH:" in
        *":$INSTALL_DIR:"*) echo "Run '$BINARY_NAME' to get started!" ;;
        *) echo "Add ${INSTALL_DIR} to PATH, then run '$BINARY_NAME'" ;;
    esac
}

# -------------------------------------------------------------------
# Dispatch
# -------------------------------------------------------------------
case "$MODE" in
    local)
        install_via_local
        ;;
    source)
        has bun || install_bun
        require_bun_version
        install_via_source
        ;;
    binary)
        install_binary
        ;;
    *)
        echo "Internal error: unknown mode '$MODE'"
        exit 1
        ;;
esac
