#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_DIR="${1:-$ROOT_DIR/image-analysis/output/responsive-studio}"
PORT="${STUDIO_PREVIEW_PORT:-4173}"
LANDING_URL="http://127.0.0.1:${PORT}/"
HOW_IT_WORKS_URL="${LANDING_URL}#how-it-works"
BASE_URL="${LANDING_URL}?guest=1&modelType=humanoid%2Fchibi-v1"

find_chrome() {
  for candidate in google-chrome google-chrome-stable chromium chromium-browser; do
    if command -v "$candidate" >/dev/null 2>&1; then
      command -v "$candidate"
      return 0
    fi
  done
  echo "No supported Chrome or Chromium executable was found." >&2
  return 1
}

CHROME="$(find_chrome)"
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

pnpm --filter @low-poly-character-studio/style-studio preview --host 127.0.0.1 --port "$PORT" >"$OUTPUT_DIR/preview.log" 2>&1 &
PREVIEW_PID=$!
cleanup() {
  kill "$PREVIEW_PID" 2>/dev/null || true
  wait "$PREVIEW_PID" 2>/dev/null || true
}
trap cleanup EXIT

for _ in $(seq 1 40); do
  if curl --fail --silent "$LANDING_URL" >/dev/null; then
    break
  fi
  sleep 0.25
done
curl --fail --silent "$LANDING_URL" >/dev/null

# Exercise actual uploads/description decisions and retain their browser proof
# alongside the static responsive captures in the existing CI artifact.
PLAYWRIGHT_CHROMIUM_EXECUTABLE="$CHROME" \
  STUDIO_URL="$LANDING_URL" \
  STUDIO_E2E_EVIDENCE_DIR="$OUTPUT_DIR/upload-workflow" \
  pnpm studio:e2e:test

capture() {
  local name="$1"
  local width="$2"
  local height="$3"
  local url="$4"
  "$CHROME" \
    --headless=new \
    --no-sandbox \
    --disable-gpu \
    --hide-scrollbars \
    --run-all-compositor-stages-before-draw \
    --virtual-time-budget=2500 \
    --window-size="${width},${height}" \
    --screenshot="$OUTPUT_DIR/${name}.png" \
    "$url"
}

# Landing captures include a short-height case that approximates a 1366x768
# desktop browser after tabs, address bar, and OS chrome consume vertical space.
capture landing-1366x768 1366 768 "$LANDING_URL"
capture landing-1366x600 1366 600 "$LANDING_URL"
capture how-it-works-1366x600 1366 600 "$HOW_IT_WORKS_URL"

# guest=1 provides a deterministic CI-only deep link into the real Studio shell.
capture workspace-1366x600 1366 600 "$BASE_URL"
capture viewport-320x568 320 568 "$BASE_URL"
capture viewport-768x1024 768 1024 "$BASE_URL"
capture viewport-1024x768 1024 768 "$BASE_URL"
capture viewport-1366x768 1366 768 "$BASE_URL"
capture viewport-1920x1080 1920 1080 "$BASE_URL"
capture references-open-1366x768 1366 768 "${BASE_URL}&references=open"

python3 - "$OUTPUT_DIR" <<'PY'
import json
import struct
import sys
from pathlib import Path

output = Path(sys.argv[1])
expected = {
    "landing-1366x768.png": (1366, 768),
    "landing-1366x600.png": (1366, 600),
    "how-it-works-1366x600.png": (1366, 600),
    "workspace-1366x600.png": (1366, 600),
    "viewport-320x568.png": (320, 568),
    "viewport-768x1024.png": (768, 1024),
    "viewport-1024x768.png": (1024, 768),
    "viewport-1366x768.png": (1366, 768),
    "viewport-1920x1080.png": (1920, 1080),
    "references-open-1366x768.png": (1366, 768),
}
for name, dimensions in expected.items():
    path = output / name
    if not path.is_file() or path.stat().st_size == 0:
        raise SystemExit(f"Missing responsive screenshot: {path}")
    raw = path.read_bytes()
    if raw[:8] != b"\x89PNG\r\n\x1a\n":
        raise SystemExit(f"Responsive screenshot is not a PNG: {path}")
    width, height = struct.unpack(">II", raw[16:24])
    if (width, height) != dimensions:
        raise SystemExit(f"Unexpected screenshot dimensions for {name}: {(width, height)} != {dimensions}")

manifest = {
    "schema": "responsive-studio-review/v1",
    "modelType": "humanoid/chibi-v1",
    "defaultReferenceState": "collapsed",
    "screenshots": [
        {"file": name, "width": dimensions[0], "height": dimensions[1]}
        for name, dimensions in expected.items()
    ],
    "limitations": [
        "Automated screenshots verify rendered states and exact viewport dimensions.",
        "landing/how-it-works/workspace 1366x600 captures approximate a 1366x768 desktop browser after browser and OS chrome consume vertical space.",
        "The deterministic guest route captures the real Studio shell before user-specific reference state is added.",
        "Human review remains required for visual hierarchy, interaction, marker placement, keyboard access, and browser zoom acceptance.",
    ],
}
(output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
PY

echo "Responsive Studio screenshots written to $OUTPUT_DIR"
