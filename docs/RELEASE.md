# MuralDesk — Release Guide

How to run, build, and ship MuralDesk. Intended for contributors and for anyone packaging a release.

---

## Prerequisites

- **Node.js 18+** (Electron 31 supports modern Node toolchains).
- **npm** (ships with Node).
- A real desktop OS (Windows, macOS, or Linux) for **Electron** development. The web/PWA build runs anywhere.

---

## Run the web version

```bash
npm install
npm run dev:web
```

- Vite serves the renderer at `http://localhost:5000`.
- Hot-reload works.
- Use this for quick iteration on UI / hooks.

---

## Run the desktop version

```bash
npm install
npm run dev:desktop
```

- Spins up a dedicated Vite instance on `http://localhost:5173` and launches Electron pointed at it.
- Renderer hot-reloads. Main-process changes (`electron/main.cjs`, `electron/preload.cjs`) need a manual restart.
- Use this for testing the transparent overlay, click-through, Desktop Mode, tray, and IPC.

---

## Build the Windows installer

```bash
npm run build:desktop
```

This runs `npm run build:web` (Vite production build → `dist/`) and then `electron-builder --win` (NSIS).

### Expected output

```
release/MuralDesk-Setup-0.1.0.exe   ← NSIS installer
release/win-unpacked/MuralDesk.exe  ← unpacked binary
```

For a folder build with no installer (faster smoke test):

```bash
npm run build:desktop:dir
```

Produces `release/win-unpacked/MuralDesk.exe` only.

---

## Test the installer

1. Copy `release/MuralDesk-Setup-0.1.0.exe` to a clean Windows machine (or a fresh user profile).
2. Double-click to install. Accept SmartScreen (see below).
3. Launch from the Start menu — confirm the branded icon shows up.
4. Smoke-test the regression checklist: Sample → Tidy → drag → smart embed → Desktop Mode → click-through → Backup → relaunch.
5. Uninstall via *Settings → Apps* and confirm the uninstaller cleans up cleanly.

---

## SmartScreen warning

The installer is **unsigned**. First-time users will see:

> **Windows protected your PC**
> Microsoft Defender SmartScreen prevented an unrecognized app from starting.

To proceed, the user clicks **More info → Run anyway**.

This is expected for unsigned binaries. To remove the warning, MuralDesk would need an EV code-signing certificate (paid). That's deliberately out of scope for the buildathon build.

Document this clearly in any release notes — users should know what to expect.

---

## Replit limitation

Replit can run the **web/PWA preview** via `npm run dev:web` just fine.

Replit **cannot launch Electron desktop**, because the container lacks the GUI / GTK / Chromium system libraries Electron needs at runtime. Always test `dev:desktop` and `build:desktop` on a real desktop OS.

---

## Release checklist

Before publishing a release:

- [ ] `npm run build:web` passes with no errors and no new warnings.
- [ ] `npm run build:desktop` completes cleanly on Windows.
- [ ] Smoke-test on a clean Windows install (or a fresh user profile).
- [ ] Regression checklist passes:
  - [ ] Cold load → empty state shows.
  - [ ] **✨ Sample** → mural appears.
  - [ ] **▦ Tidy** → cards shelf-pack.
  - [ ] Drag, resize, opacity, lock, duplicate, delete all work.
  - [ ] Smart embed paste → correct card type per provider.
  - [ ] Unsafe URL (`javascript:alert(1)`) → silently rejected.
  - [ ] Backup → Clear → Import → board restored bit-identical.
  - [ ] Close window → hides to tray. Tray *Show* → window returns.
  - [ ] `Ctrl/Cmd + Shift + D` → Desktop Mode covers current display; toolbar tucks to top reveal-zone; toggle off restores prior bounds.
  - [ ] Display toggle **All** → overlay spans every monitor.
- [ ] README screenshot links resolve (no 404s in the rendered README on GitHub).
- [ ] `BUILDATHON_SUBMISSION.md` shortcut text is `Ctrl/Cmd + Shift + D` (not `+ F`).
- [ ] Version bumped in `package.json` if this is a tagged release.
- [ ] `release/MuralDesk-Setup-X.Y.Z.exe` filename matches the `package.json` version.

---

## GitHub release steps

1. Bump the version in `package.json` (`"version": "0.1.0"` → next).
2. Commit: `chore: release vX.Y.Z`.
3. Tag: `git tag vX.Y.Z && git push --tags`.
4. On GitHub, draft a new release pointing at the tag.
5. Attach the built artifacts:
   - `release/MuralDesk-Setup-X.Y.Z.exe`
6. In the release notes:
   - Summarize highlights and any breaking changes.
   - Note the SmartScreen warning and how to bypass it.
   - Link to the README and `docs/DEMO_SCRIPT.md`.
7. Publish.

---

## Troubleshooting

**`electron-builder` fails with a `cacache` / `tar` advisory.**
These advisories are in build-time dev dependencies and don't ship to users. They don't affect the produced installer. Don't bump electron-builder during a release — the major-version jump is breaking and will need its own validation pass.

**Electron window is opaque instead of transparent.**
Make sure no GPU compositing override is in place. On Linux, transparency requires a compositing window manager (e.g. mutter, kwin with effects on, picom for X11).

**Click-through doesn't work over a specific app.**
Some apps capture mouse events at the OS level (full-screen games, certain remote desktop clients). Click-through respects the OS — it can't override an app that's grabbing the cursor.

**Tray icon doesn't appear.**
On some Linux distros without a status-area implementation, the tray simply isn't created (we detect this and fall back to default close-quits-app behavior). On Windows, check the overflow chevron in the system tray — Windows often hides new tray icons by default.

**`dev:desktop` doesn't launch on Replit.**
Expected. See the Replit limitation above. Use `dev:web` on Replit and a real desktop OS for Electron work.

**Sample board has missing thumbnails.**
That's a network issue (the sample uses real `http(s)` URLs). The cards still render, the embed providers handle their own thumbnails. Try again on a stable connection.
