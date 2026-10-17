#!/bin/zsh
# Run Local kurulumu: uygulamayı /Applications'a kurar, Masaüstüne oksuz bir kısayol koyar.
set -e
DIR="${0:A:h}"
APP="/Applications/Run Local.app"

# Masaüstü kısayolu: Finder takma adı (sol altta ok) yerine, asıl uygulamayı açan küçük bir başlatıcı.
# Masaüstünden silinirse yalnız kısayol gider; uygulama Applications'ta kalır.
desktop_shortcut() { # $1 uygulama, $2 ad, $3 bundle id
  local S="$HOME/Desktop/$2.app"
  rm -rf "$S"; mkdir -p "$S/Contents/MacOS" "$S/Contents/Resources"
  cp "$1/Contents/Resources/AppIcon.icns" "$S/Contents/Resources/AppIcon.icns"
  cat > "$S/Contents/Info.plist" <<P
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleName</key><string>$2</string>
<key>CFBundleIdentifier</key><string>$3.shortcut</string>
<key>CFBundleExecutable</key><string>open</string>
<key>CFBundleIconFile</key><string>AppIcon</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>LSUIElement</key><true/>
</dict></plist>
P
  printf '#!/bin/sh\nexec /usr/bin/open "%s"\n' "$1" > "$S/Contents/MacOS/open"
  chmod +x "$S/Contents/MacOS/open"
  codesign --force -s - "$S" 2>/dev/null || true
  touch "$S"
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
<key>CFBundleIdentifier</key><string>local.runlocal.app</string>
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
desktop_shortcut "$APP" "Run Local" local.runlocal.app
echo "Hazır: Masaüstündeki Run Local'a çift tıkla (uygulama Applications'ta). / Done: double-click Run Local on your Desktop (the app lives in Applications)."
