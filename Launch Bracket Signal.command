#!/bin/zsh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
PORT="${PORT:-3000}"
RUNTIME_DIR="/tmp/bracketsignal-runtime"
RUNTIME_NODE="$RUNTIME_DIR/node_modules/node/bin/node"
RAW_DIR="$ROOT/data/raw"
DATA_VENV="$ROOT/.venv-data"
DATA_PYTHON="$DATA_VENV/bin/python"
REQUIRED_RAW_FILES=(
  "MTeams.csv"
  "MNCAATourneySeeds.csv"
  "MNCAATourneyDetailedResults.csv"
  "MRegularSeasonDetailedResults.csv"
  "MMasseyOrdinals.csv"
)

cd "$ROOT"

install_runtime() {
  npm install --prefix "$RUNTIME_DIR" node@22 --no-audit --fund=false
}

resolve_node() {
  if [ -x "/opt/homebrew/opt/node@22/bin/node" ]; then
    echo "/opt/homebrew/opt/node@22/bin/node"
    return
  fi

  if [ -x "$RUNTIME_NODE" ]; then
    echo "$RUNTIME_NODE"
    return
  fi

  echo "Installing local Node 22 runtime into $RUNTIME_DIR ..."
  install_runtime
  echo "$RUNTIME_NODE"
}

NODE_BIN="$(resolve_node)"

ensure_data_python() {
  if [ -x "$DATA_PYTHON" ]; then
    echo "$DATA_PYTHON"
    return
  fi

  if command -v python3.12 >/dev/null 2>&1; then
    echo "Creating data virtualenv with python3.12 ..."
    python3.12 -m venv "$DATA_VENV"
  else
    echo "Creating data virtualenv with python3 ..."
    python3 -m venv "$DATA_VENV"
  fi

  echo "Installing Python data dependencies ..."
  "$DATA_PYTHON" -m pip install -r "$ROOT/scripts/requirements.txt"
  echo "$DATA_PYTHON"
}

DATA_PYTHON_BIN="$(ensure_data_python)"

missing_raw_files=()
for filename in "${REQUIRED_RAW_FILES[@]}"; do
  if [ ! -f "$RAW_DIR/$filename" ]; then
    missing_raw_files+=("$filename")
  fi
done

if [ ! -d "$ROOT/node_modules/next" ]; then
  echo "Installing project dependencies ..."
  npm install --include=dev --no-audit --fund=false
fi

if [ "${#missing_raw_files[@]}" -gt 0 ]; then
  echo
  echo "Warning: full historical raw data is missing."
  echo "The site will launch with the 3-game starter dataset until these files exist in $RAW_DIR:"
  for filename in "${missing_raw_files[@]}"; do
    echo "  - $filename"
  done
  echo
  echo "To load the full Kaggle-backed dataset:"
  echo "  cd \"$ROOT\""
  echo "  \"$DATA_PYTHON_BIN\" scripts/fetch_kaggle_data.py"
  echo "  \"$DATA_PYTHON_BIN\" scripts/build_dataset.py"
  echo
fi

echo "Building dataset ..."
"$DATA_PYTHON_BIN" scripts/build_dataset.py

echo "Using Node runtime: $("$NODE_BIN" -v)"
echo "Starting dev server on http://localhost:$PORT ..."
(
  exec "$NODE_BIN" ./node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port "$PORT"
) &

SERVER_PID=$!

cleanup() {
  if kill -0 "$SERVER_PID" >/dev/null 2>&1; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT INT TERM

for _ in {1..60}; do
  if curl -fsS "http://127.0.0.1:$PORT" >/dev/null 2>&1; then
    open "http://127.0.0.1:$PORT"
    echo "Bracket Signal is running. Keep this window open while you use the app."
    wait "$SERVER_PID"
    exit 0
  fi
  sleep 1
done

echo "The dev server did not become ready in time."
exit 1
