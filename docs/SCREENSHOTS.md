# MuralDesk — Screenshot Checklist

Capture list for the buildathon submission. Every shot below has a single **purpose**, a **filename**, a **caption** ready to paste into the README, and a **what NOT to show** note so we don't leak personal data or ship inconsistent branding.

All screenshots live in `docs/screenshots/`. PNG for UI captures (lossless, sharp text); JPG only if a single capture exceeds ~5 MB.

## Recommended framing

- **Target dimensions: 1280 × 720** (16:9). Crop to this *after* capture — it scales cleanly on GitHub, on a buildathon judging page, and inside a slide deck without re-encoding.
- For full-display shots (Desktop Mode, click-through), capture at native resolution and downscale to 1280 × 720 in one pass — never upscale.
- Hero shot for the README top: same 1280 × 720, ~820 px wide as rendered.
- Side-by-side pairs (web vs. desktop): 640 × 720 each, then `<table>` them.
- Keep DPI scaling consistent across captures — switching between Retina and non-Retina mid-shoot makes the set look stitched-together.

## Universal "do not show"

- No personal photos, real names / emails, work-in-progress documents, NDA material, or screenshots of private tools (internal Notion, Confluence, Slack, Jira, etc.). Use the built-in **`✨ Sample`** for stand-in content.
- No browser extensions or autofill popovers. Capture in a clean profile.
- No Replit workspace chrome, Vite HMR overlay, or DevTools panels — unless the panel *is* the subject of the shot.
- No OS taskbar filenames that reveal sensitive paths (`Downloads/MyClient_NDA.pdf`).
- No system clock with a real wall-clock time tied to a specific day if you'd rather the submission feel timeless — set the OS clock to a generic time before capturing if it shows.
- Run a fresh `npm run build:web && npm run dev:desktop` before capturing — old HMR state leaks stale UI into shots.

---

## 1 · Empty transparent overlay (toolbar only)

| | |
|---|---|
| **Filename** | `01-empty-overlay.png` |
| **Why it matters** | Proves the window is genuinely transparent — with zero items, only the toolbar pill is visible and the OS desktop shows through unchanged. The single most "this is real" shot in the set. |
| **Caption** | *"With no items pinned, MuralDesk's window is fully transparent — only the toolbar renders. Your desktop shows through, untouched."* |

**Capture setup**
- Electron build (`npm run dev:desktop`).
- Empty board (use `🗑 Clear` first if needed).
- A **visually distinctive wallpaper** — gradient, photo, or pattern. Solid black hides the proof.
- Have a folder window or two desktop icons visible underneath, to make it unmistakable that the background is the OS desktop.

**Don't show** — desktop icons named after real clients/projects; the empty-state hero card (this shot is about the *window* being empty, not the empty-state UI).

---

## 2 · Sample board with all card types

| | |
|---|---|
| **Filename** | `02-sample-board.png` |
| **Why it matters** | Single shot that proves the app does what it advertises — image + video + note + link + smart embed cards co-existing on a transparent canvas. This is the README hero candidate. |
| **Caption** | *"One click on `✨ Sample` populates a mural of images, looping video, a sticky note, a smart link card, and an embedded YouTube player — all floating over the desktop without a window frame in sight."* |

**Capture setup**
- Electron build, normal window (not Desktop Mode — that's #7).
- Click `✨ Sample`, then click `▦ Tidy` to shelf-pack everything cleanly.
- Wallpaper visible at the edges so the overlay context is obvious.
- Capture the *whole* display, not just the window region — the absence of a window frame is part of the story.

**Don't show** — your real production board with personal references; cards stacked on top of each other (looks broken, not full).

---

## 3 · Hover controls on a card

| | |
|---|---|
| **Filename** | `03-hover-controls.png` |
| **Why it matters** | Proves the per-item polish — opacity slider, fit toggle, lock, duplicate, delete are all there and not buried in a settings menu. |
| **Caption** | *"Hover any card to reveal a compact mini-toolbar — opacity slider, object-fit toggle, lock, duplicate, delete. No settings panel, no right-click menu to memorize."* |

**Capture setup**
- An image card with the hover mini-toolbar fully revealed (give the hover ~300 ms to fade in).
- Drop opacity to ~50% in the *same* shot if possible, so the slider visibly does something.
- The top-right `✕` delete button must be clearly visible at the card's edge.

**Don't show** — the cursor mid-drag (looks broken in a still); two cards both showing hover state at once (only one card hovers — would read as faked).

---

## 4 · YouTube or Vimeo interact mode

| | |
|---|---|
| **Filename** | `04-video-interact.png` |
| **Why it matters** | Proves the smart-link classifier promotes a video URL to a real embedded player, *and* that Interact mode lets the native player work — not just a static thumbnail. |
| **Caption** | *"Paste a YouTube or Vimeo URL — MuralDesk auto-promotes it to an embedded player. Toggle Interact to use the native controls; toggle off to drag the card without pausing playback."* |

**Capture setup**
- Use a clearly-public, brand-safe video — official launch trailers, NASA, Blender Foundation (Big Buck Bunny), or your own public channel.
- Capture with the embed *playing*, in Interact mode (the Interact toggle visibly active), with the player progress bar showing elapsed time so it's obviously not a still.
- Keep one or two non-video cards visible in the background so this reads as "one card type among many," not the whole app.

**Don't show** — copyrighted music videos or artist thumbnails; age-restricted content; ads (pause until they're gone); the YouTube "watch on YouTube" overlay (start playback first to dismiss it).

---

## 5 · Spotify or SoundCloud embed

| | |
|---|---|
| **Filename** | `05-audio-embed.png` |
| **Why it matters** | Proves the smart-link classifier handles non-video providers too — the same Add-Link input recognizes audio platforms and renders a playable card. |
| **Caption** | *"The same Add-Link input also recognizes Spotify and SoundCloud — paste a track URL and you get a playable embed inline."* |

**Capture setup**
- Use a public, royalty-friendly track — official label playlists, Creative Commons artists on SoundCloud, NASA audio archives.
- Capture with the embed loaded and ready to play (the play button visible, the artwork rendered).
- Place next to a different card type so it's obvious this is one of many embed shapes, not a one-off.

**Don't show** — your personal Spotify "On Repeat" / "Discover Weekly" / Liked playlists (reveals taste/identity); private SoundCloud uploads; audio embeds in mid-buffering "Loading…" state.

---

## 6 · CodePen embed

| | |
|---|---|
| **Filename** | `06-codepen-embed.png` |
| **Why it matters** | Proves the embed system isn't just media — it also handles live code playgrounds, which is the "this is a serious tool for designers/devs" angle. |
| **Caption** | *"Paste a CodePen URL and the pen renders inline — handy for pinning live code references next to the design they belong to."* |

**Capture setup**
- Pick a visually rich, public CodePen — a CSS animation, an SVG illustration, a small WebGL demo. Avoid pens that fetch external APIs (loading states look bad).
- Capture with the pen fully rendered, the CodePen branding bar visible, the result pane showing actual output (not a code-only view).
- Keep the card moderately wide so the pen has room to breathe — at least 480 px wide.

**Don't show** — pens that throw console errors visible in the embed; pens with login walls; pens you don't own that have explicit "do not embed" notices.

---

## 7 · Desktop Mode (full-display overlay)

| | |
|---|---|
| **Filename** | `07-desktop-mode.png` (hidden toolbar) and `07b-desktop-mode-toolbar.png` (toolbar revealed) |
| **Why it matters** | Proves `Ctrl/Cmd + Shift + D` takes the mural fullscreen with the toolbar tucked into a thin reveal-zone — the entire display becomes the mural surface. |
| **Caption** | *"Desktop Mode takes the mural fullscreen. The toolbar tucks into a thin reveal-zone at the top and reappears on hover — your whole display is the surface."* |

**Capture setup**
- Press `Ctrl/Cmd + Shift + D` after pinning a moderately full sample mural.
- Capture the *entire* display (not just a window) — the whole point is no window. Use the OS-level full-screen capture (`PrtScn` on Windows, `Cmd+Shift+3` on macOS).
- Take both variants:
  - `07-desktop-mode.png` — toolbar tucked away, mural fully present, no chrome at the top.
  - `07b-desktop-mode-toolbar.png` — cursor at the top edge, toolbar revealed.

**Don't show** — taskbar / dock with private app icons; browser bookmarks bar; other monitors visible (this shot should feel immersive, not multi-monitor).

---

## 8 · Click-through explanation

| | |
|---|---|
| **Filename** | `08-click-through.png` (annotated still) — and ideally `08-click-through.gif` (short loop) |
| **Why it matters** | Proves the most subtle, hardest-to-photograph feature — empty space in the MuralDesk window forwards mouse events to the apps underneath. Easy to miss in a still; this shot has to *teach* the feature. |
| **Caption** | *"Empty space in the MuralDesk window forwards mouse events straight through to the apps underneath. The cursor is hovering a button in the file manager *behind* MuralDesk — clicking it works without minimizing the mural."* |

**Capture setup**
- **Annotated still (required).** Capture the desktop with a few MuralDesk cards plus a visibly-active app underneath (Finder / File Explorer / a text editor). Position the cursor mid-hover over a button in *that* app, not over a MuralDesk card. In an image editor, add a labeled arrow at the cursor and a callout: *"cursor is on Finder button — click works through"*. Without an annotation, this shot does not communicate.
- **Short loop (recommended if attachments allowed).** ~5 s clip: cursor moves over a card (drag handle appears), then to empty space (cursor passes through cleanly to a button underneath, that button's hover state activates). Loop.

**Don't show** — an unlabeled still of two windows overlapping. Without annotation or motion, this feature reads as "nothing is happening". Do not ship the unlabeled version.

---

## 9 · Backup / export / import

| | |
|---|---|
| **Filename** | `09-backup-roundtrip.png` |
| **Why it matters** | Proves the local-first portability story is real, not aspirational — the backup is one file, restorable in one click. |
| **Caption** | *"`📦 Backup` exports a single portable `.muraldesk.json` file with media base64-inlined. Drop it on another machine and `↥ Import` restores the entire board — layout, notes, images, videos."* |

**Capture setup**
- Split-screen composite:
  - **Left** — file manager showing `muraldesk-backup-2026-05-02.muraldesk.json` highlighted, with the file size visible (proves media is inlined, not a tiny layout-only stub).
  - **Right** — MuralDesk with the just-imported mural fully rendered, identical to the source.
- Optional third pane / inset: the toolbar with `📦 Backup` and `↥ Import` pills clearly labeled.

**Don't show** — a backup filename containing a personal username in the parent path (`/Users/janedoe/Desktop/…` — crop or use a generic location like `~/Documents/`); a layout-only export labeled as a backup (different file, different story).

---

## 10 · Windows app / installer

| | |
|---|---|
| **Filenames** | `10-installer.png`, `10b-start-menu.png`, `10c-installed-running.png` |
| **Why it matters** | Proves there's a real `.exe`, that it installs cleanly, and that it runs from the Start Menu like any other Windows app — not "just a dev script that happens to launch Electron". |
| **Captions** | *(Installer)* *"NSIS installer (`MuralDesk-Setup-0.1.0.exe`) — built via `npm run build:desktop`. Includes desktop and Start Menu shortcuts."* <br> *(Start Menu)* *"After install, MuralDesk shows up in the Start Menu and Windows search with its branded icon."* <br> *(Running)* *"The installed app runs identically to the dev build — same transparent overlay, same Desktop Mode, same tray integration."* |

**Capture setup**
- `10-installer.png` — first wizard screen of the unsigned installer with the MuralDesk title-bar icon visible.
- `10b-start-menu.png` — Start Menu open, type "MuralDesk", capture the search result with icon and "App" label.
- `10c-installed-running.png` — installed app running with a sample mural; hover the taskbar so the branded icon and tooltip are visible.

**Don't show** — antivirus-product-specific warnings (reads as a false-positive accusation against that AV); the SmartScreen *"Don't run"* button being clicked (looks like the app failed); installer paths revealing a personal username (`C:\Users\johndoe\…`) — install to `C:\Program Files\MuralDesk\` to keep paths clean.

> **Bonus:** capture the SmartScreen *warning itself* as `10d-smartscreen.png` and call it out honestly in the README. Judges respect transparency about the unsigned installer; pretending it doesn't exist is worse than showing it.

---

## Suggested order for the README

The README renders top-to-bottom. Order shots so the first three answer "what is this?" and the rest answer "and what else?".

| README slot | Shot | Why this position |
|---|---|---|
| Hero (top, 820 px) | `02-sample-board.png` | One image that proves the whole product. |
| Below "What is MuralDesk?" (side-by-side pair) | `01-empty-overlay.png` + `07-desktop-mode.png` | Web/empty vs. Electron/full — establishes both runtime targets fast. |
| Inside "Smart embeds" feature section | `04-video-interact.png` | Proves smart-link classification with the most-recognized format. |
| Smart embeds — secondary | `05-audio-embed.png`, `06-codepen-embed.png` | Demonstrates the embed list isn't YouTube-only. |
| Inside "Editing & polish" | `03-hover-controls.png` | Proves per-card polish exists. |
| Inside "Desktop Mode" | `08-click-through.png` *(annotated)* | The hardest claim, in the section that makes it. |
| Inside "Backup & export" | `09-backup-roundtrip.png` | Proves local-first portability. |
| Inside "Build the Windows .exe" | `10-installer.png` (and `10c` if space) | Visual proof the build instructions actually produce a real app. |

## Capture order (suggested workflow)

To minimize app restarts and inconsistent state, shoot in this order:

1. `npm run build:web && npm run dev:desktop`. Empty board.
2. **#1** (empty overlay) — wallpaper visible, no items.
3. Click `✨ Sample`, then `▦ Tidy`. **#2** (sample board).
4. Hover one card. **#3** (hover controls).
5. Paste a public YouTube/Vimeo URL, toggle Interact. **#4**.
6. Paste a Spotify or SoundCloud URL. **#5**.
7. Paste a CodePen URL. **#6**.
8. Press `Ctrl/Cmd + Shift + D`. **#7** (both variants).
9. Set up an app behind MuralDesk. **#8** (annotate after).
10. Click `📦 Backup`, then `↥ Import` it back. **#9**.
11. On a Windows machine or VM with a fresh Setup `.exe`: **#10** (installer + Start Menu + installed-running, plus SmartScreen if you're including it).

Total time once everything's prepared: ~30 minutes. Most of it is step 11 (Windows VM round-trip) and step 9 (composing the click-through annotation).
