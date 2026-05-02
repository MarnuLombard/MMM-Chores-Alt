#!/usr/bin/env bash
# Install Apple Color Emoji font (samuelngs/apple-emoji-linux) on Raspberry Pi OS / Debian.
# Run on the Pi, not on the Mac. Requires sudo, curl.

set -euo pipefail

FONT_DIR="/usr/share/fonts/truetype/apple-emoji"
TMP_FILE="/tmp/AppleColorEmoji.ttf"

echo "==> Resolving latest release URL"
LATEST_URL=$(curl -fsSL https://api.github.com/repos/samuelngs/apple-emoji-linux/releases/latest \
  | grep "browser_download_url.*\.ttf" \
  | head -n1 \
  | cut -d '"' -f 4)

if [ -z "$LATEST_URL" ]; then
  echo "ERROR: could not find a .ttf asset in the latest release" >&2
  exit 1
fi

echo "==> Downloading $LATEST_URL"
curl -fL -o "$TMP_FILE" "$LATEST_URL"

echo "==> Installing to $FONT_DIR"
sudo mkdir -p "$FONT_DIR"
sudo mv "$TMP_FILE" "$FONT_DIR/AppleColorEmoji.ttf"

echo "==> Refreshing font cache"
sudo fc-cache -f -v >/dev/null

echo "==> Verifying registration"
if fc-list | grep -qi "apple color emoji"; then
  fc-list | grep -i "apple color emoji"
  echo
  echo "Done. Fully restart MagicMirror (e.g. 'pm2 restart MagicMirror') to pick up the font."
else
  echo "ERROR: font did not register. Check 'fc-list' output." >&2
  exit 1
fi