#!/bin/sh
set -e

# OMP-Dev Coding Agent Installer
# Fork of oh-my-pi installer — installs as 'omp-dev', not 'omp'
#
# Usage: curl -fsSL https://raw.githubusercontent.com/buihongduc132/oh-my-pi/main/scripts/install.sh | sh
#
# Options:
#   --local [dir]   Install from already-cloned repo (default: current dir)  [dev workflow]
#   --nodejs        Install from remote git ref using Node.js + tsx
#   --source        Install from remote git ref using bun
#   --bun           Alias for --source
#   --binary        Download prebuilt binary from GitHub releases
#   --ref <ref>     Install specific tag/commit/branch (used by --nodejs/--source)
#   -r <ref>        Shorthand for --ref

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
        --local)
            MODE="local"
            shift
            # Next arg is the local path if it doesn't start with -
            if [ -n "$1" ] && [ "${1#-}" = "$1" ]; then
                LOCAL_DIR="$1"
                shift
            fi
            ;;
        --nodejs)
            MODE="nodejs"
            shift
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
            if [ -z "$1" ]; then
                echo "Missing value for --ref"
                exit 1
            fi
            REF="$1"
            shift
            ;;
        --ref=*)
            REF="${1#*=}"
            if [ -z "$REF" ]; then
                echo "Missing value for --ref"
                exit 1
            fi
            shift
            ;;
        -r)
            shift
            if [ -z "$1" ]; then
                echo "Missing value for -r"
                exit 1
            fi
            REF="$1"
            shift
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Defaults: auto-detect best mode
if [ -z "$MODE" ]; then
    if [ -d ".git" ] && [ -d "packages/coding-agent" ]; then
        # Inside the repo — use local install
        LOCAL_DIR="${LOCAL_DIR:-.}"
        MODE="local"
    elif [ -n "$REF" ]; then
        # Has a ref — use source (nodejs+git)
        MODE="source"
    else
        # No ref, no local repo — binary is safest
        MODE="binary"
    fi
fi

# -------------------------------------------------------------------
has_node() {
    command -v node >/dev/null 2>&1
}

has_bun() {
    command -v bun >/dev/null 2>&1
}

has_git() {
    command -v git >/dev/null 2>&1
}

has_git_lfs() {
    command -v git-lfs >/dev/null 2>&1
}

version_ge() {
    current="$1"
    minimum="$2"

    current_major="${current%%.*}"
    current_rest="${current#*.}"
    current_minor="${current_rest%%.*}"
    current_patch="${current_rest#*.}"
    current_patch="${current_patch%%.*}"

    minimum_major="${minimum%%.*}"
    minimum_rest="${minimum#*.}"
    minimum_minor="${minimum_rest%%.*}"
    minimum_patch="${minimum_rest#*.}"
    minimum_patch="${minimum_patch%%.*}"

    [ "$current_major" -gt "$minimum_major" ] && return 0
    [ "$current_major" -lt "$minimum_major" ] && return 1
    [ "$current_minor" -gt "$minimum_minor" ] && return 0
    [ "$current_minor" -lt "$minimum_minor" ] && return 1
    [ "$current_patch" -ge "$minimum_patch" ]
}

require_node_version() {
    version_raw=$(node --version 2>/dev/null || true)
    if [ -z "$version_raw" ]; then
        echo "Node.js is required but not found."
        echo "Install Node.js at https://nodejs.org"
        exit 1
    fi
    echo "Using Node.js: ${version_raw}"
}

install_bun() {
    echo "Installing bun..."
    if command -v bash >/dev/null 2>&1; then
        curl -fsSL https://bun.sh/install | bash
    else
        curl -fsSL https://bun.sh/install | sh
    fi
    export BUN_INSTALL="$HOME/.bun"
    export PATH="$BUN_INSTALL/bin:$PATH"
    require_bun_version
}

require_bun_version() {
    version_raw=$(bun --version 2>/dev/null || true)
    version_clean=${version_raw%%-*}
    if ! version_ge "$version_clean" "$MIN_BUN_VERSION"; then
        echo "Bun ${MIN_BUN_VERSION} or newer is required. Current version: ${version_clean}"
        echo "Upgrade Bun at https://bun.sh/docs/installation"
        exit 1
    fi
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

    echo "Creating global symlink..."
    mkdir -p "$HOME/.local/bin"
    ln -sf "$TARGET_DIR/packages/coding-agent/src/cli.ts" "$HOME/.local/bin/$BINARY_NAME"

    echo ""
    echo "✓ Installed $BINARY_NAME to ~/.local/bin/$BINARY_NAME"
    echo "Run '$BINARY_NAME' to get started!"
}

# -------------------------------------------------------------------
# Mode: source — clone git ref then install via bun or npm
# -------------------------------------------------------------------
install_via_source() {
    if ! has_git; then
        echo "git is required for --ref installs"
        exit 1
    fi

    echo "Cloning $REPO (ref: ${REF:-main})..."
    TMP_DIR="$(mktemp -d)"
    trap 'rm -rf "$TMP_DIR"' EXIT

    if ! git clone --depth 1 --branch "${REF:-main}" "https://github.com/${REPO}.git" "$TMP_DIR" 2>/dev/null; then
        git clone "https://github.com/${REPO}.git" "$TMP_DIR"
        (cd "$TMP_DIR" && git checkout "$REF")
    fi

    if has_git_lfs; then
        (cd "$TMP_DIR" && git lfs pull)
    fi

    if [ ! -d "$TMP_DIR/packages/coding-agent" ]; then
        echo "Expected package at ${TMP_DIR}/packages/coding-agent"
        exit 1
    fi

    echo "Installing dependencies..."
    bun install --prefix "$TMP_DIR" || npm install --prefix "$TMP_DIR" || {
        echo "Failed to install dependencies"
        exit 1
    }

    echo "Linking $BINARY_NAME globally..."
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
    OS="$(uname -s)"
    ARCH="$(uname -m)"

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

    # Get release tag
    if [ -n "$REF" ]; then
        echo "Fetching release $REF..."
        RELEASE_JSON=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/tags/${REF}") || {
            echo "Release tag not found: $REF"
            echo "For branch/commit installs, use --source with --ref."
            exit 1
        }
        LATEST=$(echo "$RELEASE_JSON" | grep '"tag_name"' | head -1 | sed -E 's/.*"([^"]+)".*/\1/')
    else
        echo "Fetching latest release..."
        RELEASE_JSON=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest")
        LATEST=$(echo "$RELEASE_JSON" | grep '"tag_name"' | head -1 | sed -E 's/.*"([^"]+)".*/\1/')
    fi

    if [ -z "$LATEST" ]; then
        echo "Failed to fetch release tag"
        exit 1
    fi
    echo "Using version: $LATEST"

    mkdir -p "$INSTALL_DIR"

    echo "Downloading ${BINARY}..."
    curl -fsSL "https://github.com/${REPO}/releases/download/${LATEST}/${BINARY}" \
        -o "${INSTALL_DIR}/omp-dev"
    chmod +x "${INSTALL_DIR}/omp-dev"

    # Download native addon(s)
    if [ "$ARCH" = "x64" ]; then
        for variant in modern baseline; do
            NATIVE_ADDON="pi_natives.${PLATFORM}-${ARCH}-${variant}.node"
            echo "Downloading ${NATIVE_ADDON}..."
            curl -fsSL "https://github.com/${REPO}/releases/download/${LATEST}/${NATIVE_ADDON}" \
                -o "${INSTALL_DIR}/${NATIVE_ADDON}" || {
                echo "Failed to download ${NATIVE_ADDON}"
                exit 1
            }
        done
    else
        NATIVE_ADDON="pi_natives.${PLATFORM}-${ARCH}.node"
        echo "Downloading ${NATIVE_ADDON}..."
        curl -fsSL "https://github.com/${REPO}/releases/download/${LATEST}/${NATIVE_ADDON}" \
            -o "${INSTALL_DIR}/${NATIVE_ADDON}"
    fi

    echo ""
    echo "✓ Installed $BINARY_NAME to ${INSTALL_DIR}/$BINARY_NAME"
    case ":$PATH:" in
        *":$INSTALL_DIR:"*) echo "Run '$BINARY_NAME' to get started!" ;;
        *) echo "Add ${INSTALL_DIR} to your PATH, then run '$BINARY_NAME'" ;;
    esac
}

# -------------------------------------------------------------------
# Main dispatch
# -------------------------------------------------------------------
case "$MODE" in
    local)
        install_via_local
        ;;
    source)
        if ! has_bun; then
            install_bun
        fi
        require_bun_version
        install_via_source
        ;;
    binary)
        install_binary
        ;;
    *)
        echo "Unknown mode: $MODE"
        exit 1
        ;;
esac
