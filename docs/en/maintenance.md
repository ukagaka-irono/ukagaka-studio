# Maintenance guide

日本語: [../maintenance.md](../maintenance.md)

> **This is the English translation of [docs/maintenance.md](../maintenance.md). The Japanese version is authoritative;**
> **if the two differ, follow the Japanese one.**

Notes for coming back to this repository after a while away.
“What is where” is in the **Folder layout** of the README.
What goes here are **the rules written in places far apart, which break silently if you fix only one side**.

---

## Run these first

```powershell
node tools\check-blocks.js     # 1 second. No build. Are all blocks present everywhere?
.\build.ps1 -Test              # about 3 minutes. Build, then the 9 tests
```

`check-blocks.js` needs no build, so **run it first whenever you change something**.
Inside `build.ps1 -Test` it also runs before the build (you learn about a forgotten file without waiting 2 minutes).

---

## Blocks are always run by the SHIORI

**The rules live in one place only: `shiori/src/interp.cpp`.**

| Where it runs | Who runs it |
|---|---|
| A ghost installed in SSP | `interp.cpp` in `ikaga.dll` (32-bit) |
| The editor's “Try” | **the same** `interp.cpp`, carried by `ukagaka-studio.exe` (64-bit) |

The UI (`ui/js/`) does not interpret blocks. It asks `POST /api/preview`,
`ui/js/model/player.js` unpacks the Sakura Script that comes back, and `ui/js/panels/stage.js` plays it.

> `ui/js/sim.js` used to write the same rules again in JavaScript.
> Fixing only one side showed up later as “it works in the editor but not in SSP”,
> the most troublesome kind of drift. Those 474 lines are gone.

In exchange, **the same code is built as 32-bit and 64-bit**, so the parity test compares
the two. Code that relies on the size of `int` or `size_t` stops there.

`interp.cpp` does not know how to load SAORI DLLs (`SaoriHost` in `saori.h` sits in between).
That lets the studio use only the interpreter without carrying `saori.cpp`.
The preview does not call SAORI, so it passes `NULL` there.

---

## Adding one block

Five places, in order. `node tools\check-blocks.js` names any you missed.

1. **`ui/js/model/blocks.js`** — `def({ type: '…', cat: '…', shape: '…', spec: '…', args: {…} })`.
   This decides its look and its shape in `ghost.json`. Then add its name to the category of
   `PALETTE` you want it in (without that, it is defined but not shown in the palette).
2. **`shiori/src/interp.cpp`** — `if (type == "…")` in `RunBlock`. **This is the only place that runs it.**
   Do not append text directly; go through **`Emit(ctx, …)`** (it applies the length limit).
3. **`docs/blocks.md`** — one row in the table: the `{"type":"…"}` shape and the Sakura Script it outputs.
4. **`docs/en/blocks.md`** — the same row in the English table (with the block name as the English UI shows it).
5. **`shiori/test/parity/ghost.json`** — one under an `OnP**` hat, with an `id`.
   **Make it give the same result every time** (random numbers or the clock give different answers each run).

If the block has a field that must not be empty, add it to **`ui/js/model/lint.js`** (the Check tab) too.
Block text goes through `t()`, so add **its English text to `ui/js/i18n/en.js`** as well (`ui\test\i18n.js` stops otherwise).

Blocks added to `PALETTE` show up in the `/` “find and place” automatically (`model/blockindex.js`
builds its list from `PALETTE`). `ui\test\editor.js` checks that every palette block can be found.

After changing `ui/`, **rebuild the exe with `studio\build.ps1`** (the UI is embedded in the exe).
After changing `interp.cpp`, rebuild **both the SHIORI and the studio**
(`.\build.ps1` builds them in order).

### Adding an info block (`sys`)

Two places: the `options` of `sys` in `blocks.js`, and `SysValue` in `interp.cpp`.
Clock-related values give a different answer every time, so they cannot go into the parity test
(`check-blocks.js` lists them in a note as “info blocks not exercised by the tests”).

### Leaving something one-sided on purpose

Some types and operators are not shown in the palette and exist for hand-written `ghost.json`
(`stop`, `min` / `max` of `arith`, and so on). Add them to **`KNOWN`** in `tools/check-blocks.js`
**with the reason**. Without it, the next person cannot tell
“forgot to delete it” from “on purpose”.

---

## The 9 tests and what each protects

| How to run | What it protects |
|---|---|
| `node tools\check-blocks.js` | that blocks are present in all 5 places (catches forgotten files) |
| `node shiori\test\parity\parity.js` | that the same `interp.cpp` built as 32-bit and 64-bit gives the same output (catches code relying on bit width) |
| `node shiori\test\behavior\behavior.js` | the decisions **only** the SHIORI makes (what it picks, default reactions, thinning, talking between ghosts, SAORI), including English ghosts' default reactions and values such as “time of day” |
| `node shiori\test\yaya\yaya.js` | that YAYA (`third_party\yaya\yaya.dll`) is still the official build (same SHA-256 as in `third_party\README.md`), and that test_host can load it and get answers through the entry dictionary `yaya_base` |
| `node studio\test\export.js` | the contents of exported files (compared byte by byte), including English ghosts' readme.txt, fallback names and `meta.lang` |
| `node ui\test\editor.js` | normalizing loaded projects and format versions (`model.js`), the Check tab (`lint.js`), searching blocks by text (`blockindex.js`), and that the examples (Japanese and English) pass the Check tab |
| `node ui\test\modules.js` | that `ui\js\` is reachable from `main.js`, imports follow the layer rules with no cycles, any file loads first without failing, and every `Xxx.yyy()` has a target. That colors in `style.css` go through tokens |
| `node tools\check-imports.js` | that `ikaga.dll` loads from Windows 2000 (reads the import table directly). `.\build.ps1 -Test` also checks `third_party\yaya\yaya.dll` with it |
| `node ui\test\i18n.js` | that all Japanese UI text goes through `t()` and has an English translation; that the English dictionary has no unused entries or mismatched `{placeholders}` / `%slots`; that every error code the exe returns has UI text; that every document has an English version |

`parity`, `behavior` and `yaya` use `shiori\dist\test_host.exe`, and `parity` also
`studio\test\preview_host.exe`, so **they need a build first** (`.\build.ps1 -Test`).
`check-imports` looks at the built `ikaga.dll`, so it needs a build too.
`check-blocks`, `editor` and `modules` run without a build.

When you changed the export on purpose, **check what comes out with your own eyes**, then
regenerate the expected files with `node studio\test\export.js --update`.

### They run by themselves on push

`.github/workflows/build.yml` runs **the same `.\build.ps1 -Release` as on your machine** on windows-latest
for every push to `main`, every tag (`v*`) and every pull request.
It is there to stop you even if you forget, so **if it turns red, fix it before moving on**.

* There are two jobs. `そろい点検` (block coverage; no build, about 1 minute) reports first,
  then `ビルドとテスト` (build and test; about 5 minutes) goes through the same steps as a release.
* The runner has MSVC and the Windows SDK, and the WebView2 SDK is in
  `studio/third_party`, so **nothing is downloaded**.
* Runners have no Smart App Control, so things pass more smoothly than on your machine.

### Downloading the results

Scroll an Actions run page to the bottom for **Artifacts**. They are kept for **30 days**.

| Name | Contents |
|---|---|
| `ukagaka-studio-<version>-<sha>` | exactly the same as the distributed zip (`ukagaka-studio.exe` / `README.md` / `README.en.md` / `CHANGELOG.md` / `LICENSE` / `docs`, including the English `docs/en` / `third_party` with YAYA's license) |
| `ikaga-dll-<version>-<sha>` | `ikaga.dll` only, for people who put it into a ghost themselves (the editor's exe carries the same one) |

`LICENSE` is always included because the bundled WebView2 SDK requires its copyright notice
when distributed. `build.ps1 -Release` also **stops right there** if `LICENSE` is missing.

> **Actions artifacts cannot be downloaded without logging in to GitHub.**
> The download button is not shown to people who are not logged in.
> To give it to everyone, push a tag starting with `v` and make a Release.

They are not signed, so, like the exe on your machine, Windows may stop them.

---

## Rules for the UI files

`ui/js/` is **ES modules** (`import` / `export`). No build tools are used.
WebView2 and node both read the files as written.

* `index.html` reads **only `js/main.js`** (`<script type="module">`).
  Everything else is loaded by following `import` from `main.js`.
  **When you add a file, import it somewhere** (a file nothing reaches is never used).
* Take what you use at the top of the file, like `import { Model } from '../model/model.js';`.

### The four layers

```
ui/js/
├── main.js        assembly (calls each part's init(), redraws everything)
├── shortcuts.js   keyboard (calls into many layers, so it sits with the assembly)
├── panels/        pages   pages / tabs / run / stage / vars / search / chara / ghost / dialog / ssp / guide / language
├── editor/        canvas and palette   render / drag / palette / scripts / zoom / contextmenu / picker / clipboard
├── core/          UI foundation   dom / api / toast / session / title / commands / events / theme
└── model/         data and rules (no DOM)   blocks / model / lint / blockindex / player / sample
```

**Imports point downward only.** Files in the same layer may import each other, but **never in a cycle**
(A imports B and B imports A).

| Layer | May import from |
|---|---|
| `model/` | `model/` |
| `core/` | `core/` `model/` |
| `editor/` | `editor/` `core/` `model/` |
| `panels/` | `panels/` `editor/` `core/` `model/` |
| top level (`main.js` `shortcuts.js`) | anywhere. But only `main.js` may import top-level files |

(`i18n/` is the lowest layer of all: everything may import it, and it imports nothing.)

* **When a lower layer needs to trigger something in an upper layer** (the ▶ button on a block running “Try”, say),
  go through `Commands` in `core/commands.js`. Add a name there, and the owner fills it in from its `init()`
  with `provide({ … })`. There are only two today: `runScript` (`panels/run.js`) and
  `promptNewVariable` (`panels/vars.js`). **Before adding one, consider moving that function down a layer.**
* **When an upper layer should hear that “something is done”** (an example was opened, ▶ ran, an export finished →
  a ✓ in the first-steps guide), use `Events.emit('name')` in `core/events.js`. The listener waits with
  `Events.on('name', fn)`. Unlike `Commands`, the sender does not care whether anyone listens.
  The names today are `sample-opened`, `ran`, `exported` and `installed`.
* The project contents (what becomes `ghost.json`), undo, and the unsaved mark belong to
  `Model` in `model/model.js`. Change things through `Model.act(() => { … })`, and
  undo history and redrawing come with it.
* State that is not saved — “the current state of the screen” (zoom, variables while trying, copied blocks, …) —
  goes in `Session` in `core/session.js`.
* Each part exports one object shaped like `{ init, render, … }`. The part wires its own buttons
  in its own `init()`; `main.js` just calls them in order. Redrawing happens whenever `Model` changes:
  `renderAll()` in `main.js` calls each part's `render()`.
* **Only one page (`.page`) is shown at a time** (`panels/pages.js`: Talk, Characters, Ghost info, Export, Help).
  `renderAll()` redraws only what is always visible (the top bar and the Check count) and **the page currently shown**.
  Switching pages draws that page through `Pages.onShow`. To add a page, add
  `<div class="page" data-page="…">` to `index.html`, a button to `#mode-bar`, and the part to draw to the `switch` in `renderAll()`.
* UI parts only change the project through `Model.act` / `Model.pushUndo` and do not redraw themselves
  (`renderAll()` redraws whatever is visible; drawing twice can lose a field you are typing in).
* The canvas is rebuilt on every redraw, so the selected block gets a new element too.
  After drawing, `renderAll()` calls `Drag.reselect()`, which selects the new element of the same block
  (this is what lets you keep placing blocks with `/`).
* `model/` does not touch the DOM, so node tests (`ui\test\editor.js`) can use it directly.

### UI text (Japanese and English)

* **All text shown in the UI goes through `t('日本語の文')`** (`ui/js/i18n/i18n.js`). The Japanese sentence itself is the key.
  To insert values, do not glue sentences together; write one sentence such as `t('「{name}」を保存しました', { name })`
  (word order changes in English). Slots in block text such as `%who` stay in the key as they are.
* English goes in `ui/js/i18n/en.js` as `'日本語の文': 'English'`. **Every UI string needs a translation**
  (`ui\test\i18n.js` stops on a missing one; `node ui\test\i18n.js --missing` prints the missing ones in en.js form).
  **When you reword a Japanese sentence, update its key in en.js to match** (stale entries are stopped too).
* One Japanese sentence has exactly one translation. To use different English in different places
  (the heading “Surfaces” and the field “surface #”, say), split the Japanese sentence instead
  (「立ち絵」 and 「立ち絵の番号」).
* Text in `index.html` is translated fragment by fragment, split at `<b>` and the like. HTML whitespace before a
  fragment is kept, so do not start such a fragment's translation with “,” or “;” (you get “/ , search”).
* Pass `t()` the literal text (with a variable, nobody can check which sentences are used).
* Japanese that is never shown in the UI (errors meant for developers, say) gets `// i18n-ignore` on its line.
* Text written directly in `index.html`, and `title` and the like, can stay as it is. `translateDom()` replaces it at startup
  (line breaks and indentation are collapsed into single spaces before the lookup).
* The language is decided once at startup (setting `ikaga.lang` → the Windows display language). `setLang()` reloads the page.
  That is why text built outside functions, such as block definitions, can use `t()` too.
* `ui/js/i18n/` is the lowest layer (anything may import it; it imports nothing).
  Node tests pin Japanese with `globalThis.IKAGA_LANG = 'ja'` (node's language is en-US).
* Switching with “English” / “日本語” in the top bar (`panels/language.js`) reloads the page. The open project
  (unsaved changes and the page you were on included) is left in `sessionStorage` and picked up by the next startup
  (`boot` in `main.js`). Undo history is not carried over.
* **What the exe shows itself** (message boxes, the file picker, the exported readme.txt and so on) is written with
  `Tr("日本語", "English")` from `studio/src/lang.h`. The exe's language is decided at startup from the setting
  (`lang` in `ukagaka-studio.json`) → the Windows display language, and once the UI loads, `main.js` sends
  `lang:ja` / `lang:en` to match (the exe saves it in the setting too).
  Message-box buttons (Yes / No) stay in the Windows language.
* **`/api/*` errors are not translated in the exe.** They are returned as codes, as in `JsonError(res, 400, "bad_json")`,
  and the UI turns them into text with `ERRORS` in `ui/js/core/api.js` (extra details go in `detail`).
  When you add an error, add it to `ERRORS` too. `ui\test\i18n.js` stops if you forget.
* **The ghost language is separate from the screen language** and lives in the project's `meta.lang` (`"ja"` / `"en"`;
  “Ghost language” on the Ghost info page). New ghosts and examples take the screen language at creation.
  Projects without it (older ones) are Japanese.
  `Model.normalize` never fills it from the screen language (so a ghost made in Japanese does not turn English just
  because you opened it with the English UI).
* For an English ghost, exported files (readme.txt, the fallback names New Ghost / Sakura / Kero, the balloon name)
  are English, and `meta.lang` in `ghost.json` becomes `"en"` (nothing is written for Japanese, so the output is unchanged).
  The SHIORI reads it and switches its own lines (`shiori.cpp`) and the values of “time of day”, “season” and “weekday name”
  (`interp.cpp`; `朝` → `morning` and so on) to English. Scripts compare against those values, so they follow the
  ghost language, never the screen language. “Try” runs the same SHIORI code, so it gets the same values.
* **Examples are per language.** The English examples are in `ui/samples/en/` (as many as the Japanese ones;
  `ui\test\editor.js` checks the count and the ghost language). The samples placed on first start are
  `studio/res/sample-project.json` and `sample-project.en.json` (the English one when the exe's language is English;
  `Api::PlaceFirstRunSample`). Example layouts were made with “Tidy up” in the UI of their language.
  The “New” template (`model/sample.js`) uses the same positions in both languages, so check it does not overlap in either.

### Colors (light and dark themes)

* **Use only the tokens in `:root` of `ui/style.css`** (`var(--surface)`, `var(--text-muted)` and so on).
  Each token is written as `light-dark(light, dark)`, with both colors in one place.
  If you need a new color, look for a similar token first; if there is none, add one to `:root`.
* The only colors you may write directly are the translucent white and black laid over blocks
  (`#fff`, `rgba(0,0,0,…)`, `rgba(255,255,255,…)`).
  Anything else stays light in the dark theme (`ui\test\modules.js` stops it).
* Colors set from JS use tokens too, such as `var(--danger)`. Block category colors are `--cat-<id>`.
* `core/theme.js` picks the theme with `data-theme` on `html` (none means follow Windows).
  It also sends `theme:dark` / `theme:light` to the exe to match the title bar (`studio/src/main.cpp`).

### Files from elsewhere (`third_party/`)

* `third_party/` holds YAYA's official build (`yaya/`) and its system dictionary `yaya_base` (`yaya-dic/`)
  **byte-for-byte as distributed** (`.gitattributes` keeps git from rewriting line endings). **Do not edit them.**
* To upgrade, replace them as a whole and update the version, date and SHA-256 in `third_party/README.md`.
  `shiori\test\yaya\yaya.js` checks that `yaya.dll` matches that SHA-256.
* YAYA is not built from source: built with today's Visual Studio, it pulls in APIs Windows 2000 does not have (step 3-0 in `docs/roadmap.md`).
* `yaya.dll` is embedded in the exe, so the release zip carries the text of YAYA's license (`-Release` in `build.ps1`).

### Documents (Japanese and English)

* The documents in `README.md` and `docs/` have English versions (`README.en.md`, `docs/en/`). **The Japanese ones are
  authoritative**, and each English version starts by saying so. The license (`LICENSE`) belongs to the original author
  and is not translated (an English reference translation is already inside `LICENSE`). `CHANGELOG.md` is Japanese only.
* **When you change a Japanese document, update its English version too.** When you add a document, add an English one
  (`ui\test\i18n.js` stops if a document in `docs/` has no English version, or the version lacks the opening note).
* `tools\check-blocks.js` checks that the English block reference (`docs/en/blocks.md`) has every block too.
* Links inside the English versions are relative to one level deeper (`docs/en/`). The Japanese originals are at `../`,
  and the README is `../../README.en.md`.

### Keyboard and right-click

* Shortcuts are collected in `ui/js/shortcuts.js`. **When you add one, add it to the table on the Help page**
  (“キーボードとマウス” in `index.html`) **too.** Inside text fields, only a few such as
  `Ctrl+S` work. Block operations work only while the Talk page is shown.
* Right-click menus are in `editor/contextmenu.js`. Write `key: 'Ctrl+C'` on an item to show the key on the right.
* Copy, cut, paste, duplicate and delete for blocks are in `editor/clipboard.js`, which both the menus and the keys call.
  Change them there; changing only one side makes the menus and the keys behave differently.

### Other

* The only things reachable from outside the page are what `main.js` puts on `window.IKAGA`.
  The exe (`studio/src/main.cpp`) calls `IKAGA.Model.dirty` and
  `IKAGA.Dialog.requestSaveAndClose()` when closing. If you rename them, fix that side too.
* `ui/js/package.json` (`"type": "module"`) tells the node tests to read this folder as ES modules.
  It is not put into the exe (`studio/tools/embed.ps1`).

`node ui\test\modules.js` checks that these rules hold.
It stops imports against the layer direction and cyclic imports, naming the file and line.
It also loads each file on its own as “the first file loaded” and checks it does not fail.

The node tests read ES modules with `require()`, so they need **Node.js 22.12 or later**
(Actions uses 24).

---

## Rules for the studio (`studio/src/`)

**Adding one `/api/…`** takes 3 places.

1. Declare `void Xxx(const HttpRequest& req, HttpResponse& res);` in `Api` in `api.h`
   (it is grouped by purpose, so put it near similar ones).
2. Write the body in the `api_*.cpp` of the closest purpose. Return with `Json(res, 200, o)`;
   fail with `JsonError(res, 400, "code")` (both in `api_util.h`). Errors are codes (such as `bad_json`), not sentences;
   for a new code, add its UI text to `ERRORS` in `ui/js/core/api.js`.
3. Add one line `{ "POST", "/api/…", &Api::Xxx }` to **`kRoutes`** in `api.cpp`.

Rejecting requests from other pages happens in one place, `Api::HandleApi`, before `kRoutes` is looked up.
`api_*.cpp` does not need to check again.

**When adding or changing exported files**, `BuildGhostFiles` in `exporter.cpp` assembles the list,
and the contents are in an `export_*.cpp` per kind of file (there is a list at the top of `exporter.cpp`).
Things shared between `export_*.cpp` go in `export_parts.h`; things used elsewhere too go in `exporter.h`.
The export test (`studio\test\export.js`) compares bytes, so when you change the contents,
check them with your own eyes and then regenerate the expected files with `--update`.

**Text the exe shows itself** (message boxes and so on) is written in both languages with `Tr("日本語", "English")` (`lang.h`).

**When you add a `.cpp`, add it to the lists in `studio\build.ps1` too** (`$apiSources` / `$exportSources`;
the export console gets the same list for the export files).

---

## The SHIORI is built without the C runtime

SSP runs on **Windows 2000 and later**. The SHIORI is a DLL that SSP loads, so it has to match.

But if you link Visual Studio's C runtime statically the usual way (`/MT`), **APIs you never call yourself**,
such as `FlsAlloc` and `InitializeCriticalSectionEx` (both from Vista), end up in the import table.
The import table **must be fully satisfied at load time**, so on old Windows
**the DLL cannot even be opened**. On a Windows 11 machine it naturally works,
so reading the source does not reveal it.

So the SHIORI is built like this:

* `/NODEFAULTLIB` drops the CRT entirely,
* it links to **the `msvcrt.dll` that ships with Windows** (`shiori/src/msvcrt.def`), and
* only the Visual Studio-specific pieces still missing are provided by `shiori/src/tinycrt.cpp`.

Things that are “easy to get wrong if you write them yourself”, such as `strtod` and `sprintf`,
are the borrowed real ones. `ikaga.dll` went from 268 KB to 134 KB.

**`node tools\check-imports.js` checks that this holds.** It reads the import table of the built PE
directly and stops, naming them, if APIs missing from Windows 2000 slip in.
It is part of `.\build.ps1 -Test` too.

### Careful when touching this

* **Write `shiori/src/msvcrt.def` in ASCII only.** `lib.exe` reads `.def` files in the
  ANSI code page, so a Japanese comment **swallows the next line**
  (`memcpy` and `strlen` really did disappear silently).
* When you borrow another function, check that **Windows 2000's `msvcrt.dll` has it too**.
* Nothing throws exceptions. Where one would be thrown (out of memory, too long), it just ends there.
  The SHIORI caps things at 32 KB, so this does not normally happen.
* `<random>` and conversions between 64-bit integers and floating point call functions that exist only in the CRT.
  How to avoid them is commented at `NumToStr` and the random numbers in `util.cpp`.
* **Ukagaka Studio (64-bit) keeps the normal CRT.** The same `.cpp` files are built for both,
  but only the SHIORI links `tinycrt.cpp`. The parity test checks both give the same answers.

---

## Logo and mascots

The **logo** is just `ui/img/logo.svg`. The top bar and the tab icon use it as is.
If you redraw it, rebuild the exe icon (`studio/res/ukagaka-studio.ico`).

```powershell
node studio\tools\make-icon.mjs     # draws 16–256 px with Windows' Edge and packs them into a .ico
.\build.ps1                         # puts it into the exe again
```

It does not run on every build (the finished .ico is kept in the repository).

The **mascots'** names (main character いかがちゃん and partner しおり; Ikaga and Shiori in English) are written right in the
examples' contents. To rename them, change these files.

| File | Where |
|---|---|
| `ui/samples/*.json` (5) and `ui/samples/en/*.json` (the 5 English ones) | `meta.sakuraName` / `meta.keroName`, and the lines of the greeting example |
| `studio/res/sample-project.json` and `sample-project.en.json` | the first-run samples: `meta` and lines |
| `studio/src/api.cpp` | the file names placed on first start (`いかがちゃん.json`, `Ikaga.json`) |
| `docs/ghost-json.md`, `README.md` (and their English versions) | as examples |

The default name for “New” (**あたらしいゴースト**, **New Ghost** in English) is in the UI (`model.js`, `sample.js`, `title.js`,
`index.html`; the English in `en.js`) and in `GhostName()` for exports (`studio/src/exporter.cpp`). The names
「なしこ」 and 「つぶ」 in the SHIORI test ghosts and the export test inputs are test material and were left as they are.

---

## Common pitfalls

**Smart App Control stops freshly built files.**
`test_host.exe`, `ikaga.dll` or `ukagaka-studio.exe` sometimes cannot be loaded with
“An Application Control policy has blocked this file” (error 4551).
**Building again usually gets it through.**
See “If Smart App Control blocks it” in the README for more.

It is tempting to blame antivirus (Defender), but **it is something else**.
What blocks it is Code Integrity, and nothing shows up in Defender's detection history.
**These two tell you which one it is.**

```powershell
# 1=on (enforced) / 2=evaluation / 0=off
Get-ItemPropertyValue "HKLM:\SYSTEM\CurrentControlSet\Control\CI\Policy" VerifiedAndReputablePolicyState

# the blocker records the file name (ID 3077 is a block)
Get-WinEvent -FilterHashtable @{LogName="Microsoft-Windows-CodeIntegrity/Operational"; Id=3077} -MaxEvents 5 |
  Select-Object TimeCreated, Message
```

If `ikaga.dll` appears there, that is the cause.
If you suspect Defender, use `Get-MpThreatDetection` (if it shows nothing, Defender is not involved).

**`studio\test\expected\` is compared byte by byte.**
`.gitattributes` marks it `-text` so git does not rewrite line endings.
If a diff looks wrong after regenerating expected files, try `git add --renormalize`.

**The test SAORI (`slow_saori.dll`) has `load` / `unload`.**
They have the same names as the SHIORI's, so intermediate files in the same place collide at link time
(they are kept apart in `obj\x86\testbuild\`).

**`ukagaka-studio.exe` has a window.** Writing `& .\ukagaka-studio.exe` in a script
does not return. Start it by hand to see how it behaves.

**After changing `ui/`, rebuild the exe.** Opening `ui\index.html` directly in a browser shows
the UI, but saving, exporting and “Try” do not work (they all call into the exe).

---

## Releasing a version

1. Edit `VERSION` (one line at the root). The zip name and the exe properties read only this.
2. Add what changed to `CHANGELOG.md`.
3. `.\build.ps1 -Release` — clean rebuild, tests, and `dist\ukagaka-studio-<version>.zip`.
   (This one is for looking at locally; what is distributed is the one Actions makes.)
4. `git tag -a v<version> -m "…"` and `git push origin v<version>`.
5. **Actions does the rest.** When it receives the tag, it builds, runs the tests,
   and creates a Release **as a draft** with that zip attached.
6. Open Releases on GitHub, look it over, and if it is fine press **Publish release**.
   Nobody can see it until you do.

> **Why a draft?** Right after pushing a tag you may still want to withdraw it
> (`v1.0.4-beta` really went that way). The one click to publish is left on purpose.
> To publish automatically, remove `--draft` from `build.yml`.

What gets distributed is **exactly what passed the tests for that tag**. A different zip rebuilt
locally is never attached. Tags with a `-`, such as `v1.0.4-alpha`, automatically become
pre-releases.

---

## When in doubt

* What a block means → `docs/en/blocks.md`
* The shape of `ghost.json` → `docs/en/ghost-json.md`
* How to use it, the folder layout, how the SHIORI works → `README.en.md`
* The rework plan and what has been decided → `docs/en/roadmap.md`
* The Japanese originals (authoritative) → `README.md`, `docs/`
* The Sakura Script and SHIORI specifications themselves → UKADOC (Ukagaka documentation)
