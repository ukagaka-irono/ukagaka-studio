# Ukagaka Studio (伺かスタジオ)

日本語: [README.md](README.md)

> **This is the English translation of [README.md](README.md). The Japanese version is authoritative;**
> **if the two differ, follow the Japanese one.**

> **This is a fork of “Nashi SHIORI + Nashi Studio” (なし栞 + なしスタジオ).**
> It has been renamed and is being reworked independently (it is a separate project from the original).
>
> ```
> このソフトウェアは「なし栞 + なしスタジオ」をもとにしています。
> https://github.com/miyagawa-yukinterface/nashi-shiori-studio
> 作者: 月見里　彩葉 (miyagawa-yukinterface)
> ```
>
> (This software is based on “Nashi SHIORI + Nashi Studio”. Author: 月見里　彩葉 (miyagawa-yukinterface).)
>
> | Original name | Name in this fork |
> |---|---|
> | Nashi Studio `nashi-studio.exe` | **Ukagaka Studio / 伺かスタジオ** `ukagaka-studio.exe` |
> | Nashi SHIORI `nashi.dll` | ikaga SHIORI / 如何栞 `ikaga.dll` (**replaced by the YAYA SHIORI in 2.0**; no longer included) |

[![build](https://github.com/ukagaka-irono/ukagaka-studio/actions/workflows/build.yml/badge.svg)](https://github.com/ukagaka-irono/ukagaka-studio/actions/workflows/build.yml)

**An app that lets you build Ukagaka (SSP) ghosts by stacking blocks, like Scratch**.
The blocks you build are translated into a dictionary for **YAYA**, a SHIORI widely used for Ukagaka,
so **what you export is an ordinary YAYA ghost**. You can also add talks made with blocks to a ghost written by hand in YAYA.
It is a native Windows program (C++ / MSVC); no runtime needs to be installed.

| | |
|---|---|
| **Ukagaka Studio `ukagaka-studio.exe`** | The block editor itself (64-bit, a single self-contained file). A native app with WebView2 embedded in its own window. The UI and the YAYA kit are both inside the exe |
| **YAYA SHIORI `yaya.dll`** | The SHIORI exported ghosts use (the official build as it is; runs **from Windows 2000, like SSP**). The studio's “Try” runs on the same `yaya.dll` |

---

## Requirements

|  | |
|---|---|
| **Exported ghosts** (they contain `yaya.dll`) | **Windows 2000 or later**, matching what SSP supports |
| **Ukagaka Studio** (`ukagaka-studio.exe`) | **Windows 10 / 11** (needs WebView2) |

You **make** ghosts on a recent Windows, and the **ghosts you hand out** run on old Windows too.
The editor sits on WebView2 (Edge), so it does not run on old Windows.

To get there, the SHIORI `yaya.dll` is included as **the official build, unchanged**.
Built from source with today's Visual Studio, it pulls in APIs from Vista onward,
and then **the DLL fails to load at all** on anything older.
`node tools\check-imports.js` checks at any time that it uses only APIs Windows 2000 has
(details in [`docs/en/maintenance.md`](docs/en/maintenance.md)).

---

## Download

| Where | What you need | What it is |
|---|---|---|
| [**Releases**](https://github.com/ukagaka-irono/ukagaka-studio/releases) | Nothing | A zip per version. **Usually use this** |
| The run page in [**Actions**](https://github.com/ukagaka-irono/ukagaka-studio/actions) | **A GitHub login** | The latest build of every push. Kept 30 days |

In Actions, scroll the run page to the bottom: it is `ukagaka-studio-<version>-<sha>` under **Artifacts**,
with the same contents as the Releases zip
(exe / README in Japanese and English / CHANGELOG / LICENSE / docs / third_party with YAYA's license).

> Actions artifacts **cannot be downloaded without logging in to GitHub** (the button does not appear).
> If you do not want to log in, use Releases.

Neither is **code-signed**, so Windows may stop them.
In that case see [If Smart App Control blocks it](#if-smart-app-control-blocks-it).

To build it yourself, run `.\build.ps1` ([`docs/en/maintenance.md`](docs/en/maintenance.md)).

---

## How to use

### 1. Start it

Just **double-click `ukagaka-studio.exe`**.
If you are new, the fastest way in is “Open” → “**Start from an example**”, which loads a working ghost
so you can look inside (greeting / affection / time of day / asking your name / talking to other ghosts).
The first time you start it, a **first-steps guide** appears at the top right of the canvas
(open an example → run it with ▶ → put it into SSP).
After you close it, you can bring it back with “Show the first-steps guide again” in Help (the **?** at the top right).

* It opens its own window. No browser starts, and there is no address bar or tabs.
* Closing the window quits the app. If you have unsaved changes, it asks first.
* The window position and size are restored the next time.
* Starting it twice does not open a second one (the open window comes to the front).
* While there are unsaved changes, it saves automatically every minute. Each save keeps what it overwrites as an **earlier version**;
  press 🕘 next to a project in “Open” to pick one and open it (saving what you opened makes it the current version).
* The screen language follows the Windows display language. Switch it with **English** / **日本語** in the top bar
  (what you have open, including unsaved changes, stays as it is). With the English UI, the examples are English too.
* The language of what the ghost says on its own (reactions to events without blocks) and of values such as
  “time of day” is set separately from the screen, with **“Ghost language” on the Ghost info page**
  (it starts as the screen language at the time you created the ghost).

**It opens no ports.** Requests from the UI are received inside WebView2 and handled right inside the exe.
It makes no outside connections either (it only connects to `127.0.0.1:9801` to talk to SSP).

> The UI uses the **Microsoft Edge WebView2 Runtime** (built into Windows 11).
> If it is missing, the app says so at startup and links to the download page.

### 2. Build with blocks

Right below the top bar you switch between the **Talk / Speech / Characters / Ghost info / Export** pages.
The **Speech** page lists the speech of every “says” block so you can edit it right there. Export it to CSV, edit it in a
spreadsheet and open it again to write back only the lines that changed.
You build with blocks on the **Talk** page. How to use it and the keyboard shortcuts are under the **?** at the top right.

1. From **Events** on the left, drag something like “When started” onto the canvas.
2. Under it, attach “◯ says □” from **Speech**.
3. With ▶ in the **Try** tab on the right, you see how it talks and its Sakura Script.
   **Current variables** are shown below. If something like affection gets stuck at a strange value,
   start over with “Reset these variables” (inside the editor only) or “Clear the ghost's memory”
   (the exported ghost's `yaya_variable.cfg`). **Click, double-click or stroke a surface** on the stage to try the mouse event
   for the hit area you touched, chosen the same way as in SSP.
4. On the **Characters** page, under “Surfaces”, you can assign your own PNG images to surface numbers
   (numbers you leave out get a simple picture drawn in the colors you choose).
   With “**Hit areas**” on each surface, drag on the picture to draw the places that can be touched (head, face, … or names of your own).
   Drawn areas replace that surface's automatic hit areas, and their names appear in the area list of mouse hats.
   Enter an existing shell folder (such as `shell\master`) under “Import from an existing shell folder” to assign
   numbered images such as `surface0.png` to their numbers all at once. It also imports the **animations** (SERIKO/2.0 syntax) and
   **rectangular hit areas** in `surfaces.txt`, and the dress-up names in `descript.txt` (non-rectangular hit areas and the old SERIKO/1
   syntax are not read; numbers that `surfaces.txt` builds by combining images have no single picture, so they are not imported).
   Under “**Animations**” on the same page you can make animations that flip through surfaces
   (frames are lined up from left to right, each with a preview).
   Set “when” and they play by themselves; you can also start one with the “play animation N” block.
   Each frame has its own drawing method and position, and you can add “areas you can touch only while it plays”.
5. In the **Search** tab (Ctrl+F) you can find blocks by speech text or variable name. Enter “Replace with” and press “Replace all” to
   replace inside the text fields of blocks (speech, choices and so on; YAYA code fields and variable names are left alone).
   Click a result to jump there. Copy blocks with **Ctrl+C / Ctrl+V**.
   What you copy can be pasted into another project, even after restarting. Variables the blocks use are added, with their
   initial values, if the project you paste into does not have them.
6. The **Check** tab lists empty speech, missing variables, choices that go nowhere and so on. It also points out overlong speech,
   talks that are never called, and variables that are unused (or set but never read).
   If it shows a red number, fix those before exporting. Click an item and
   the canvas scrolls there and the block flashes.

**You can also build with the keyboard alone.** Press **/** (or “+ Block” at the bottom right of the canvas) to open
the block search, type part of a name such as “says” or “petted”, and press **Enter** to place it. It attaches right
below the selected block, and you can type straight into the new block's text field. Press Enter to confirm, then **/** again
to keep building downward.

**Right-click** a block for copy, cut, paste, duplicate, save as a part, disable, note and delete; a script's hat for run, duplicate,
note, save as a part, **show YAYA** and delete; empty space for “Find and place a block here”, “Paste here” and “Tidy up”.
The list of keys is on the How to use page, opened with **?** or **F1**.

“**Show YAYA**” shows the YAYA function the script becomes when exported, exactly as it is written out.
It is a model to follow when you move on to writing YAYA by hand.

A **part** is an arrangement you use often, kept under a name. Save one with “Save this and below as a part” in the right-click
menu of a block (“Save this script as a part” on a hat); it appears under **Parts** in the palette and can be dragged into any project.
Variables it uses are added, with their initial values, if the project does not have them. Rename or delete a part from its right-click
menu in the palette.

A **note** is a memo you can attach to a block or a script with “Add a note” in the right-click menu. It appears like a sticky
note to the right of the script and can be edited right there (erasing all its text removes it). It does not affect how the ghost
behaves. When you export, it goes into the YAYA dictionary as a `// Note: …` comment just before its block, so it also helps when
reading the YAYA by hand. The **Search** tab searches notes too.

### 3. Run it in SSP

Just press “**Run it in SSP**” on the **Export** page.

* It finds SSP (`ssp.exe`) by itself: from the running process if SSP is running,
  or from usual places such as `C:\ssp` if it is not.
  If it cannot find it, enter the path of `ssp.exe` in the field on the same page and press “Use this location”.
* It exports straight into SSP's `ghost\` folder and **switches SSP to the ghost**.
* If that ghost was already running, it **only reloads the SHIORI** after exporting (no switch, instant).
* If SSP is not running, “Start SSP” starts it.
* With “**Put into SSP on every save**” on, saving by hand (Ctrl+S and so on) does the same whenever SSP is running
  (the one-minute autosave does not). Handy when you go back and forth between editing and checking in SSP.

To package it for sharing, use “Make .nar” on the same page.
Drag and drop the `.nar` onto the SSP window to install it.

> To export again into a ghost that is running in SSP, use “Run it in SSP” below.
> It makes the SHIORI reload after exporting (a plain export does not make YAYA reload).

### 4. Try it on a running ghost (SSTP)

The **Try** tab shows the connection to SSP. When it is connected:

* **Say it in SSP** — makes **the real ghost running on your desktop** say the selected talk
  (a check on the real thing, not the preview inside the editor).
* **Send event** — sends the selected event (such as `OnMouseDoubleClick`) to SSP,
  to see how the installed ghost actually reacts.
* **Talk to it** — talks to the running ghost as if you were another ghost.
  If you have selected a “When talked to” block, it talks with that sender and text,
  so you can check right away that the filter works.

Under the hood it sends `SEND` / `NOTIFY` / `EXECUTE` / `COMMUNICATE` to SSP's **SSTP** (`127.0.0.1:9801`).
SSP must have “accept SSTP” turned on (it is on by default).

If you have not prepared images, simple surfaces (surfaces 0/1/2 and 10/11/12) are drawn automatically.
To use your own drawings, replace the PNG files in `shell/master/`.
Shell images that already exist are not overwritten when you export again.

A **balloon** can be included too: turn on “Make a balloon too” on the **Characters** page
(PNG files and a `descript.txt` go into `balloon/`, and `install.txt` says where to put it).
Without it, the user's own balloon is used.
Besides the color, you can choose the shape (rounded, square, very round), the size, whether it has a tail, and the line and text colors.
Here too, your own PNG files are not overwritten when you export again.

### 5. Network updates

A way for ghosts you have already handed out to catch up with your fixes.

1. On the **Ghost info** page, enter the URL where you will upload it in “**Update URL**”
   (end it with `/`; for example `https://example.com/ghost/ikagako/`).
   This becomes `homeurl` in `descript.txt`. If it is empty, nothing is written and there are no updates.
2. When you export, **`updates2.dau`** (a list to compare contents against) is made in the folder too.
   The user's SSP reads it and downloads **only the files that changed**.
   It is made from what is in the folder, so images you replaced and files you added later are included.
3. Upload the **whole** folder to that URL.
   **Always use binary mode** (text mode changes the contents and the comparison fails).
4. Users get the new version with “Network update” in the right-click menu.
   To start an update from the ghost, place the “**run a network update**” block.

> The format of `updates2.dau` is not officially published. Ukagaka Studio follows the published
> reader (ninix-kagari's `lib/ninix/update.rb`).
> If it fails with `md5 miss` or the like, **drag and drop the folder you upload onto the SSP window**:
> SSP rebuilds the file, and you can overwrite with that one.
> It is not included in the `.nar` (an archive does not need it).

You can follow an update with the `OnUpdateBegin` / `OnUpdateReady` / `OnUpdateComplete` / `OnUpdateFailure`
events. Even without blocks, the SHIORI says a word **when the update succeeded** and **when it failed**
(it stays quiet about “nothing changed” and the steps in between).

> To delete files, put a `delete.txt` at the upload location
> (network updates only overwrite; they never delete).

### 6. Add blocks to a hand-written YAYA ghost

You can add talks made with blocks to a ghost written by hand in YAYA (one made from a YAYA template, for example).

1. On the **Export** page, enter the ghost folder (the folder that contains `ghost\master`) under
   “Link to a hand-written YAYA ghost” and press **Link**.
   The names (name, sakura.name and kero.name in `descript.txt`) become that ghost's.
2. While linked, **Export** (or **Run it in SSP**) writes into that ghost, and writes **only the studio's files**:
   * `ghost/master/studio_runtime.dic` and `studio_program.dic` (with the mark `// ukagaka-studio: generated` on line 1)
   * the few lines of `yaya.txt` from `// ukagaka-studio: begin` to `// ukagaka-studio: end` (appended if missing)

   Hand-written dictionaries, `descript.txt`, the shell, `yaya.dll` and `yaya_base` are never touched.
   If a file with a studio file's name has no mark (someone wrote it), the export stops instead of overwriting it.
3. **For the same event, hand-written code wins.** For an event the hand-written dictionaries also define (say `OnBoot`),
   the studio writes no entry (with both, YAYA cannot read the dictionaries and the ghost goes silent).
   To run the blocks too, call `Studio.Event('OnBoot')` inside the hand-written function.
   The Check tab points such scripts out.
4. The ghost's `yaya.dll` and `yaya_base` are used as they are. If they are too old for the studio's runtime
   (not YAYA 6.x, no yaya_base, or an old one), the link section says so and exports stop.

Hand-written YAYA can read and write block variables as `Studio.var['name']`.
The other way round, blocks use hand-written YAYA through “**call YAYA function F with A B**” (Control) and
“**value of YAYA expression C**” (Operators) (no blocks can go into the function name and expression fields).
No .nar is made while linked. Unlinking brings back the usual export.

### Where things are saved

Next to `ukagaka-studio.exe`.

| | |
|---|---|
| `projects\` | Projects (your unfinished blocks). A sample is put here on first start (`Ikaga.json` in English, `いかがちゃん.json` in Japanese) |
| `projects\.history\` | Earlier versions of projects. Each save keeps what it overwrites (autosaves only every 10 minutes; the newest 30 per project are kept). Open them with 🕘 in “Open” |
| `output\` | Exported ghosts (unless you changed the output folder) |
| `parts.json` | Parts (arrangements you use often; shared by every project) |
| `ukagaka-studio.json` | The last project opened, the output folder, the window size, the language |
| `webview-data\` | WebView2's working folder (rebuilt if you delete it) |

Exported ghosts get the YAYA kit embedded in the exe (`yaya.dll`, `yaya_base`, `studio_runtime.dic`).

---

## Building

If Visual Studio has “Desktop development with C++”, this is all.

```powershell
.\build.ps1            # 32-bit helper (yaya_host.exe) -> Studio (64-bit EXE)
.\build.ps1 -Test      # also builds the headless consoles and runs the tests
.\build.ps1 -Release   # clean rebuild, test, and make the zip to distribute
```

`-Release` makes `dist\ukagaka-studio-<version>.zip` (the exe and the documents).
The version number is the single line in the **`VERSION` file at the root**. Changing it
updates both the zip name and the exe's properties (right-click → Properties → Details).
Add what changed to `CHANGELOG.md`.

With `-Test`, nine tests run.

| | |
|---|---|
| **Block coverage** (`tools\check-blocks.js`) | Whether every block is present in the definitions, the YAYA translation, the docs (Japanese and English) and the tests. It needs no build, so it runs first |
| **Parity test** (`shiori\test\parity\parity.js`) | Translates one script per block into YAYA, runs it, and checks that the Sakura Script that comes out matches the answers fixed in advance (`expected.json`). It also runs the same scripts the way “Try” does (`yaya_host.exe`) to check that **“Try” and SSP give the same answers** |
| **Behavior test** (`shiori\test\behavior\behavior.js`) | The decisions the runtime dictionary makes — which script to pick when an event has several, the default reactions when there are no blocks (in English for English ghosts), `\-` on `OnClose`, thinning out “every N seconds”, random talk, making petting events, where talk-to messages go, SAORI (it actually calls a deliberately slow test DLL) |
| **YAYA test** (`shiori\test\yaya\yaya.js`) | Whether YAYA (`third_party\yaya\`) is still the official build and runs; whether variables survive a restart, the exe's export runs on YAYA as it is, and exporting into a linked hand-written YAYA ghost leaves the hand-written files byte for byte unchanged |
| **Export test** (`studio\test\export.js`) | Whether exported files (`surfaces.txt` / `descript.txt` / `ghost.json` / `install.txt` / `yaya.txt` / `studio_program.dic`, and the file list) are as expected. `updates2.dau` is checked against MD5 from node's `crypto` |
| **Editor test** (`ui\test\editor.js`) | Normalizing loaded projects and checking format versions (`model.js`), the warnings of the Check tab (`lint.js`), searching blocks by text, that every example is clean, and that the notice in Help's “About this software” is the same text as in the README and LICENSE |
| **Import check** (`tools\check-imports.js`) | Reads the import table of the `yaya.dll` that goes into exported ghosts directly to catch **APIs that Windows 2000 does not have**. With one of those, the DLL fails to load at all below that Windows (this is for when you upgrade it) |
| **UI file check** (`ui\test\modules.js`) | Whether every `ui\js\*.js` (ES module) is reachable from the entry `main.js`, loads first without failing, and every `Xxx.yyy()` call has a target. It catches **things left behind when splitting files**. It also checks that every color in `style.css` goes through a token (so nothing loses its color in the dark theme) |
| **UI language check** (`ui\test\i18n.js`) | Whether all Japanese UI text goes through `t()` and has an English translation (so no Japanese is left on the English screen), whether the dictionary has stale entries or mismatched `{placeholders}`, whether every error code the exe returns has UI text, and whether every document has an English version |

Only these nine use **Node.js** (22.12 or later; skipped if it is not installed. The app itself does not need it).
The behavior test waits on purpose in one place (a slow SAORI overlapping with closing),
so it takes about 10 seconds.
When you add blocks or behavior, update the inputs and expected results in `shiori\test\`, `studio\test\` and `ui\test\`
too. If you changed the export or what a block outputs on purpose, check what comes out with your own eyes, then
regenerate the expected files with `node studio\test\export.js --update` / `node shiori\test\parity\parity.js --update`.

**The steps for adding one block** (which file gets what) and the common pitfalls are collected in
[`docs/en/maintenance.md`](docs/en/maintenance.md).

These nine also **run automatically on GitHub** (pushes to `main`, `v*` tags, pull requests),
so they stop you even if you forget. The settings are in `.github/workflows/build.yml`.

To build one part, use `shiori\build.ps1` (the 32-bit helper and the test consoles) / `studio\build.ps1`.
The studio build runs `studio\tools\embed.ps1`, which packs everything under `ui\` plus the YAYA kit (`yaya.dll`,
`yaya_host.exe`, the runtime dictionaries, `yaya_base`) into resources embedded in the exe (rebuild after changing the UI or the dictionaries).

The official build of the **YAYA** SHIORI (`yaya.dll`) and its entry dictionary `yaya_base` are in `third_party\`.
YAYA is not built from source
(built with today's Visual Studio it no longer runs on Windows 2000). Where they came from and how to upgrade them is in
[`third_party/README.md`](third_party/README.md). The text of YAYA's license (AYA Ver.5 terms / BSD 3-Clause)
is in `third_party\yaya\` and is included in the release zip.

The WebView2 SDK is in `studio\third_party\webview2\` (only the headers and the static
`WebView2LoaderStatic.lib`; **BSD 3-Clause**). No download is needed.
It is statically linked into the exe, so **its copyright notice must be included when you distribute it**.
The notice is at the end of the root [`LICENSE`](LICENSE) and is included in the release zip.

### If Smart App Control blocks it

Windows 11's **Smart App Control** (on by default on some machines) may block
unsigned exe files with no reputation. If a freshly built `ukagaka-studio.exe`
is reported as “blocked by an application control policy”, do one of these.

1. **Wait a little and run it again** — once the verdict settles it may pass (not guaranteed).
2. **Code-sign it** — a code-signing certificate from a public certificate authority makes it reliable.
   ```powershell
   .\studio\build.ps1 -SignThumbprint <certificate thumbprint>
   ```
   A self-signed certificate does not earn Smart App Control's trust.
3. **Turn Smart App Control off** — Windows Security → “App & browser control” →
   “Smart App Control” → Off.
   **Once it is off, you cannot turn it back on without reinstalling Windows.** Think it over first.

A freshly built `yaya_host.exe` or `test_host.exe` can be stopped the same way in the middle of the tests
(`error 4551`). **Building again usually gets it through.**

---

## Folder layout

```
ukagaka-studio/
├── .github/workflows/
│   └── build.yml            builds and runs the tests on every push
├── ukagaka-studio.exe        the build result (this one file is all you need)
├── build.ps1               builds everything
├── LICENSE                 Nashi License (plus notices for bundled parts)
├── shiori/                 tests that run the SHIORI (YAYA), and the place that builds the 32-bit parts
│   ├── build.ps1           builds yaya_host.exe (with -Test, also test_host.exe and slow_saori.dll) as 32-bit
│   ├── test/               tests that run without SSP
│   │   ├── test_host.cpp   loads yaya.dll in place of SSP and sends it events one by one
│   │   ├── lib/            test helpers (translate blocks into YAYA, run them, parse the replies)
│   │   ├── parity/         the parity test of each block's answer (expected.json holds the fixed answers)
│   │   ├── saori/          a “deliberately slow SAORI” for tests
│   │   ├── behavior/       tests of the behavior (what it picks, default reactions, thinning out)
│   │   └── yaya/           tests of YAYA itself, saving, export and linking; handwritten/ is a hand-written ghost for the link tests
│   └── dist/               build results (yaya_host.exe / test_host.exe)
├── studio/                 Ukagaka Studio (C++ / 64-bit EXE)
│   ├── build.ps1
│   ├── test/               checks against expected results (-Test also builds export_host.exe, which shows exported files)
│   ├── res/                the icon and the first-run samples (Japanese and English)
│   │   └── yaya/           the runtime dictionary studio_runtime.dic and the Try entry studio_preview.dic
│   ├── yaya_host/          the 32-bit helper that runs YAYA for “Try” (built by shiori\build.ps1)
│   ├── third_party/        WebView2 SDK (headers + static loader)
│   ├── tools/embed.ps1     turns ui\ and the YAYA kit into resources
│   ├── tools/make-icon.mjs makes the exe icon from the logo (ui/img/logo.svg)
│   └── src/
│       ├── main.cpp        window, startup and shutdown, single instance
│       ├── lang.cpp        the language of what the exe shows itself (Japanese / English)
│       ├── webview.cpp     embeds WebView2 and intercepts its requests
│       ├── webreq.cpp      parses requests (URL decoding and so on)
│       ├── assets.cpp      takes ui\ and the YAYA kit out of the exe
│       ├── sstp.cpp        talks to SSP (SSTP and finding ssp.exe)
│       ├── api.cpp         the /api/* entry (the route table kRoutes)
│       ├── api_project.cpp   state, saving and loading projects
│       ├── project_history.cpp  earlier versions of projects (projects\.history\)
│       ├── api_shell.cpp     surfaces (drawing the placeholder shell, your own images)
│       ├── api_ghost.cpp     Try, and the exported ghost's memory and log
│       ├── api_export.cpp    export, open in Explorer, inspect a hand-written YAYA ghost
│       ├── yaya_ghost.cpp    inspects a hand-written YAYA ghost and exports into a linked one (the studio's files only)
│       ├── shell_import.cpp  collects numbered surface images from an existing shell folder
│       ├── api_ssp.cpp       working with a running SSP
│       ├── yaya_preview.cpp runs “Try” on YAYA (through yaya_host.exe)
│       ├── exporter.cpp    assembles a whole ghost and writes it to a folder / .nar
│       ├── export_program.cpp  ghost.json (a copy of the blocks, for opening it again in Ukagaka Studio)
│       ├── export_shell.cpp    placeholder surfaces, the shell's descript.txt, surfaces.txt
│       ├── export_seriko.cpp   SERIKO animations in surfaces.txt
│       ├── export_balloon.cpp  the bundled balloon
│       ├── export_dau.cpp      the network update list (updates2.dau)
│       ├── image.cpp       PNG output and a simple rasterizer
│       ├── zip.cpp         .nar (ZIP) output
│       ├── deflate.cpp     deflate compression (fixed Huffman + LZ77)
│       ├── json.cpp        a small JSON parser
│       ├── util.cpp        encodings, files, writing numbers
│       └── fsutil.cpp      file operations
├── ui/                     the UI (embedded in the exe)
│   ├── index.html
│   ├── style.css
│   ├── samples/            examples (“Start from an example”); the English ones are in samples/en/
│   ├── test/               tests that run without showing the UI
│   │                         editor.js  … normalizing, format versions, Check tab, block search, examples, About
│   │                         modules.js … loading, layer direction, call targets, color tokens
│   │                         i18n.js    … unwrapped t(), the English dictionary, exe error codes, English docs
│   └── js/                 ES modules (index.html reads only main.js)
│       ├── main.js         entry and assembly (each part's init, redrawing everything)
│       ├── shortcuts.js    keyboard shortcuts
│       ├── i18n/           UI text (t() and the English dictionary en.js)
│       ├── model/          data and rules (no DOM)
│       │   ├── blocks.js   block definitions (add here to add a block)
│       │   ├── model.js    project data and undo
│       │   ├── lint.js     the Check tab (empty speech, missing variables, choices that go nowhere, talks never called)
│       │   ├── blockindex.js  searching blocks by text (the / “find and place”)
│       │   ├── player.js   unpacks Sakura Script (YAYA does the running)
│       │   ├── yaya.js     translates blocks into a YAYA dictionary
│       │   ├── lines.js    the speech list and CSV in/out
│       │   ├── replace.js  replacing text in bulk
│       │   └── sample.js   the template for “New”
│       ├── core/           UI foundation (API, notices, UI state, hooks for upper layers, event notices)
│       ├── editor/         canvas and palette (drawing, dragging, zoom, right-click, find and place, copy, notes, parts)
│       └── panels/         pages (Talk, Characters, Ghost info, Export, Help)
│           ├── pages.js    switching pages (right below the top bar)
│           ├── guide.js    the first-steps guide (the card at the top right of the canvas)
│           ├── about.js    “About this software” in Help (the version and the notice about the original project)
│           ├── language.js switching the UI language (English / 日本語 in the top bar)
│           ├── run.js      “Try” on the right of Talk (running, variables, the ghost's log)
│           ├── stage.js    the stage of “Try” (animates the balloon and surfaces)
│           ├── vars.js     “Variables” on the right of Talk
│           ├── search.js   “Check” and “Search” on the right of Talk
│           ├── chara.js    “Characters” (surfaces, placeholder shell colors, balloon, animations)
│           ├── ghost.js    “Ghost info” (names, author, talk interval, network update, ghost language)
│           ├── dialog.js   save / open and export
│           ├── ssp.js      working with a running SSP
│           └── yayalink.js “Link to a hand-written YAYA ghost” on the Export page
├── tools/
│   ├── check-blocks.js     checks every block is present in every file (no build needed)
│   └── check-imports.js    checks yaya.dll can be loaded from Windows 2000
├── third_party/            files from elsewhere (do not edit)
│   ├── yaya/               YAYA's official yaya.dll and its license
│   └── yaya-dic/           YAYA's system dictionary yaya_base (the SHIORI/3.0 entry)
└── docs/
    ├── blocks.md           the block reference
    ├── ghost-json.md       the ghost.json specification
    ├── maintenance.md      a guide for working on the code (adding blocks, pitfalls)
    ├── roadmap.md          the rework plan
    └── en/                 English translations of the above (the Japanese ones are authoritative)
```

---

## How the SHIORI works

An exported ghost's `ghost/master/` contains:

| | |
|---|---|
| `yaya.dll` | The YAYA SHIORI (official build). `shiori` in `descript.txt` points to it |
| `yaya.txt` | YAYA's settings, including which dictionaries to read |
| `yaya_base\` | YAYA's system dictionary (answers SHIORI/3.0 and calls the function named after the event) |
| `studio_runtime.dic` | **The runtime dictionary**: the fixed part, such as which script to pick, thinning out and default reactions (the same for every ghost) |
| `studio_program.dic` | **The dictionary translated from the blocks**. One script becomes one YAYA function |
| `ghost.json` | A copy of the blocks. YAYA does not read it (it is there so “Open” can load it as a project) |

The two dictionaries the studio writes are recognized by `// ukagaka-studio: generated` on line 1. They are overwritten on every
export, so when you write YAYA by hand, put it in a dictionary file of your own and add it to `yaya.txt`.

* For each event from SSP (`OnBoot`, `OnMouseDoubleClick`, …), `yaya_base` calls the function named after the event,
  and that function in `studio_program.dic` asks the runtime dictionary to run the scripts for the event.
  The resulting Sakura Script is returned in `Value:`.
* When an event has several scripts, it draws one by `weight`, avoiding the one picked last time.
  Scripts with filters take **precedence** over the same event without a filter.
* It counts `OnSecondChange` and plays a **random talk** (`kind: "talk"`) at the interval you set.
  Recently used talks are left out of the draw so the same talk does not repeat (how many is set per ghost;
  the default is half the number of talks, up to 8). Meanwhile, `yaya_base`'s own random talk (`aitalkinterval`) is turned off.
* Variables, the boot count and the order of talks are kept in **`yaya_variable.cfg`** by YAYA's own saving, and continue next time.
  Block variables live in one container, **`Studio.var['name']`**, so any name works as it is
  and never clashes with hand-written YAYA variables.
* Events fall into three groups: **the first time** (`OnFirstBoot` / `OnBoot`), **the steady loop** (`OnSecondChange`),
  and **other events**. SSP calls the steady loop every second, so the hat block's
  “every N seconds” thins it out (`everySec`).
* Mouse events can be narrowed down by **the area hit (head, face, chest, skirt, hand) and who was hit**.
  The placeholder shell is exported with hit areas of those names (you can redraw them on the Characters page).
* When `OnMouseMove` keeps hitting the same area, the runtime makes **`OnNadeNade` (when petted)** itself.
  SSP has no such event; the runtime dictionary counts it.
* **Talking between ghosts** (`OnCommunicate`) is supported. It can be narrowed down by the sender's name and
  what was said. To talk to someone, the reply carries `Reference0: <their name>`.
  After 8 rounds back and forth, it only talks and stops sending.
* **External modules (SAORI)** are called with YAYA's `REQUESTLIB` (which waits for the answer).
  The “call without waiting for the answer” block also waits inside, then turns the answer into `OnSaoriDone` on the next `OnSecondChange`.
  YAYA has no way to run things on another thread, so the ghost stops while a slow SAORI runs.
* Events without blocks get modest default reactions such as greetings
  (in English when the ghost language is English).
  `OnClose` always gets `\-` so the ghost really closes.
* The log (`studio_debug.txt`) is written only when that file exists (“Start logging” under “Try” creates it).
  It records loading, YAYA's warnings, SAORI that could not be loaded and so on.

The editor's “Try” also runs on the same 32-bit `yaya.dll` that goes into SSP. The UI translates the blocks into a YAYA dictionary
and asks through `POST /api/preview`; Ukagaka Studio runs it with `yaya_host.exe`, a small 32-bit helper embedded in the exe
(the UI has no block interpreter of its own). Only two things differ: **it does not call SAORI** (the ghost folder's DLLs are not there),
and **values such as the uptime and boot count come from the UI**. The parity test checks that “Try” and SSP give the same answers.

> Up to 1.x, a SHIORI of our own, **ikaga SHIORI** (`ikaga.dll`), ran the blocks. 2.0 replaced it with YAYA,
> built to behave the same. Where it differs on purpose, or because YAYA cannot do the same, is listed in step 3-3 of
> [`docs/en/roadmap.md`](docs/en/roadmap.md).
> A ghost exported earlier with ikaga SHIORI becomes a YAYA ghost when you open the project and export it again
> (ikaga SHIORI's saved variables `ikaga_save.json` are not carried over; variables start from the project's initial values).

### Trying it without SSP

```powershell
.\build.ps1 -Test
.\shiori\dist\test_host.exe .\output\Ikaga\ghost\master OnBoot OnMouseDoubleClick:0,0,0,0,Head OnClose
```

`test_host.exe` loads the folder's `yaya.dll` in place of SSP and sends it the events one by one
(to try another SHIORI DLL, add `--dll <name>`). Give events as `EventName:ref0,ref1,...`. Add `*count` to repeat, as in `OnSecondChange:0,1*200`.
`!sleep:300` waits 300 ms on the spot (for waiting until something in the background finishes,
such as a SAORI called without waiting).

---

## What you can make / what is not there yet

What you can do:

* Speech, changing expressions (surfaces), pauses (waits), waiting for a click, switching balloons
* Choices (`\q`) and where they go, links (`\_a`), sounds (`\_v`)
* Variables (affection, flags, …), conditions, loops, random branches, calling talks
* Talking between ghosts (`OnCommunicate`) — reacting when talked to, and talking to others
* Switching to a third or later character (`\p[n]`)
* Calling external modules (**SAORI**) — 32-bit DLLs placed in the ghost folder
  (there is a “call without waiting for the answer” block, but YAYA waits for the answer, so the ghost stops meanwhile)
* **Adding blocks to a hand-written YAYA ghost**, and **using hand-written YAYA functions and expressions** from blocks
* **Animations** (SERIKO) — flipping through surfaces, made on the Characters page
  (each frame can be shifted and given a drawing method such as `interpolate` or `blend-*`;
  animations can also start or stop other animations (one of several, or several together), change the size, insert an APNG,
  and add hit areas (rectangle, ellipse, circle, polygon) you can touch only while they play)
* **Dress-up** (MAYUNA) — make parts as animations and wear / take them off from SSP's dress-up menu or the “dress-up” block
* **Network updates** (`homeurl`, exporting `updates2.dau`, update events, an update block)
* **Ask** (an input box) — puts what the user typed straight into a variable
* **Call in N seconds** (a simple timer), **raising an event yourself**,
  **switching ghosts** / **opening a browser**
* Generating placeholder shells (surfaces) and a **balloon**
* Info such as the time, weekday, boot count, **time of day (morning/afternoon/evening/night) and season**;
  arithmetic, comparisons and text operations
* **Groups** of random talks (morning talks, season talks, …) and a block that calls one of them
* For when you really need it, a block that “outputs Sakura Script as is”

Nothing is listed as missing right now. To add something, see “Adding one block” in
[`docs/en/maintenance.md`](docs/en/maintenance.md).

---

## Safety

* **It opens no ports.** Requests from the UI are received inside WebView2 and handled right inside the exe.
  The only outside connection is `127.0.0.1:9801`, to talk to SSP.
* The UI runs at a **pretend address**, `https://ikaga.example/`,
  and never navigates to outside pages from there (attempts are handed to the default browser).
  Only `http` / `https` are handed over when opening outside links.
* The API inside the exe accepts **only requests from its own UI**
  (a custom header, or a check that they come from the same address).
* When the runtime dictionary puts **text from outside** (what another ghost said, what was typed into an input box)
  into Sakura Script, it drops the `[` `]` that close tags, and line breaks.
  The “output Sakura Script as is” block, however, passes things through untouched, so do not put
  text from outside into it.
* **Check the contents of a project (.json) you got from someone else before opening it.**
  Surface images are referenced by path, and exporting bundles those images into the ghost.
  If you see a path you do not know, remove it under “Surfaces” on the Characters page.
* The SAORI DLLs blocks load must be inside the ghost folder
  (the runtime dictionary refuses `..` and absolute paths).
* SAORI are called waiting for the answer, so calling a SAORI that never finishes stops the ghost.
  Use only DLLs you trust.
* In the “call YAYA function F with A B” and “value of YAYA expression C” blocks, **no blocks can go into** the function name
  and expression fields (so words that came from other ghosts and the like are never run as YAYA code).
* One variable holds at most 32000 characters (so endless joining cannot use up memory).
  One reply's Sakura Script is also at most 32000 characters; anything beyond is not output.

---

## License

[**Nashi License 1.1**](LICENSE) (the original project “Nashi SHIORI + Nashi Studio”'s own license;
`LICENSE` also contains an English reference translation).
Copyright (c) 2026 月見里　彩葉 (miyagawa-yukinterface)

This fork is distributed under the same terms. The “based on” notice at the top is there because those terms (section 3) require it.
Inside the app, “**About this software**” in Help (the **?** at the top right) shows the version and the same notice.

Anyone may use, modify and distribute it, free of charge, for any purpose.

### About the ghosts you make

**Ghosts exported from Ukagaka Studio are entirely yours.**
They contain a SHIORI (`yaya.dll`; built into Ukagaka ghosts it is under the AYA Ver.5 terms and free to distribute),
but for Ukagaka Studio's part, when you hand them out you

* **do not need to include** this license text,
* **do not need to mention** the author or the software anywhere, and
* **may distribute them for a fee**.

We would be happy if you mentioned us, but it is not required.
We do not want to burden people who hand out ghosts, so this is explicitly waived.

### Distributing or forking this software itself

When you distribute `ukagaka-studio.exe` on its own, or the source,
include `LICENSE` with them.

**When you distribute a modified version (including a fork), also**

* make it clear that it has been changed, so it is not mistaken for the original, and
* **state where the original project is and who its author is, somewhere people can find it**.

The README, the app's help, wherever is convenient. Like this:

```
このソフトウェアは「なし栞 + なしスタジオ」をもとにしています。
https://github.com/miyagawa-yukinterface/nashi-shiori-studio
作者: 月見里　彩葉 (miyagawa-yukinterface)
```

(**None of this is needed when you hand out ghosts.** The same goes for ghosts exported
with a forked version.)

### No warranty

It is provided as is. The author cannot take responsibility for anything that happens. Use it at your own risk.

### Bundled components

`ukagaka-studio.exe` statically links the **Microsoft Edge WebView2 SDK** (BSD 3-Clause).
Its copyright notice is at the end of `LICENSE` and is always included in the release zip.

It also embeds the **YAYA** SHIORI (`yaya.dll`; AYA Ver.5 terms when built into Ukagaka ghosts and related programs,
BSD 3-Clause otherwise). Its notice and the license texts are in `third_party\` in the release zip.

> **Because the license is custom, GitHub does not show a license name.**
> It is permissive (in the same family as MIT and zlib), not copyleft.

---

## Notes

* The generated placeholder shell is a stopgap until you have your own drawings. Use your own art in ghosts you hand out.
* PNG and .nar files are written without external libraries (no zlib needed).
* The UI is HTML/CSS/JS running inside WebView2, but it only serves the exe's contents from the
  pretend address `https://ikaga.example/`; nothing goes over the network.
* If you open `ui\index.html` directly in a browser, the UI appears, but saving, exporting and
  “Try” do not work (they all call into the exe).
