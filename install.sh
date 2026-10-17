#!/bin/zsh
# Run Local kurulumu: uygulamayı /Applications'a kurar, Masaüstüne kısayol koyar.
set -e
DIR="${0:A:h}"
APP="/Applications/Run Local.app"

# Masaüstü kısayolu: Finder takma adı. Silinirse yalnız kısayol gider; uygulama Applications'ta kalır.
desktop_shortcut() { # $1 uygulama, $2 ad
  rm -rf "$HOME/Desktop/$2" "$HOME/Desktop/$2.app"
  osascript -e "tell application \"Finder\" to make new alias file to (POSIX file \"$1\") at desktop with properties {name:\"$2\"}" >/dev/null
}

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
<key>CFBundleIdentifier</key><string>local.runlocal</string>
<key>CFBundleExecutable</key><string>RunLocal</string>
<key>CFBundleIconFile</key><string>AppIcon</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>2.0</string>
<key>LSMinimumSystemVersion</key><string>12.0</string>
<key>NSHighResolutionCapable</key><true/>
<key>NSAppTransportSecurity</key><dict><key>NSAllowsLocalNetworking</key><true/></dict>
<key>RLRepoDir</key><string>$DIR</string>
</dict></plist>
PLIST
if command -v swiftc >/dev/null; then
  # Yerel Mac uygulaması: panel kendi penceresinde açılır, tarayıcı gerekmez.
  swiftc -O -o "$APP/Contents/MacOS/RunLocal" "$DIR/mac/RunLocal.swift"
else
  # swiftc yoksa (Xcode Command Line Tools kurulu değil) Chrome uygulama penceresine düş.
  cat > "$APP/Contents/MacOS/RunLocal" <<SH
#!/bin/zsh
# Finder'dan açılınca PATH boş gelir; node, bun, pnpm yollarını ekle.
NVM_NODE=\$(ls -d \$HOME/.nvm/versions/node/*/bin 2>/dev/null | tail -1)
export PATH="\$HOME/.local/bin:\$HOME/.bun/bin:\$HOME/.volta/bin:\$HOME/Library/pnpm:\$NVM_NODE:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin"
exec "$DIR/bin/runlocal"
SH
  /usr/libexec/PlistBuddy -c "Add :LSUIElement bool true" "$APP/Contents/Info.plist"
fi
chmod +x "$APP/Contents/MacOS/RunLocal"
codesign --force -s - "$APP" 2>/dev/null || true
touch "$APP"
desktop_shortcut "$APP" "Run Local"
echo "Hazır: Masaüstündeki Run Local'a çift tıkla (uygulama Applications'ta). / Done: double-click Run Local on your Desktop (the app lives in Applications)."
