#!/usr/bin/env bash
set -euo pipefail

# Get absolute path to the repository root
REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
DESKTOP_DIR="$HOME/Desktop"

echo "Configuring desktop launchers for Arch Portal..."
echo "Project Path: $REPO_ROOT"

# Function to generate launcher content
generate_launcher() {
  local name="$1"
  local comment="$2"
  local script_name="$3"
  local icon="$4"
  
  cat << EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=$name
Comment=$comment
Exec=bash -c "$REPO_ROOT/scripts/$script_name; echo ''; echo 'Press [Enter] to close this window...'; read"
Icon=$icon
Terminal=true
Categories=Network;Development;
Path=$REPO_ROOT
EOF
}

# Write launcher templates inside the project root
echo "Generating launchers in project root..."
generate_launcher "Deploy Arch Portal" "Starts the Arch-Systems local network server" "deploy-live-local.sh" "network-server" > "$REPO_ROOT/Deploy-Arch-Portal.desktop"
generate_launcher "Shutdown Arch Portal" "Safely stops the Arch-Systems local network server" "shutdown.sh" "system-shutdown" > "$REPO_ROOT/Shutdown-Arch-Portal.desktop"

chmod +x "$REPO_ROOT/Deploy-Arch-Portal.desktop" "$REPO_ROOT/Shutdown-Arch-Portal.desktop"
echo "✅ Created launcher templates in project root:"
echo "   - $REPO_ROOT/Deploy-Arch-Portal.desktop"
echo "   - $REPO_ROOT/Shutdown-Arch-Portal.desktop"

# Check if Desktop folder exists and copy them if desired
if [ -d "$DESKTOP_DIR" ]; then
  cp "$REPO_ROOT/Deploy-Arch-Portal.desktop" "$DESKTOP_DIR/"
  cp "$REPO_ROOT/Shutdown-Arch-Portal.desktop" "$DESKTOP_DIR/"
  chmod +x "$DESKTOP_DIR/Deploy-Arch-Portal.desktop" "$DESKTOP_DIR/Shutdown-Arch-Portal.desktop"
  
  # Try to trust them on GNOME desktops using gio if available
  if command -v gio >/dev/null 2>&1; then
    gio set "$DESKTOP_DIR/Deploy-Arch-Portal.desktop" metadata::trusted true 2>/dev/null || true
    gio set "$DESKTOP_DIR/Shutdown-Arch-Portal.desktop" metadata::trusted true 2>/dev/null || true
  fi
  echo "✅ Copied launchers directly to your Desktop: $DESKTOP_DIR"
fi

echo "Done! On fresh clones, simply run './setup-desktop-shortcuts.sh' to recreate the launchers."
