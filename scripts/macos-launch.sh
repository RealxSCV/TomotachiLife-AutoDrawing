#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_URL="http://127.0.0.1:4307"
PLATFORMIO_BIN_PATH=""

print_step() {
  printf '\n[%s] %s\n' "Friend Maker" "$1"
}

fail_with_message() {
  echo
  echo "$1"
  echo
  read -r -p "Press Enter to close..."
  exit 1
}

confirm_install() {
  local prompt="$1"
  local answer=""
  read -r -p "$prompt [Y/n] " answer || true
  case "${answer:-Y}" in
    [Yy]|[Yy][Ee][Ss]|"")
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

refresh_shell_path() {
  if [ -x /opt/homebrew/bin/brew ]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  elif [ -x /usr/local/bin/brew ]; then
    eval "$(/usr/local/bin/brew shellenv)"
  fi

  local py_user_bin=""
  if command -v python3 >/dev/null 2>&1; then
    py_user_bin="$(python3 - <<'PY'
import site
print(site.USER_BASE + "/bin")
PY
)"
  fi

  export PATH="$HOME/.local/bin:${py_user_bin}:$PATH"
}

ensure_homebrew() {
  refresh_shell_path
  if command -v brew >/dev/null 2>&1; then
    return 0
  fi

  if ! confirm_install "Homebrew is not installed. Install it automatically now?"; then
    fail_with_message "Homebrew is required to auto-install missing software. Please install Homebrew first."
  fi

  print_step "Installing Homebrew..."
  NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  refresh_shell_path

  if ! command -v brew >/dev/null 2>&1; then
    fail_with_message "Homebrew installation finished, but brew is still not available in PATH."
  fi
}

ensure_node_and_npm() {
  refresh_shell_path
  if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
    return 0
  fi

  ensure_homebrew
  print_step "Installing Node.js and npm with Homebrew..."
  brew install node
  refresh_shell_path

  if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
    fail_with_message "Node.js or npm is still unavailable after installation."
  fi
}

ensure_python3() {
  refresh_shell_path
  if command -v python3 >/dev/null 2>&1; then
    return 0
  fi

  ensure_homebrew
  print_step "Installing Python 3 with Homebrew..."
  brew install python
  refresh_shell_path

  if ! command -v python3 >/dev/null 2>&1; then
    fail_with_message "Python 3 is still unavailable after installation."
  fi
}

find_platformio_bin() {
  if command -v pio >/dev/null 2>&1; then
    command -v pio
    return 0
  fi

  if command -v platformio >/dev/null 2>&1; then
    command -v platformio
    return 0
  fi

  local candidates=(
    "$HOME/.platformio/penv/bin/pio"
    "$HOME/.local/bin/pio"
  )

  local candidate=""
  for candidate in "${candidates[@]}"; do
    if [ -x "$candidate" ]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  local glob_candidate=""
  shopt -s nullglob
  for glob_candidate in "$HOME"/Library/Python/*/bin/pio "$HOME"/Library/Python/*/bin/platformio; do
    if [ -x "$glob_candidate" ]; then
      printf '%s\n' "$glob_candidate"
      shopt -u nullglob
      return 0
    fi
  done
  shopt -u nullglob

  return 1
}

ensure_platformio() {
  refresh_shell_path
  if PLATFORMIO_BIN_PATH="$(find_platformio_bin)"; then
    export PLATFORMIO_BIN="$PLATFORMIO_BIN_PATH"
    return 0
  fi

  ensure_python3
  print_step "Installing PlatformIO..."
  python3 -m ensurepip --upgrade >/dev/null 2>&1 || true
  python3 -m pip install --user --upgrade platformio
  refresh_shell_path

  if ! PLATFORMIO_BIN_PATH="$(find_platformio_bin)"; then
    fail_with_message "PlatformIO installation finished, but no pio/platformio executable was found."
  fi

  export PLATFORMIO_BIN="$PLATFORMIO_BIN_PATH"
}

ensure_node_and_npm
ensure_platformio

cd "$ROOT_DIR"

print_step "Project directory: $ROOT_DIR"
print_step "Node.js: $(node -v)"
print_step "npm: $(npm -v)"
print_step "PlatformIO: $PLATFORMIO_BIN_PATH"

if [ ! -d node_modules ] || [ package-lock.json -nt node_modules ] || [ package.json -nt node_modules ]; then
  print_step "Installing project dependencies..."
  npm install
else
  print_step "Dependencies already installed."
fi

if lsof -iTCP:4307 -sTCP:LISTEN >/dev/null 2>&1; then
  print_step "Friend Maker is already running. Opening browser..."
  open "$APP_URL"
  exit 0
fi

print_step "Starting local web UI..."

(
  for _ in $(seq 1 60); do
    if curl -fsS "$APP_URL" >/dev/null 2>&1; then
      open "$APP_URL"
      exit 0
    fi
    sleep 1
  done
  echo
  echo "Friend Maker started, but the browser did not open automatically."
  echo "Please open $APP_URL manually."
) &

echo "The browser will open automatically when the UI is ready."
echo "Keep this Terminal window open while drawing."
echo

npm run ui:dev
