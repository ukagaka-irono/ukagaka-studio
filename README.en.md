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
> | Nashi SHIORI `nashi.dll` | **ikaga SHIORI / 如何栞** `ikaga.dll` |

[![build](https://github.com/ukagaka-irono/ukagaka-studio/actions/workflows/build.yml/badge.svg)](https://github.com/ukagaka-irono/ukagaka-studio/actions/workflows/build.yml)

A **SHIORI** for Ukagaka (SSP), plus **an app that lets you build ghosts for it by stacking blocks, like Scratch**.
Both are native Windows programs (C++ / MSVC); no runtime needs to be installed.

| | |
|---|---|
| **ikaga SHIORI `ikaga.dll`** | A SHIORI/3.0 DLL (32-bit). Runs **from Windows 2000, like SSP**. Dialogue is written as blocks in `ghost.json`, not in C++. |
| **Ukagaka Studio `ukagaka-studio.exe`** | The block editor itself (64-bit, a single self-contained file). A native app with WebView2 embedded in its own window. The UI and the SHIORI are both inside the exe. |

---

## Requirements

|  | |
|---|---|
| **Exported ghosts** (they contain `ikaga.dll`) | **Windows 2000 or later**, matching what SSP supports |
| **Ukagaka Studio** (`ukagaka-studio.exe`) | **Windows 10 / 11** (needs WebView2) |

You **make** ghosts on a recent Windows, and the **ghosts you hand out** run on old Windows too.
The editor sits on WebView2 (Edge), so it does not run on old Windows.

To get there, the SHIORI is built **without the Visual Studio C runtime**.
A normal build pulls in APIs from Vista onward that the code never calls itself,
and then **the DLL fails to load at all** on anything older.
`node tools\check-imports.js` checks that this still holds at any time
(details in [`docs/en/maintenance.md`](docs/en/maintenance.md)).

---

## Download

| Where | What you need | What it is |
|---|---|---|
| [**Releases**](https://github.com/ukagaka-irono/ukagaka-studio/releases) | Nothing | A zip per version. **Usually use this** |
| The run page in [**Actions**](https://github.com/ukagaka-irono/ukagaka-studio/actions) | **A GitHub login** | The latest build of every push. Kept 30 days |

In Actions, scroll the run page to the bottom: they are under **Artifacts**.

* `ukagaka-studio-<version>-<sha>` … the same contents as the Releases zip (exe / README in Japanese and English / CHANGELOG / LICENSE / docs / third_party with YAYA's license)
* `ikaga-dll-<version>-<sha>` … the SHIORI only, for people who put it into a ghost themselves

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

Right below the top bar you switch between the **Talk / Characters / Ghost info / Export** pages.
You build with blocks on the **Talk** page. How to use it and the keyboard shortcuts are under the **?** at the top right.

1. From **Events** on the left, drag something like “When started” onto the canvas.
2. Under it, attach “◯ says □” from **Speech**.
3. With ▶ in the **Try** tab on the right, you see how it talks and its Sakura Script.
   **Current variables** are shown below. If something like affection gets stuck at a strange value,
   start over with “Reset these variables” (inside the editor only) or “Clear the ghost's memory”
   (the exported ghost's `ikaga_save.json`).
4. On the **Characters** page, under “Surfaces”, you can assign your own PNG images to surface numbers
   (numbers you leave out get a simple picture drawn in the colors you choose).
   Under “**Animations**” on the same page you can make animations that flip through surfaces
   (frames are lined up from left to right, each with a preview).
   Set “when” and they play by themselves; you can also start one with the “play animation N” block.
   Each frame has its own drawing method and position, and you can add “areas you can touch only while it plays”.
5. In the **Search** tab (Ctrl+F) you can find blocks by speech text or variable name.
   Click a result to jump there. Copy blocks with **Ctrl+C / Ctrl+V**.
6. The **Check** tab lists empty speech, missing variables, choices that go nowhere and so on.
   If it shows a red number, fix those before exporting. Click an item and
   the canvas scrolls there and the block flashes.

**You can also build with the keyboard alone.** Press **/** (or “+ Block” at the bottom right of the canvas) to open
the block search, type part of a name such as “says” or “petted”, and press **Enter** to place it. It attaches right
below the selected block, and you can type straight into the new block's text field. Press Enter to confirm, then **/** again
to keep building downward.

**Right-click** a block for copy, cut, paste, duplicate, disable and delete; a script's hat for run, duplicate
and delete; empty space for “Find and place a block here”, “Paste here” and “Tidy up”.
The list of keys is on the How to use page, opened with **?** or **F1**.

### 3. Run it in SSP

Just press “**Run it in SSP**” on the **Export** page.

* It finds SSP (`ssp.exe`) by itself: from the running process if SSP is running,
  or from usual places such as `C:\ssp` if it is not.
  If it cannot find it, enter the path of `ssp.exe` in the field on the same page and press “Use this location”.
* It exports straight into SSP's `ghost\` folder and **switches SSP to the ghost**.
* If that ghost was already running, it **only reloads the SHIORI** after exporting (no switch, instant).
* If SSP is not running, “Start SSP” starts it.

To package it for sharing, use “Make .nar” on the same page.
Drag and drop the `.nar` onto the SSP window to install it.

> If you export again while SSP is running, the SHIORI rereads `ghost.json` within a few seconds,
> so you usually do not need to reload by hand.

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

### Where things are saved

Next to `ukagaka-studio.exe`.

| | |
|---|---|
| `projects\` | Projects (your unfinished blocks). A sample is put here on first start (`Ikaga.json` in English, `いかがちゃん.json` in Japanese) |
| `output\` | Exported ghosts (unless you changed the output folder) |
| `ukagaka-studio.json` | The last project opened, the output folder, the window size, the language |
| `webview-data\` | WebView2's working folder (rebuilt if you delete it) |

If you put an `ikaga.dll` next to the exe, it is **used instead of** the embedded one (handy after rebuilding the SHIORI).

---

## Building

If Visual Studio has “Desktop development with C++”, this is all.

```powershell
.\build.ps1            # SHIORI (32-bit DLL) -> Studio (64-bit EXE)
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
| **Block coverage** (`tools\check-blocks.js`) | Whether every block is present in the definitions, the SHIORI, the docs (Japanese and English) and the tests. It needs no build, so it runs first |
| **Parity test** (`shiori\test\parity\parity.js`) | Builds the same `interp.cpp` as **32-bit (the SHIORI that goes into SSP)** and **64-bit (Ukagaka Studio's “Try”)**, feeds both the same `ghost.json`, and compares the Sakura Script that comes out (catches code that depends on the bit width) |
| **Behavior test** (`shiori\test\behavior\behavior.js`) | The decisions only the SHIORI makes — which script to pick when an event has several, the default reactions when there are no blocks (in English for English ghosts), `\-` on `OnClose`, thinning out “every N seconds”, making petting events, where talk-to messages go, SAORI (it actually calls a deliberately slow test DLL) |
| **YAYA test** (`shiori\test\yaya\yaya.js`) | Whether YAYA (`third_party\yaya\`), which is to replace ikaga SHIORI, is still the official build and runs; whether, with the blocks translated into YAYA, the parity ghost gives the same answers as ikaga SHIORI (**a parity test across SHIORIs**), all behavior scenarios hold on YAYA too, and variables survive a restart |
| **Export test** (`studio\test\export.js`) | Whether exported files (`surfaces.txt` / `descript.txt` / `ghost.json` / `install.txt`) are as expected. `updates2.dau` is checked against MD5 from node's `crypto` |
| **Editor test** (`ui\test\editor.js`) | Normalizing loaded projects and checking format versions (`model.js`), the warnings of the Check tab (`lint.js`), searching blocks by text, and that every example is clean |
| **Import check** (`tools\check-imports.js`) | Reads the import tables of the built `ikaga.dll` and of YAYA's `yaya.dll` directly to catch **APIs that Windows 2000 does not have**. With one of those, the DLL fails to load at all below that Windows |
| **UI file check** (`ui\test\modules.js`) | Whether every `ui\js\*.js` (ES module) is reachable from the entry `main.js`, loads first without failing, and every `Xxx.yyy()` call has a target. It catches **things left behind when splitting files**. It also checks that every color in `style.css` goes through a token (so nothing loses its color in the dark theme) |
| **UI language check** (`ui\test\i18n.js`) | Whether all Japanese UI text goes through `t()` and has an English translation (so no Japanese is left on the English screen), whether the dictionary has stale entries or mismatched `{placeholders}`, whether every error code the exe returns has UI text, and whether every document has an English version |

Only these nine use **Node.js** (22.12 or later; skipped if it is not installed. The app itself does not need it).
The behavior test waits on purpose in one place (a slow SAORI overlapping with closing),
so it takes about 10 seconds.
When you add blocks or behavior, update the inputs and expected results in `shiori\test\`, `studio\test\` and `ui\test\`
too. If you changed the export on purpose, check what comes out with your own eyes, then
regenerate the expected files with `node studio\test\export.js --update`.

**The steps for adding one block** (which file gets what) and the common pitfalls are collected in
[`docs/en/maintenance.md`](docs/en/maintenance.md).

These nine also **run automatically on GitHub** (pushes to `main`, `v*` tags, pull requests),
so they stop you even if you forget. The settings are in `.github/workflows/build.yml`.

To build one part, use `shiori\build.ps1` / `studio\build.ps1`.
The studio build runs `studio\tools\embed.ps1`, which packs everything under `ui\` plus `ikaga.dll` and `yaya.dll`
into resources embedded in the exe (rebuild after changing the UI).

The official build of the **YAYA** SHIORI (`yaya.dll`) and its entry dictionary `yaya_base` are in `third_party\`
(they are there to replace ikaga SHIORI in stage 3; see [`docs/roadmap.md`](docs/roadmap.md)). YAYA is not built from source
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

A freshly built `ikaga.dll` or `test_host.exe` can be stopped the same way in the middle of the tests
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
├── shiori/                 the SHIORI (C++ / 32-bit DLL)
│   ├── build.ps1
│   ├── src/
│   │   ├── dllmain.cpp     DLL entry points: load / unload / request
│   │   ├── shiori.cpp      SHIORI/3.0 parsing and event dispatch
│   │   ├── interp.cpp      runs blocks into Sakura Script
│   │   ├── saori.cpp       calls external modules (SAORI)
│   │   ├── program.cpp     reads ghost.json and variables
│   │   ├── json.cpp        a small JSON parser (shared with the studio)
│   │   ├── util.cpp        encodings, files, random numbers (shared with the studio)
│   │   ├── tinycrt.cpp     a small runtime (to run on Windows 2000)
│   │   ├── msvcrt.def      functions borrowed from Windows' msvcrt.dll
│   │   └── ikaga.def       names the DLL exports (load / unload / request)
│   ├── test/               test hosts that run without SSP
│   │   ├── lib/            test helpers (run the 32/64-bit SHIORI and parse its replies)
│   │   ├── parity/         parity test comparing the 32-bit and 64-bit output
│   │   ├── saori/          a “deliberately slow SAORI” for tests
│   │   ├── behavior/       tests of the SHIORI's behavior (what it picks, default reactions)
│   │   └── yaya/           tests that YAYA gives the same answers as ikaga SHIORI (stage 3)
│   └── dist/               build results (ikaga.dll / test_host.exe)
├── studio/                 Ukagaka Studio (C++ / 64-bit EXE)
│   ├── build.ps1
│   ├── test/               checks against expected results (-Test also builds the consoles)
│   │                         export_host  … shows the contents of exported files
│   │                         preview_host … shows the result of the 64-bit ikaga SHIORI (for the parity test)
│   ├── res/                the icon and the first-run samples (Japanese and English)
│   │   └── yaya/           the runtime dictionary studio_runtime.dic and the Try entry studio_preview.dic for YAYA (stage 3)
│   ├── yaya_host/          the 32-bit helper that runs YAYA for “Try” (built by shiori\build.ps1)
│   ├── third_party/        WebView2 SDK (headers + static loader)
│   ├── tools/embed.ps1     turns ui\, ikaga.dll and yaya.dll into resources
│   ├── tools/make-icon.mjs makes the exe icon from the logo (ui/img/logo.svg)
│   └── src/
│       ├── main.cpp        window, startup and shutdown, single instance
│       ├── lang.cpp        the language of what the exe shows itself (Japanese / English)
│       ├── webview.cpp     embeds WebView2 and intercepts its requests
│       ├── webreq.cpp      parses requests (URL decoding and so on)
│       ├── assets.cpp      takes ui\ and ikaga.dll out of the exe
│       ├── sstp.cpp        talks to SSP (SSTP and finding ssp.exe)
│       ├── api.cpp         the /api/* entry (the route table kRoutes)
│       ├── api_project.cpp   state, saving and loading projects
│       ├── api_shell.cpp     surfaces (drawing the placeholder shell, your own images)
│       ├── api_ghost.cpp     Try, and the exported ghost's memory and log
│       ├── api_export.cpp    export, open in Explorer
│       ├── api_ssp.cpp       working with a running SSP
│       ├── preview.cpp     runs a script on the 64-bit ikaga SHIORI (used by the parity test's preview_host)
│       ├── yaya_preview.cpp runs “Try” on YAYA (through yaya_host.exe)
│       ├── exporter.cpp    assembles a whole ghost and writes it to a folder / .nar
│       ├── export_program.cpp  ghost.json (what the SHIORI reads)
│       ├── export_shell.cpp    placeholder surfaces, the shell's descript.txt, surfaces.txt
│       ├── export_seriko.cpp   SERIKO animations in surfaces.txt
│       ├── export_balloon.cpp  the bundled balloon
│       ├── export_dau.cpp      the network update list (updates2.dau)
│       ├── image.cpp       PNG output and a simple rasterizer
│       ├── zip.cpp         .nar (ZIP) output
│       ├── deflate.cpp     deflate compression (fixed Huffman + LZ77)
│       └── fsutil.cpp      file operations
├── ui/                     the UI (embedded in the exe)
│   ├── index.html
│   ├── style.css
│   ├── samples/            examples (“Start from an example”); the English ones are in samples/en/
│   ├── test/               tests that run without showing the UI
│   │                         editor.js  … normalizing, format versions, Check tab, block search, examples
│   │                         modules.js … loading, layer direction, call targets, color tokens
│   │                         i18n.js    … unwrapped t(), the English dictionary, exe error codes, English docs
│   └── js/                 ES modules (index.html reads only main.js)
│       ├── main.js         entry and assembly (each part's init, redrawing everything)
│       ├── shortcuts.js    keyboard shortcuts
│       ├── i18n/           UI text (t() and the English dictionary en.js)
│       ├── model/          data and rules (no DOM)
│       │   ├── blocks.js   block definitions (add here to add a block)
│       │   ├── model.js    project data and undo
│       │   ├── lint.js     the Check tab (empty speech, missing variables, choices that go nowhere)
│       │   ├── blockindex.js  searching blocks by text (the / “find and place”)
│       │   ├── player.js   unpacks Sakura Script (the SHIORI does the running)
│       │   ├── yaya.js     translates blocks into a YAYA dictionary (stage 3)
│       │   └── sample.js   the template for “New”
│       ├── core/           UI foundation (API, notices, UI state, hooks for upper layers, event notices)
│       ├── editor/         canvas and palette (drawing, dragging, zoom, right-click, find and place, copy)
│       └── panels/         pages (Talk, Characters, Ghost info, Export, Help)
│           ├── pages.js    switching pages (right below the top bar)
│           ├── guide.js    the first-steps guide (the card at the top right of the canvas)
│           ├── language.js switching the UI language (English / 日本語 in the top bar)
│           ├── run.js      “Try” on the right of Talk (running, variables, the ghost's log)
│           ├── stage.js    the stage of “Try” (animates the balloon and surfaces)
│           ├── vars.js     “Variables” on the right of Talk
│           ├── search.js   “Check” and “Search” on the right of Talk
│           ├── chara.js    “Characters” (surfaces, placeholder shell colors, balloon, animations)
│           ├── ghost.js    “Ghost info” (names, author, talk interval, network update, ghost language)
│           ├── dialog.js   save / open and export
│           └── ssp.js      working with a running SSP
├── tools/
│   ├── check-blocks.js     checks every block is present in every file (no build needed)
│   └── check-imports.js    checks the SHIORI (and yaya.dll) can be loaded from Windows 2000
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

The editor's “Try” is run by **YAYA**, which replaces ikaga SHIORI in stage 3 (the same 32-bit `yaya.dll` that goes
into SSP). The UI translates the blocks into a YAYA dictionary and asks through `POST /api/preview`; Ukagaka Studio runs it
with `yaya_host.exe`, a small 32-bit helper embedded in the exe (the UI has no block interpreter of its own).
Only two things differ: **it does not call SAORI** (that needs the real 32-bit DLL), and
**the clock and boot count come from the UI**. The YAYA test checks that the answers match ikaga SHIORI.

* It exports `load` / `unload` / `request` as a SHIORI/3.0 DLL (`src/ikaga.def`).
* At startup it reads **`ghost.json`** from the DLL's folder.
* For each event from SSP (`OnBoot`, `OnMouseDoubleClick`, …) it runs the matching blocks
  and returns the resulting Sakura Script in `Value:`.
* When an event has several scripts, it draws one by `weight`.
* It counts `OnSecondChange` and plays a **random talk** (`kind: "talk"`) at the interval you set.
  Recently used talks are left out of the draw so the same talk does not repeat (how many is set per ghost;
  the default is half the number of talks, up to 8). The order is kept in `ikaga_save.json`.
* When an event has several scripts, the one picked last time is avoided too.
* Variables are saved to **`ikaga_save.json`** on close (and every 2 minutes) and restored next time.
* Requests that arrive in Shift_JIS are converted to UTF-8; replies are always UTF-8.
* Events fall into three groups: **the first time** (`OnFirstBoot` / `OnBoot`), **the steady loop** (`OnSecondChange`),
  and **other events**. SSP calls the steady loop every second, so the hat block's
  “every N seconds” thins it out (`everySec`).
* Mouse events can be narrowed down by **the area hit (head, face, chest, skirt, hand) and who was hit**.
  The placeholder shell is exported with hit areas of those names.
* When `OnMouseMove` keeps hitting the same area, the SHIORI makes **`OnNadeNade` (when petted)** itself.
  SSP has no such event; the SHIORI counts it.
* **Talking between ghosts** (`OnCommunicate`) is supported. It can be narrowed down by the sender's name and
  what was said. To talk to someone, the reply carries `Reference0: <their name>`.
  After 8 rounds back and forth, it only talks and stops sending.
* **External modules (SAORI)** stay loaded and are freed together on exit.
  “Calls that do not wait for the answer” run on another thread, but only **one at a time** touches a DLL,
  and **only the main thread** puts answers into variables (so nothing is touched at the same time).
  When an answer arrives, the next `OnSecondChange` turns it into `OnSaoriDone`.
* Scripts with filters take **precedence** over the same event without a filter.
* Events without blocks get modest default reactions such as greetings
  (in English when the ghost language is English).
  `OnClose` always gets `\-` so the ghost really closes.

### Trying it without SSP

```powershell
.\build.ps1 -Test
.\shiori\dist\test_host.exe .\output\Ikaga\ghost\master OnBoot OnMouseDoubleClick:0,0,0,0,Head OnClose
```

Give events as `EventName:ref0,ref1,...`. Add `*count` to repeat, as in `OnSecondChange:0,1*200`.
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
  (they can also be called without waiting for the answer, so slow SAORI do not freeze SSP)
* **Animations** (SERIKO) — flipping through surfaces, made on the Characters page
  (each frame can be shifted and given a drawing method such as `interpolate` or `blend-*`;
  animations can also start or stop other animations, insert an APNG, and add hit areas
  (rectangle, ellipse, circle, polygon) you can touch only while they play)
* **Network updates** (`homeurl`, exporting `updates2.dau`, update events, an update block)
* **Ask** (an input box) — puts what the user typed straight into a variable
* **Call in N seconds** (a simple timer), **raising an event yourself**,
  **switching ghosts** / **opening a browser**
* Generating placeholder shells (surfaces) and a **balloon**
* Info such as the time, weekday, boot count, **time of day (morning/afternoon/evening/night) and season**;
  arithmetic, comparisons and text operations
* **Groups** of random talks (morning talks, season talks, …) and a block that calls one of them
* For when you really need it, a block that “outputs Sakura Script as is”

Not there yet (how to add things is in “Adding one block” in [`docs/en/maintenance.md`](docs/en/maintenance.md)):

* The rest of SERIKO (grouped operations such as `alternativestart`, `scaling` / `insert`,
  the finer kinds of `blend-*`, dress-up (MAYUNA) `bind`)

---

## Safety

* **It opens no ports.** Requests from the UI are received inside WebView2 and handled right inside the exe.
  The only outside connection is `127.0.0.1:9801`, to talk to SSP.
* The UI runs at a **pretend address**, `https://ikaga.example/`,
  and never navigates to outside pages from there (attempts are handed to the default browser).
  Only `http` / `https` are handed over when opening outside links.
* The API inside the exe accepts **only requests from its own UI**
  (a custom header, or a check that they come from the same address).
* When the SHIORI puts **text from outside** (what another ghost said, what was typed into an input box)
  into Sakura Script, it drops the `[` `]` that close tags, and line breaks.
  The “output Sakura Script as is” block, however, passes things through untouched, so do not put
  text from outside into it.
* **Check the contents of a project (.json) you got from someone else before opening it.**
  Surface images are referenced by path, and exporting bundles those images into the ghost.
  If you see a path you do not know, remove it under “Surfaces” on the Characters page.
* The SAORI DLLs the SHIORI (`ikaga.dll`) loads must be inside the ghost folder
  (`..` and absolute paths are refused).
* A ghost can close while a **SAORI called without waiting** is still running. The SHIORI waits only 5 seconds
  and then leaves it behind (so it does not hang there). Even then, the running thread is kept away from
  freed memory and an unloaded SHIORI: they share their storage and the SHIORI pins itself.
* One variable holds at most 32 KB (so endless joining cannot use up memory).
  One reply's Sakura Script is also at most 32 KB; anything beyond is not output.

---

## License

[**Nashi License 1.1**](LICENSE) (the original project “Nashi SHIORI + Nashi Studio”'s own license;
`LICENSE` also contains an English reference translation).
Copyright (c) 2026 月見里　彩葉 (miyagawa-yukinterface)

This fork is distributed under the same terms. The “based on” notice at the top is there because those terms (section 3) require it.

Anyone may use, modify and distribute it, free of charge, for any purpose.

### About the ghosts you make

**Ghosts exported from Ukagaka Studio are entirely yours.**
They contain `ikaga.dll`, but when you hand them out you

* **do not need to include** this license text,
* **do not need to mention** the author or the software anywhere, and
* **may distribute them for a fee**.

We would be happy if you mentioned us, but it is not required.
We do not want to burden people who hand out ghosts, so this is explicitly waived.

### Distributing or forking this software itself

When you distribute `ukagaka-studio.exe` or `ikaga.dll` on their own, or the source,
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
