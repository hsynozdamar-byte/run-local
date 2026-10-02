#!/bin/zsh
# Run Local kurulumu: Masaüstüne "Run Local.app" koyar.
set -e
DIR="${0:A:h}"
APP="$HOME/Desktop/Run Local.app"

if ! command -v node >/dev/null && ! ls -d $HOME/.nvm/versions/node/*/bin/node >/dev/null 2>&1; then
  echo "Node.js bulunamadı. Önce https://nodejs.org adresinden kur. / Node.js not found, install it first."; exit 1
fi

rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$DIR/icon/RunLocal.icns" "$APP/Contents/Resources/AppIcon.icns"
cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleName</key><string>Run Local</string>
<key>CFBundleDisplayName</key><string>Run Local</string>
<key>CFBundleIdentifier</key><string>local.runlocal.launcher</string>
<key>CFBundleExecutable</key><string>RunLocal</string>
<key>CFBundleIconFile</key><string>AppIcon</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>1.0</string>
<key>LSUIElement</key><true/>
</dict></plist>
PLIST
cat > "$APP/Contents/MacOS/RunLocal" <<SH
#!/bin/zsh
# Finder'dan açılınca PATH boş gelir; node, bun, pnpm yollarını ekle.
NVM_NODE=\$(ls -d \$HOME/.nvm/versions/node/*/bin 2>/dev/null | tail -1)
export PATH="\$HOME/.local/bin:\$HOME/.bun/bin:\$HOME/.volta/bin:\$HOME/Library/pnpm:\$NVM_NODE:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin"
exec "$DIR/bin/runlocal"
SH
chmod +x "$APP/Contents/MacOS/RunLocal"
touch "$APP"
echo "Hazır: Masaüstündeki Run Local'a çift tıkla. / Done: double-click Run Local on your Desktop."
