# MuralDesk — Screenshot Checklist

This is the capture list for buildathon submission assets. Every screenshot below has a single **purpose** (the one thing the image must prove), a **suggested filename**, a **caption** (one sentence, judge-friendly), and a **what NOT to show** note so we don't accidentally leak personal data, scratch files, or inconsistent branding.

All screenshots should be saved to `docs/screenshots/` at native resolution (no upscaling — judges will zoom in). Use PNG for UI captures (lossless, sharp text); use JPG only if a single capture exceeds ~5 MB.

**Universal "do not show" rules** (apply to every screenshot below):

- No personal photos, real names, real email addresses, work-in-progress documents, NDA-covered material, or anything from a non-public reference. Use the built-in **Sample Board** (`✨ Sample` in the toolbar) for stand-in content — it ships with neutral, public-domain-style placeholders.
- No browser extensions or autofill popovers. Capture in a clean profile or hide them.
- No Replit workspace chrome, Vite HMR overlay, or DevTools panels (unless explicitly part of the shot).
- No filenames in the OS taskbar that reveal sensitive paths (`Downloads/MyClient_NDA.pdf` etc.).
- Always run a fresh `npm run build:web && npm run dev:desktop` before capturing — old HMR state can leak stale UI into the shot.

---

## 1 · Empty transparent overlay with only toolbar visible

**Purpose** — Prove the window is actually transparent: with zero items pinned, only the toolbar is visible and you can see the OS desktop straight through the window.

**Suggested filename** — `01-empty-overlay.png`

**Suggested caption** — *"With no items pinned, MuralDesk's window is fully transparent — only the toolbar renders. Your desktop wallpaper shows through unchanged."*

**Capture setup**:
- Electron build (`npm run dev:desktop`).
- Empty board (`🗑 Clear` first if needed).
- Desktop wallpaper that is *visually distinctive* — gradient, photo, or pattern — so the transparency is obvious. Solid black hides the proof.
- A folder window or a couple of desktop icons visible on the wallpaper underneath, to make it unmistakable that this is the OS desktop, not a fake background.

**What NOT to show** — desktop icons named after real clients / projects; the empty-state hero card (this shot is about the *window* being empty, not the empty-state UI — see screenshot #2 if you also want the hero).

---

## 2 · Sample mural on desktop

**Purpose** — Prove the app actually does what it advertises: a real mural of mixed media types floating over the desktop.

**Suggested filename** — `02-sample-mural.png`

**Suggested caption** — *"One click on `✨ Sample` populates a mural of images, looping videos, embedded YouTube, links, and notes — arranged across the desktop without a window frame in sight."*

**Capture setup**:
- Electron build, fullscreen window (not Desktop Canvas Mode — see #7 for that).
- Click `✨ Sample` to populate the sample board, then nudge a couple of cards apart so nothing overlaps awkwardly.
- Desktop wallpaper visible at the edges so the overlay context is obvious.
- Capture the *whole* display, not just the window region — the absence of a visible window frame is part of the story.

**What NOT to show** — your real production mural with personal references; cards stacked on top of each other (looks cluttered, judges parse it as broken).

---

## 3 · Each card type — image, video, note, link

**Purpose** — Prove the four core item types render correctly and look intentional. Either four separate shots or one composite.

**Suggested filenames**:
- `03a-card-image.png`
- `03b-card-video.png`
- `03c-card-note.png`
- `03d-card-link.png`
- *or* `03-card-types-composite.png` for a single grid

**Suggested captions**:
- *"Image card — drag-and-drop a local file or paste an image URL."*
- *"Video card — looping muted by default, hover for mute / loop / interact toggles."*
- *"Note card — editable text with a quiet color palette."*
- *"Link card — auto-classified web preview with favicon, title, and description."*

**Capture setup**:
- One card per type, isolated against the transparent overlay so each card's chrome is the focal point.
- Use neutral, public sample content: a stock landscape image, a public-domain ambient clip, a Lorem-ipsum-style note ("things to revisit on Friday"), a link to a public site like https://en.wikipedia.org with its real Wikipedia favicon.
- Capture each card large enough that the rounded corners, hover state, and label are legible at submission resolution.

**What NOT to show** — broken-image placeholders, "Loading…" link previews that haven't finished fetching, real personal photos, or any URL that reveals workplace tooling (internal Notion / Confluence / GitHub).

---

## 4 · Hover controls visible

**Purpose** — Prove the per-item polish is real: opacity slider, fit toggle, lock, duplicate, delete are all there and not hidden behind a settings menu.

**Suggested filename** — `04-hover-controls.png`

**Suggested caption** — *"Hover any card to reveal a compact mini-toolbar — opacity slider, object-fit toggle, lock, duplicate, delete. No settings panel, no right-click menu to memorize."*

**Capture setup**:
- An image card with the hover mini-toolbar fully revealed (give the hover animation ~300 ms to fully fade in).
- Drop the opacity to ~50% in the *same shot* if possible, so the "opacity actually does something" point is visible — the card behind is partially see-through.
- The mini-toolbar's top-right "✕" delete button should be clearly visible at the card's top edge.

**What NOT to show** — the cursor mid-drag (looks broken in a still); two cards with overlapping hover states (only one card can be hovered at a time, so this would look fake).

---

## 5 · YouTube embed in interact mode

**Purpose** — Prove the smart-link classifier promotes a YouTube URL to a real embedded player, *and* that the "Interact" mode lets the native player work (so it isn't just a static thumbnail).

**Suggested filename** — `05-youtube-interact.png`

**Suggested caption** — *"Paste a YouTube URL — MuralDesk auto-promotes it to an embedded player. Toggle Interact to enable the native player controls; toggle off to drag the card around without accidentally pausing playback."*

**Capture setup**:
- Use a clearly-public, brand-safe video — official launch trailers, NASA / Blender Foundation / Big Buck Bunny, or your own public channel. Avoid copyrighted music videos in screenshots.
- Capture with the embed *playing*, in Interact mode (the toolbar's Interact toggle visibly active), with the YouTube progress bar showing some elapsed time so it's obviously not a still.
- Keep one or two non-YouTube cards visible in the background so this reads as "one card type among many," not the whole app.

**What NOT to show** — videos with copyrighted thumbnails of real artists, anything age-restricted, ads (pause until they're gone), or the YouTube "watch on YouTube" overlay (start playback first to dismiss it).

---

## 6 · Click-through explanation

**Purpose** — Prove the most subtle, hardest-to-photograph feature: empty space in the MuralDesk window passes mouse events to the apps underneath.

This one is *hard* to convey in a still — it is fundamentally a video moment. Two options:

**Option A — Annotated still.** A composite screenshot with arrows and labels.

- **Suggested filename** — `06-click-through-annotated.png`
- **Suggested caption** — *"Empty space in the MuralDesk window forwards mouse events to the apps underneath via Electron's `setIgnoreMouseEvents`. The cursor (a) is hovering over a button in the file manager *behind* MuralDesk and clicking it works — without minimizing the mural."*
- **Setup** — Capture the desktop with MuralDesk overlay containing a few cards, plus a visibly-active app underneath (Finder / File Explorer / a text editor) where the cursor is mid-hover over a button in *that* app, not over a MuralDesk card. Use an image editor afterward to add a labeled arrow pointing at the cursor and a callout saying "cursor is on Finder button, click works through".

**Option B — Short looping GIF/MP4 clip.** Recommended if your submission allows attachments.

- **Suggested filename** — `06-click-through-demo.gif` (or `.mp4`)
- **Setup** — Record ~5 seconds: cursor moves over a MuralDesk card (drag handle appears, card highlights), then moves to empty space (cursor passes through cleanly to a button in the app underneath, that button's hover state activates). Loop.

**What NOT to show** — a still that just shows two windows overlapping. Without an annotation or a video, this feature doesn't read; do not ship an unlabeled still and hope for the best.

---

## 7 · Desktop Canvas Mode — full-display

**Purpose** — Prove that `Ctrl/Cmd+Shift+F` (or the toolbar button) takes the mural fullscreen with the toolbar tucked into a thin reveal-zone, turning the entire display into the mural surface.

**Suggested filename** — `07-desktop-canvas-mode.png`

**Suggested caption** — *"Desktop Canvas Mode takes the mural fullscreen. The toolbar tucks into a thin reveal-zone at the top of the screen and reappears on hover — your whole display is the surface."*

**Capture setup**:
- Press `Ctrl/Cmd+Shift+F` to enter Desktop Canvas Mode after pinning a moderately full sample mural.
- Capture the *entire* display (not just a window — the whole point is no window). Use the OS-level full-screen capture (`PrtScn` on Windows, `Cmd+Shift+3` on macOS).
- Take **two variants** if space allows:
  - `07a-desktop-canvas-toolbar-hidden.png` — toolbar tucked away, mural fully present, no UI chrome at the top.
  - `07b-desktop-canvas-toolbar-revealed.png` — cursor at the top edge, toolbar revealed, showing the user can still control the app.

**What NOT to show** — taskbar / dock with private app icons (Slack, internal tools); browser bookmarks bar (if web-PWA fullscreen is captured); other monitors visible (this is meant to look immersive, not multi-monitor).

---

## 8 · Web / PWA version

**Purpose** — Prove MuralDesk also works as a real, installable PWA in the browser — not just an Electron app.

**Suggested filenames**:
- `08a-pwa-in-browser.png` — running in a browser tab
- `08b-pwa-install-prompt.png` — the browser's "Install app" dialog visible
- `08c-pwa-installed-app-window.png` — the installed PWA running in its own standalone window with the OS task-switcher showing the branded icon

**Suggested captions**:
- *"MuralDesk runs unchanged in any modern browser as a Progressive Web App."*
- *"Installable in Chrome / Edge / Safari via the browser's native Install prompt — no app store, no extension."*
- *"Once installed, MuralDesk runs in its own standalone window with the branded icon in the OS task-switcher."*

**Capture setup**:
- 8a: Open the deployed PWA in Chrome, fully populated sample mural, browser address bar visible (proves it's the web version), browser tab favicon clearly the MuralDesk icon.
- 8b: Click the install icon in the address bar, capture with the install confirmation dialog showing the app name and icon.
- 8c: Use the installed PWA — `Alt+Tab` (or `Cmd+Tab`) until the MuralDesk icon is visibly highlighted in the task-switcher, capture that overlay.

**What NOT to show** — DevTools open; HTTP (not HTTPS) URLs (PWA needs HTTPS, an `http://` URL in the bar undercuts the "real PWA" claim); browser extensions cluttering the toolbar.

---

## 9 · Windows installer / installed app

**Purpose** — Prove there's a real `.exe` and that it installs to a real Windows machine and runs from the Start Menu like any other desktop app.

**Suggested filenames**:
- `09a-installer.png` — NSIS installer first screen
- `09b-installed-start-menu.png` — Start Menu / search showing MuralDesk with the branded icon
- `09c-installed-running.png` — the installed app running, with the branded icon in the taskbar

**Suggested captions**:
- *"NSIS installer (`MuralDesk-Setup-0.1.0.exe`) — built via `npm run build:desktop`, ~80 MB, includes desktop and Start Menu shortcuts."*
- *"After install, MuralDesk shows up in the Start Menu and Windows search with its branded icon."*
- *"The installed app runs identically to the dev build — same transparent overlay, same Desktop Canvas Mode, same tray integration."*

**Capture setup**:
- 9a: Run the unsigned installer; capture the first wizard screen with the MuralDesk title bar icon visible. **Important**: also capture the SmartScreen warning that precedes it as a *separate* screenshot if you want to be transparent — see "Bonus shots" below.
- 9b: Open Start Menu, type "MuralDesk", capture the search result with the icon and "App" label.
- 9c: Launch the installed app, pin a sample mural, hover over the taskbar to show the icon and tooltip.

**What NOT to show** — installer warnings tied to an antivirus product (could read as a false positive accusation against that product); the SmartScreen "Don't run" button being clicked (looks like the app failed); installer paths revealing a personal username (`C:\Users\johndoe\…`) — install to `C:\Program Files\MuralDesk\` if possible to keep paths clean.

---

## Bonus shots (recommended if time allows)

These aren't on your numbered list but are high-leverage for a buildathon — they preempt the questions judges ask first.

### 10 · System tray menu

**Filename** — `10-tray-menu.png`
**Caption** — *"Closing the window hides MuralDesk to the system tray; the tray menu has Show, Toggle Desktop Mode, and Quit."*
**Proves** — the tray feature actually exists and the menu is sensible.
**Setup** — right-click the tray icon, capture the menu open. Ensure the tray icon itself is clearly visible and not covered by the menu.

### 11 · Backup file on disk + import flow

**Filename** — `11-backup-roundtrip.png`
**Caption** — *"One-click `📦 Backup` exports a single `.muraldesk.json` file with media base64-inlined — drop it on another machine and `↥ Import` restores everything."*
**Proves** — the local-first portability story is real, not aspirational.
**Setup** — split-screen composite: file manager showing `muraldesk-backup-2026-05-02.muraldesk.json` on the left, MuralDesk with the imported mural on the right.

### 12 · SmartScreen warning (transparency shot)

**Filename** — `12-smartscreen-warning.png`
**Caption** — *"Unsigned Windows builds trigger SmartScreen — click 'More info' → 'Run anyway' to install. Documented honestly in the README; signing requires an EV certificate that wasn't in the buildathon scope."*
**Proves** — you understand the limitation and aren't hiding it. Judges respect this; pretending it doesn't exist is worse than showing it.
**Setup** — first-launch the unsigned installer on a fresh Windows VM. Capture the warning as-is.

### 13 · Branded app icon at multiple sizes

**Filename** — `13-icon-sizes.png`
**Caption** — *"The branded icon: source SVG, 512 PNG (PWA), 256 PNG (Electron taskbar), 32 PNG (system tray), and the multi-size Windows .ico — all rendered from one SVG via ImageMagick."*
**Proves** — the branding work was thorough, not just a single 1024×1024 PNG dropped in.
**Setup** — composite the SVG, 512 PNG, 256 PNG, 32 PNG, and 16 PNG side-by-side at their *native* sizes (no upscaling) so judges see the icon stays crisp at every size.

---

## Capture order (suggested workflow)

To minimize app restarts and inconsistent state, capture in this order:

1. Start with `npm run build:web && npm run dev:desktop`. Empty board.
2. Shoot **#1** (empty overlay) — wallpaper visible, no items.
3. Click `✨ Sample`. Shoot **#2** (sample mural) and **#3** (card types — pick four cards from the sample board).
4. Hover one card. Shoot **#4** (hover controls).
5. Paste a public YouTube URL. Toggle Interact mode. Shoot **#5**.
6. Set up an app behind MuralDesk. Shoot **#6** (or record the GIF).
7. Press `Ctrl/Cmd+Shift+F`. Shoot **#7** (Desktop Canvas Mode, both variants).
8. Right-click the tray icon. Shoot **#10** (bonus).
9. Click `📦 Backup`. Shoot **#11** (bonus).
10. Open the deployed PWA in Chrome in a separate browser window. Shoot **#8** (PWA, all three variants).
11. On a Windows machine or VM with a fresh Setup `.exe`: shoot **#9** (installer + installed app) and **#12** (SmartScreen).
12. Composite the icon set in any image editor. Shoot **#13** (bonus).

Total time once everything's prepared: ~30 minutes. Most of the time is in step 11 (Windows VM round-trip) and step 6 (composing the click-through annotation).
