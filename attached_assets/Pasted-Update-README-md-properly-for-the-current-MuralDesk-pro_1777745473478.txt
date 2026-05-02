Update README.md properly for the current MuralDesk project.

Do not modify app code.
Do not modify package.json.
Do not touch Electron, storage, click-through, overlay, backup, service worker, or dependencies.

Goal:
Make README.md buildathon-ready, honest, clear, and polished.

README should include:

1. Project title
# MuralDesk

2. Short tagline
MuralDesk turns your desktop into a local-first visual mural layer where images, videos, links, and notes can live freely without becoming another messy app window.

3. What it is
Explain that MuralDesk is a desktop visual mural/canvas app.
It lets users pin images, videos, YouTube links, direct media links, web links, and notes onto a clean transparent desktop-style workspace.

4. Why it exists
Problem:
People use messy browser tabs, folders, screenshots, second monitors, and random windows to keep visual references around.

Solution:
MuralDesk gives them a clean local-first desktop mural layer for visual reference, ambient media, inspiration boards, and workspace memory.

5. Core features
Include:
- Transparent Electron desktop overlay
- Click-through empty areas
- Full-display Desktop Mode
- Drag and resize items
- Hover-only controls
- Lock / duplicate / delete
- Images
- Videos
- Notes
- Smart links:
  - YouTube embeds
  - Direct video links
  - Direct image links
  - Normal web links
- YouTube interact mode
- Local-first persistence
- Export/import layout
- Portable backup export/import if implemented
- PWA/web version
- System tray if implemented
- No login
- No backend
- No cloud storage

6. Desktop mode explanation
Explain clearly:
- Electron version can run as a transparent frameless overlay.
- Empty transparent areas can click through to desktop/apps behind it.
- Items remain interactive.
- Desktop Mode expands the overlay to the display so items can move freely across it.
- Toolbar hides until needed.

7. Storage explanation
Be specific:
- Layout and item metadata are stored locally.
- Uploaded media blobs are stored in IndexedDB.
- Layout/state uses localStorage.
- No account required.
- No backend.
- No cloud sync.

8. Smart link behavior
Explain:
- YouTube URLs become embedded playable cards.
- Direct image URLs become image cards.
- Direct video URLs become playable video cards.
- Normal websites become link cards with Open button.
- Unsafe protocols are blocked.

9. Tech stack
Include:
- React
- Vite
- Electron
- react-rnd
- IndexedDB
- localStorage
- PWA manifest/service worker

10. How to run web version
Use actual scripts from package.json:
npm install
npm run dev:web

11. How to run desktop version
npm install
npm run dev:desktop

Mention:
Electron desktop mode must be run on a real desktop OS.
Replit cannot run Electron because its container lacks GUI/GTK/Chromium system libraries.

12. How to build web
npm run build:web

13. How to build Windows desktop app
npm run build:desktop

Expected output:
release/MuralDesk-Setup-0.1.0.exe
release/win-unpacked/MuralDesk.exe

14. Demo flow
Add a short demo section:
- Launch MuralDesk
- Add sample board
- Add image/video/note/link
- Drag/resize across desktop
- Hover to reveal controls
- Paste YouTube link and interact
- Show click-through transparent area
- Export backup

15. Current limitations
Be honest:
- Not a full wallpaper engine yet
- Windows build is unsigned, so SmartScreen may warn
- Electron desktop build must be tested on Windows/macOS/Linux, not Replit
- Multi-monitor support may be limited/basic
- No cloud sync yet

16. Roadmap
Include:
- Better multi-monitor support
- Per-monitor overlay windows
- Snap guides
- More layout tools
- Startup launch
- Theme controls
- More embed types
- Wallpaper-layer experiments

17. License
Use:
Released under the MIT License — see LICENSE.

Rules:
- Remove any outdated line saying a license will be added later.
- Do not claim full wallpaper-engine support.
- Do not claim full multi-monitor support unless already implemented.
- Do not claim cloud sync.
- Keep tone professional, clear, and buildathon-friendly.
- Keep README readable, not too long.
- After editing, report exact README sections changed.