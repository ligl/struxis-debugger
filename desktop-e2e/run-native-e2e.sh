#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
CRATE_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd -- "$CRATE_DIR/../.." && pwd)"
APP_BINARY="$REPO_ROOT/target/debug/capitus-struxis-debugger"

# Ubuntu's webkit2gtk-driver package provides the WebKitWebDriver executable;
# the package name itself is not a command.
if command -v WebKitWebDriver >/dev/null 2>&1; then
  WEBKIT_WEBDRIVER="$(command -v WebKitWebDriver)"
elif command -v webkit2gtk-driver >/dev/null 2>&1; then
  # Keep compatibility with distributions that expose the package-name command.
  WEBKIT_WEBDRIVER="$(command -v webkit2gtk-driver)"
else
  echo "ERROR: WebKitWebDriver is required for native Tauri E2E on Ubuntu."
  echo "Install it with: sudo apt-get install webkit2gtk-driver"
  exit 2
fi
export WEBKIT_WEBDRIVER

if ! command -v bun >/dev/null 2>&1; then
  echo "ERROR: Bun is required to install and run the desktop E2E dependencies."
  exit 2
fi

# Ensure the project-local WebdriverIO CLI exists before spending time on a native build.
# Running this from the harness directory keeps dependencies isolated from the frontend.
echo "==> Installing desktop E2E dependencies"
(
  cd "$SCRIPT_DIR"
  bun install
)
if [[ ! -x "$SCRIPT_DIR/node_modules/.bin/wdio" ]]; then
  echo "ERROR: WebdriverIO CLI was not installed at $SCRIPT_DIR/node_modules/.bin/wdio"
  exit 2
fi

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: Node.js 18.20 or later is required by WebdriverIO."
  exit 2
fi
if ! node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit(major > 18 || (major === 18 && minor >= 20) ? 0 : 1)'; then
  echo "ERROR: Node.js 18.20 or later is required by WebdriverIO."
  exit 2
fi

if ! command -v cargo >/dev/null 2>&1 || ! cargo tauri --version >/dev/null 2>&1; then
  echo "ERROR: Tauri CLI 2.x is required (cargo tauri --version)."
  exit 2
fi

echo "==> Building the real Tauri application (debug, no bundle)"
(
  cd "$CRATE_DIR"
  cargo tauri build --debug --no-bundle
)

if [[ ! -x "$APP_BINARY" ]]; then
  echo "ERROR: expected native application binary was not produced: $APP_BINARY"
  exit 2
fi
APP_BINARY="$(readlink -f "$APP_BINARY")"

list_app_pids() {
  local proc pid executable
  for proc in /proc/[0-9]*; do
    [[ -e "$proc/exe" ]] || continue
    pid="${proc##*/}"
    executable="$(readlink -f "$proc/exe" 2>/dev/null || true)"
    if [[ "$executable" == "$APP_BINARY" ]]; then
      printf '%s\n' "$pid"
    fi
  done | sort -n
}

before_pids="$(list_app_pids)"
if [[ -n "$before_pids" ]]; then
  echo "ERROR: a Debugger process using this build is already running:"
  echo "$before_pids"
  echo "Close that instance before running native E2E so teardown can be verified."
  exit 2
fi

echo "==> Running WebdriverIO against the native Tauri window"
if (cd "$SCRIPT_DIR" && bun run test:wdio); then
  test_status=0
else
  test_status=$?
fi

echo "==> Verifying the test-launched application exited"
remaining_pids=""
for _ in {1..20}; do
  remaining_pids="$(list_app_pids)"
  [[ -z "$remaining_pids" ]] && break
  sleep 0.25
done

if [[ -n "$remaining_pids" ]]; then
  echo "ERROR: native Debugger process(es) remain after WebdriverIO teardown:"
  echo "$remaining_pids"
  exit 1
fi

if [[ "$test_status" -ne 0 ]]; then
  exit "$test_status"
fi

echo "PASS: WebdriverIO completed and the native Debugger process exited."
