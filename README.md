# Run Local

Bilgisayarındaki projeleri ikonlarıyla tek ekranda gösterir; tıklayınca çalıştırır ve tarayıcıda açar. macOS için.

Shows the projects on your Mac in one grid with their icons; click one to start it and open it in the browser.

![icon](icon/icon-1024.png)

## Kurulum / Install

Gerekenler / Requires: macOS, [Node.js](https://nodejs.org) 18+.

```sh
git clone https://github.com/hsynozdamar-byte/run-local.git ~/Developer/run-local
~/Developer/run-local/install.sh
```

Masaüstüne **Run Local** gelir; çift tıkla. / A **Run Local** app appears on your Desktop; double-click it.

## Ne yapar / What it does

- `~/Developer`, `~/Projects`, `~/code` gibi klasörleri iki seviye derinliğe kadar tarar. / Scans common project folders two levels deep.
- Next, Vite, Remotion, Node (`dev`/`start` script), statik `index.html` ve Xcode projelerini tanır. / Recognizes Next, Vite, Remotion, Node, static sites and Xcode projects.
- npm, pnpm veya bun'ı kilit dosyasından seçer; paketler yoksa önce kurar. / Picks npm/pnpm/bun from the lockfile and installs packages first if needed.
- Başka yerden açılmış sunucuları da gösterir; Durdur tüm süreç ağacını kapatır. / Also shows servers started elsewhere; Stop kills the whole process tree.
- ⋯ menüsü: klasör, editörde aç, log, yeniden adlandır, gizle, yenile. / ⋯ menu: folder, open in editor, log, rename, hide, refresh.

## Ayarlar / Settings

İlk açılışta `state.json` oluşur (git'e girmez). / `state.json` is created on first run (not committed).

```json
{
  "roots": ["/Users/sen/Developer"],
  "extra": ["/Users/sen/Downloads/tek-proje"],
  "hidden": [],
  "names": { "~/Developer/my-app": "My App" }
}
```

Klasörleri panelden **Klasörler** düğmesiyle ekleyip çıkarabilirsin; `roots` taranan klasörler, `extra` tek tek eklenen projeler. / Add or remove folders from the **Klasörler** button in the panel.



Panel yalnızca `127.0.0.1:4888` üzerinde dinler; ağdan erişilemez. / The panel only listens on localhost.
