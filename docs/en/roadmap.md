# The rework plan

日本語: [../roadmap.md](../roadmap.md)

> **This is the English translation of [docs/roadmap.md](../roadmap.md). The Japanese version is authoritative;**
> **if the two differ, follow the Japanese one.**

The plan for substantially reworking **Ukagaka Studio (伺かスタジオ)**, which branched off from
“Nashi SHIORI + Nashi Studio”. Decisions are added here as they are made.

---

## What does not change (premises)

Whatever the rework does, these stay. Each is a core strength of the original project.

* **ikaga SHIORI (`ikaga.dll`) runs from Windows 2000.** It stays built without the C runtime.
  `node tools\check-imports.js` watches this.
* **The rules that run blocks live in one place only, `shiori/src/interp.cpp`.**
  The UI's “Try” uses the same code, carried inside the exe.
* **Ukagaka Studio runs as a single exe.** No runtime to install, no open ports,
  no outside connections (it only talks to SSP).
* **No new tools to build the UI.** The files in `ui/` go into the exe as written
  (you can build with just `.\build.ps1`, without installing Node or npm).
* **Nothing goes in unless the tests pass.** Each stage turns `.\build.ps1 -Test` green before moving on.

> **Stage 3 changes the first and second premises above** (decided on 2026-10-22; see “Decisions” below).
> ikaga SHIORI is dropped and replaced with **YAYA**, and Ukagaka Studio becomes **a helper tool for YAYA ghosts**.
> Once stage 3 is done, the premises read:
>
> * **Exported ghosts run from Windows 2000.** Step 3-0 confirmed from its import table that the official `yaya.dll` meets this
>   (built from source with today's Visual Studio it does not, so the official one is used).
> * **Only YAYA runs blocks.** “Try” also runs on the same `yaya.dll` that goes into SSP.
>   The rules that translate blocks into YAYA live in one place only.
> * The other three (a single exe, no new tools to build the UI, nothing goes in unless the tests pass) stay.

---

## Order of work

The three goals (internal cleanup, UI redesign, new features) are done **in this order**.

```
Stage 0  Groundwork          getting ready as a fork
Stage 1  Internal cleanup    reorganize the UI code (to make the UI easier to rework)
Stage 2  UI redesign         rework the look and the layout of pages
Stage 3  On to YAYA          replace ikaga SHIORI with YAYA; become a helper tool for YAYA ghosts
Stage 4  New features        new blocks, shell features, the rest of SERIKO
```

Stage 3 (the move to YAYA) was decided after stage 2 was done and placed before the new features,
so that new blocks and shell features are built on YAYA from the start rather than on ikaga SHIORI.

**Cleanup comes first** because the UI code centered on `app.js` (864 lines),
with everything connected through a single container, `window.IKAGA`.
Changing the look in that state would break unrelated things every time.
Splitting it first turns the UI redesign into “swapping parts”.

Small features (a single block and the like) may go in during stages 1 and 2.

---

## Stage 0 — Groundwork

| | What | Done when |
|---|---|---|
| 0-1 | Push to GitHub and confirm Actions (`build.yml`) is green in the fork too | a green badge |
| 0-2 | Decide the version number (e.g. restart counting from `0.1.0-alpha`) | `VERSION` and `kStudioVersion` (`api.cpp`) agree |
| 0-3 | Decide the branding: the logo (🍐 for now), the example and default character names (なしこ, なしちゃん, なしゴースト) → **decided** (“Decisions” below). Swapped in stage 2 | the 5 examples and the defaults replaced |
| 0-4 | Show the original project in an “About this software” screen in the app | license section 3 satisfied outside the README too |

---

## Stage 1 — Internal cleanup

### 1-1. Turn the UI code into ES modules (done)

> Done: `index.html` reads only `js/main.js`, and everything else is reached through `import`.
> A few files still imported each other; 1-2 removed that.

Back then, files were loaded in the order written in `index.html`, and each one put its part on `window.IKAGA`
(the rule “**load order is the dependency direction**”, guarded by `ui/test/modules.js`).

Change this to what browsers already have: **`import` / `export` (ES modules)**.

* No new build tools (WebView2 reads them as is).
* The rule “look up later-loaded things at call time” is no longer needed. Dependencies are written at the top of each file.
* Node (v24) reads ES modules as is, so tests just `import` the same files.
* When served from inside the exe, `.js` needs the Content-Type `text/javascript`
  (check `studio/src/webview.cpp` / `assets.cpp`).

### 1-2. Split `app.js` (done)

`app.js` held state, redrawing, the meta fields, the variable list, zoom, the right-click menu,
“Try” and the examples, all together. It was split like this:

```
ui/js/
├── main.js    assembly only (each part's init, redrawing everything)
├── shortcuts.js
├── panels/    each tab on the right (run, shell, ghost, variables, search and check, save and export, SSP)
├── editor/    drawing, dragging, palette, script operations, zoom, right-click
├── core/      API calls, notices, UI state (Session), hooks for upper layers (Commands)
└── model/     block definitions, project data and undo, checks, unpacking Sakura Script, the template
```

> Done: imports point only from upper layers to lower ones, and **there is not a single cycle**
> (`ui\test\modules.js` watches the layer direction and cycles). The only calls from a lower layer upward
> are the two in `core/commands.js` (`runScript` / `promptNewVariable`).
>
> Changed from the plan:
>
> * **No `store.update(...)`.** The project contents, undo and the unsaved mark were already held in one place by
>   `Model` (`Model.act` / `Model.onChange` / `Model.dirty`).
>   Only “UI state that is not saved”, which was mixed into `App`, moved to `Session` in `core/session.js`.
> * **No `blocks/`; it went into `model/`.** Both are DOM-free “data and rules”,
>   usable the same way from node tests.
>
> Left over: redrawing was still `renderAll` (redraw everything).
> When stage 2 reorganizes the pages, it moves toward drawing only what changed.

### 1-3. Clean up the studio (C++) (done)

* `api.cpp` (655 lines) listed every `/api/...` branch in one function.
  Make it a table of routes (path → function) and split it into `project` / `ssp` / `export` / `shell`.
* `exporter.cpp` (771 lines) splits descript, surfaces, balloon, updates2.dau and nar
  into their own files. The export test (`studio/test/export.js`) watches the bytes, so it can be
  **split without changing the contents**.

> Done:
>
> * `api.cpp` now holds only the route table (`kRoutes`) and the shared check (rejecting requests from other pages);
>   the bodies moved to `api_project` / `api_shell` / `api_ghost` (Try, memory, log) / `api_export` / `api_ssp`.
>   On top of the planned four, `api_ghost` groups “Try” with the exported ghost's memory and log.
> * `exporter.cpp` now only assembles the file list and writes it; the contents moved to `export_program` (ghost.json) /
>   `export_shell` (placeholder surfaces, surfaces.txt) / `export_seriko` (animations) / `export_balloon` /
>   `export_dau`. What `exporter.h` offers to others did not change.
> * “The export folder name”, written the same way in 3 places, became `GhostFolderName()`, and
>   “strip the "…" around a path”, in 2 places, became `Unquote()`.
> * The export test still matches byte for byte, and every `/api/*` was called in the real exe to check the answers.

### 1-4. Give the project format a version (done)

**Actually check** `"format": "ikaga/1"` when loading.

* Promise in tests that `nashi/1` (projects from the original Nashi Studio) can be read.
* When the format changes, make it `ikaga/2` and add “the 1 → 2 upgrade” to `model.normalize`.

> Done: `Model.normalize` reads `format` first; it opens `ikaga/1`, `nashi/1` and unversioned files (version 1),
> and refuses versions that are too new and unknown formats, with a reason. When it refuses, the project currently open stays
> (if the previous project cannot be read at startup, it starts from the template and says so).
> Upgrades are added to `MIGRATIONS` in `model.js` (a table of version n → n+1 functions). There are none yet.
> The rules are in “format (format version)” in `docs/ghost-json.md`, the tests in `ui\test\editor.js`.

---

## Stage 2 — UI redesign

### Order within stage 2

| # | What | Why in this order |
|---|---|---|
| 1 | 2-1 visual foundation (tokens, dark theme) | it depends on nothing else, and everything after sits on the tokens |
| 2 | 2-4 branding (logo, mascots, default name) | small and separable |
| 3 | 2-5a the English mechanism (dictionary and `t()`, a test that finds gaps) | in place before the pages are rebuilt, new pages use the dictionary from the start |
| 4 | 2-2 page layout → 2-3 usability | the biggest rework, once the mechanisms are in place |
| 5 | 2-5b the English text (translations, codes for exe messages, English docs) | translate once the wording has settled |

### 2-1. Visual foundation (done)

* Gather colors, sizes, corner radii and shadows into **CSS variables (design tokens)**,
  replacing the values written directly in `style.css` (534 lines).
* **Dark theme** (following Windows, plus a manual switch).
* Review block colors per category, and do not rely on color alone (shape or icons should tell them apart too).

> Done:
>
> * The colors in `style.css` are gathered into meaningfully named tokens on `:root` (`--bg` `--surface` `--text-muted` `--danger` …).
>   Each token is `light-dark(light, dark)`, with both colors in one place.
>   The only colors written directly are the translucent white and black over blocks (`ui\test\modules.js` watches this).
> * **Dark theme**: it follows Windows by default, and the ◐ / ☀ / ☾ button in the top bar pins light or dark
>   (`core/theme.js`, remembered on this PC). The window title bar and the background before the UI appears match too.
> * Block colors, input fields and the stage's balloons look the same in both themes (matching Scratch and SSP).
>
> Left over: **reviewing block colors and “not relying on color alone”** goes with 2-2, which reworks how blocks look.
> Category colors are unchanged; they were removed from `blocks.js` and now live only in `--cat-*` in `style.css`.

### 2-2. Page layout (done)

The narrow column on the right held six tabs: run, ghost, variables, search, check and export;
the “ghost” tab in particular crammed together meta info, settings, shell, animations and placeholder shell colors.

Ideas:

* **A big switch at the top**: “Talk (blocks)”, “Characters (shell, animations)”, “Ghost info”, “Export”
* Keep in the right column only what you want while building (run, variables, check, search)
* Give animations (SERIKO) their own page, with frames laid out side by side

> Done:
>
> * Right below the top bar there is a **Talk / Characters / Ghost info / Export** switch, each a page of its own
>   (`panels/pages.js`). Pages other than Talk lay out cards in two readable columns.
> * The right column of Talk has only **Try, Variables, Check, Search** (from 7 to 4). “▶ Run” no longer wraps onto two lines.
> * **Help** is a page opened with the **?** at the top right, and the overlapping “shortcuts” and “keyboard” tables were merged.
> * **Characters**: surfaces are cards with large previews; animations lay **frames out left to right**, each with a preview
>   (frames that start or stop other animations, animated images, and numbers without a picture are labeled in text).
> * `panels/shell.js` (505 lines) was split to match the pages: `chara.js` (Characters), `stage.js` (the stage of Try)
>   and `surfaces.js` (looking up surface pictures). Field binding went into `fields.js`.
> * **Only the page currently shown is redrawn** (the homework from 1-2). Hidden pages are drawn when you switch to them.
> * Pressing Delete on another page no longer deletes blocks on the hidden canvas. Ctrl+F returns to the Talk page.
> * **Block colors**: the colors stay Scratch's, and **the text became black** (white text measured 1.7–2.3 contrast on
>   yellow and orange; black is 4.3 or more on every color). Chosen from three variants (“Decisions”).
>   Shape and text carry the meaning, so nothing relies on color alone.
> * **Overlapping examples**: scripts overlapped in the “New” template, the first-run sample and all 5 examples.
>   **“Tidy up” now measures the actually drawn sizes** (it used to assume 420 px width, so long scripts spilled
>   into the next column), and the examples were laid out again with it. Columns wrap at the visible canvas height.

### 2-3. Usability (done)

* Guidance for newcomers (the path from an example → running it → exporting)
* Placing blocks with the keyboard alone (search, then Enter to place)
* Right-click menus and a list of shortcuts

> Done:
>
> * **First-steps guide**: on first start, a card at the top right of the Talk page shows “Open an example → Try it with ▶ → Run it in SSP”.
>   Steps get a ✓ once done (in any order), and the card closes when all three are done or with “Don't show again”.
>   “Show the first-steps guide again” in Help brings it back (`panels/guide.js`).
>   It hears about finished steps through a new small mechanism, `core/events.js` (`Events.emit('ran')` and so on; notices from lower layers to upper ones).
> * **Placing blocks with the keyboard alone**: `/` (or “+ Block” at the bottom right of the canvas) opens a search box;
>   type part of a name and press Enter to place it (`editor/picker.js`).
>   * It attaches right below the selected block (at the top of the script when a hat is selected) and selects the new block.
>     If it has a text field you can type right away; Enter confirms. Repeating `/` → type → Enter builds downward.
>   * With nothing selected, it goes into free space in view as a new script. It measures what it places and
>     overlaps neither other scripts nor the guide or the buttons at the bottom right. If the view is full, it goes below and scrolls into view.
>   * It respects block shapes: nothing attaches under “end the talk here”, and round blocks become new scripts with a hint on how to use them.
>     Enter during Japanese IME conversion does not place anything.
>   * How it searches (`model/blockindex.js`, tested in `ui\test\editor.js`): hiragana, katakana and full/half width are folded;
>     matches in a block's fixed text come before matches in default field values; ties keep palette order.
>     “話す” finds the say block first, “改行” the new-line block. Internal names (`say`, `OnBoot`) work too.
> * **The selected block stays selected across redraws** (before, any change dropped it).
> * **Right-click menus**: **empty space** has a menu too (find and place a block here, paste here, tidy up).
>   The block menu gained “copy”, “cut” and “paste below”, and shows the key for anything a key can do.
>   Copy, paste, duplicate and delete use the same code from menus and keys (`editor/clipboard.js`).
> * **Ctrl+V** pastes at the top of the script when a hat is selected too.
> * **? / F1** open the How to use page. Help's key table gained `/`, `Esc` and `? / F1`, plus a list of the right-click menus.

### 2-4. Branding (logo, mascots) (done)

* **The logo becomes a speech balloon.** Replace the 🍐 in the top bar and the app icon (`studio/res/ukagaka-studio.ico`,
  a pear for now). Draw a flat, simple picture as SVG and make the icon from it.
* **The mascots are いかがちゃん (main) and しおり (partner)**, named after 如何栞 (ikaga shiori).
  Rewrite the 5 examples (なしこ / つぶ) and the first-run sample (なしちゃん / つぶ, 「なしって おいしいよね」)
  with these two. Keep the names in one place so they are easy to change later.
* **The default name for “New” is あたらしいゴースト** (New Ghost in the English UI). The main character and partner stay
  さくら / うにゅう as before. Change everything that says なしゴースト now (`model.js`, `sample.js`, `title.js`, `index.html`,
  the export default) together. The export default changes, so the export test's expected files
  are regenerated after checking them by eye.
* なしこ in the SHIORI test ghosts (`shiori/test/`) is test material and stays.

> Done:
>
> * Drew the logo `ui/img/logo.svg` (an orange speech balloon with a block notch on its top edge and two lines of text inside)
>   and used it in the top bar and as the tab icon. The exe icon is made from this SVG with `node studio\tools\make-icon.mjs`
>   (drawn at 16–256 px with Windows' Edge and packed into a .ico).
> * The 5 examples and the first-run sample now feature いかがちゃん / しおり.
>   The pear pun 「なしって おいしいよね」 became the ikaga pun 「おちゃでも いかが？」 (“how about some tea?”).
>   The file placed on first start is now `いかがちゃん.json`.
> * “New” and the default name when there is no name became あたらしいゴースト. The exported readme.txt's
>   “ikaga 栞” became 如何栞.
> * Found and fixed: **clearing the name field and exporting left `name,` empty in install.txt and descript.txt**
>   (the default only applied when the item was missing). `GhostName()` now uses the default for empty or blank names too,
>   and the export test gained a ghost without a name (`noname.json`).
>   With that, the contents of readme.txt are tested for the first time.
>
> Changed from the plan: **the mascot names were not gathered into one place.** The names are part of the examples'
> JSON (part of the dialogue itself). The list of files to change when renaming is in
> `docs/maintenance.md`.

### 2-5. The English UI (everything, docs included)

Done **together with** the page rework, because gathering text in one place while rebuilding is faster than collecting it again later.

* **Mechanism**: gather UI text into `ui/js/i18n/` (Japanese and English dictionaries) and look it up with `t('key')`.
  The language follows the Windows display language and can be switched in settings. Japanese is authoritative; missing English shows Japanese.
  * Block text (`%who が %text と話す`) has a sentence per block so each language can use its own word order.
  * Gaps in the dictionary are found by a node test, like `check-blocks.js` (keys missing in English, keys unused).
* **The exe**: `/api/*` errors return **codes** (such as `project_not_found`) instead of sentences,
  and the UI turns them into text with the dictionary. The exe's message boxes (the close confirmation, the WebView2-missing notice) switch inside the exe.
* **Exported files**: `readme.txt` and such inside ghosts follow the screen language at export time.
  Whether to have examples per language (the dialogue itself) is decided when making English examples.
* **Documents**: provide English versions of the README and `docs/` (`README.en.md`, `docs/en/`). The Japanese versions are authoritative,
  and each English version says so at the top. The license (Nashi License) belongs to the original author and is not translated
  (LICENSE already contains an English translation).
* Rough size: about 760 UI strings (`blocks.js` 215, `index.html` 173, `shell.js` 85, `lint.js` 80 and others),
  about 60 exe messages, about 1,500 lines of documents.

> **2-5a (the mechanism) is done.**
>
> Changed from the plan: **keys are the Japanese sentences themselves**, not names like `'run.title'`
> (`t('保存しました')`, `t('「{name}」を保存しました', { name })`).
>
> * Reading the code tells you the Japanese on screen directly. There is no separate Japanese dictionary, so code and dictionary cannot drift.
> * “Japanese is authoritative and missing English shows Japanese” follows naturally.
> * In exchange, rewording a Japanese sentence makes its English stale. `ui\test\i18n.js` stops it as “an unused translation”.
>
> Done:
>
> * Added `ui/js/i18n/` (`i18n.js`, `en.js`) as the lowest layer: `t()`, choosing the language
>   (setting `ikaga.lang` → the Windows display language), `setLang()` (reloads), `translateDom()` (text in index.html).
> * Wrapped 538 places of Japanese UI text in `ui/js/` with `t()` (611 distinct sentences). Places that glued sentences together (15)
>   became one sentence with `{placeholders}` so they translate well. index.html stays as it is and is replaced at startup.
> * `ui\test\i18n.js` (the 8th test): stops unwrapped text, variables passed to `t()`, unused translations, and mismatched
>   `{placeholders}` / `%slots`. The number of English translations is only reported (0 / 611 then).
> * Confirmed in the real exe that switching to English shows untranslated text in Japanese, and that adding translations replaces
>   index.html text, button tooltips and sentences with placeholders.
>
> Left for 2-5b: the English translations themselves, a button to switch languages, codes for exe messages,
> the language of the exported readme.txt, the English docs. Where `lint.js` wraps names in 「」 (English wants "…") is handled with the translations.
> The example list (titles and descriptions in `ui/samples/index.json`) is decided together with whether to make English examples.

**How 2-5b proceeds**: it is large, so it is split into three (each committed on its own).

| # | What |
|---|---|
| 2-5b-1 | the rest of the mechanism: the language switch button, exe messages (codes for `/api/*` errors), the language of exported files (readme.txt, default names, the SHIORI's built-in lines) |
| 2-5b-2 | the English text: UI translations (`en.js`) and English examples (dialogue included, chosen by the screen language) |
| 2-5b-3 | the English documents (`README.en.md`, `docs/en/`) |

> **2-5b-1 is done.** Done:
>
> * A **“English” / “日本語”** button in the top bar (`panels/language.js`). It is labeled in the target language,
>   so people who cannot read the current language can find it. Switching reloads the page, but the open project
>   stays, unsaved changes and the page you were on included (left in `sessionStorage`; only undo history is lost).
> * **The exe**: what it says itself (the close confirmation, the WebView2-missing notice, the image picker, the window name, the SSTP Sender)
>   is written in both languages with `Tr("日本語", "English")` (`studio/src/lang.h`). It follows `lang:ja` / `lang:en` from the UI,
>   and remembers it in the setting (`lang` in `ukagaka-studio.json`) for messages shown before the UI appears next time.
>   Only message-box buttons (Yes / No) stay in the Windows language.
> * **`/api/*` errors are codes** (28 of them, such as `bad_json` and `ssp_unreachable`), turned into text by the table in `core/api.js`.
>   Details (file names, SSP's reply) come back in `detail`. `ui\test\i18n.js` checks that every code the exe returns is in the table.
> * **Exported files**: with the English UI, readme.txt, the fallback names (New Ghost, Sakura, Kero) and the balloon name are English,
>   and `ghost.json` gets `"lang": "en"` (nothing is written for Japanese, so the output is unchanged).
>   (2-5b-2 changed this to follow the **ghost language** (a project setting) instead of the screen language; see below.)
>   The SHIORI reads it and says its reactions to events without blocks (nice to meet you, welcome back, being petted, …) and its update notices in English.
>   When ghost.json cannot be read, the notice is in both Japanese and English, since the language is unknown.
> * The “(older part omitted)” note on long SHIORI logs is now added by the UI, not the exe.
>
> Left for 2-5b-2: the UI translations themselves (even with “English” the text was still Japanese), the English examples and
> the first-run sample.
>
> **2-5b-2 is done.** Done:
>
> * **All 693 UI strings are in English** (`en.js`). Block text changes word order too (`%who says %text`).
>   `ui\test\i18n.js` stops on any string without a translation, and `node ui\test\i18n.js --missing` prints the missing ones.
> * **The ghost language became a project setting** (`meta.lang`; “Ghost language” on the Ghost info page).
>   2-5b-1 decided it by the screen language at export time, but making the English examples showed that values such as
>   “time of day” must also be English (`morning` and so on) to write an English ghost. Scripts compare against those values,
>   so if they changed with the screen language, a ghost made in Japanese and merely exported from the English UI would stop matching its comparisons with 「朝」.
>   So the language belongs to the ghost (decided together; see “Decisions”). New ghosts and examples take the screen language at creation.
> * For English ghosts, the SHIORI returns “time of day”, “season” and “weekday name” in English (`morning` / `spring` / `Monday` and so on).
>   The exported readme.txt, the fallback names and the balloon name also follow the ghost language.
> * Made **English examples** (the 5 in `ui/samples/en/`) and an English first-run sample (`Ikaga.json`).
>   The English UI shows the English examples. If the exe's language is English, the English sample is placed on first start.
>   The English examples were laid out with “Tidy up” in the English UI (English text is longer and overlapped in the Japanese positions).
> * Checked the English UI in the real exe and fixed headings that came out lowercase (the same Japanese sentence was used for a heading and a field)
>   by splitting the Japanese sentences (the frame field 「立ち絵」 → 「立ち絵の番号」 on Characters, 「ゴースト名」 → 「ゴーストの名前」 on Ghost info).
>   The English for the info block 「いまごろ」 is just `time of day`, since listing the values made the blocks too wide.
>
> Left for 2-5b-3: the English documents (`README.en.md`, `docs/en/`).
>
> **2-5b-3 is done.** Done:
>
> * Made `README.en.md` and `docs/en/` (`blocks.md`, `ghost-json.md`, `maintenance.md`, `roadmap.md`).
>   Each says at the top that the Japanese version is authoritative, and each Japanese version links to its English version at the top.
>   `CHANGELOG.md` and the license stay Japanese (the license's English reference translation is inside `LICENSE`).
> * While translating, fixed parts of the Japanese versions that had gone stale (adding a block now takes 5 places, the test table,
>   the mascot table, info-block values following the ghost language, the list of UI layers and so on).
> * `ui\test\i18n.js` now checks that the documents in `docs/` and the README have English versions with the opening note.
>   `tools\check-blocks.js` checks that the English block reference has every block too.
>
> This completes stage 2 (UI redesign).

---

## Stage 3 — Replace ikaga SHIORI with YAYA

Drop ikaga SHIORI (`ikaga.dll`) and replace it with **YAYA**, a SHIORI widely used for Ukagaka ghosts.
Ukagaka Studio changes from “a tool to make ghosts from blocks alone” into **a tool that helps make YAYA ghosts**.

* What is built from blocks, the studio **translates into YAYA dictionaries (`.dic`)** on export.
* People who write YAYA by hand can **add their own dictionaries** to the same ghost. The studio only touches files it wrote.
* People who have built with blocks alone can keep doing so. What they export is an ordinary YAYA ghost.

### Why replace it

* Anyone who reads YAYA can work on an exported ghost (no need to learn a SHIORI of our own).
* People who start with blocks can read the exported YAYA and move on to writing it by hand.
* The upkeep of the SHIORI itself (SHIORI/3.0 requests, saving variables, calling SAORI) can be left to YAYA.

### Things to watch

* **Blocks must behave the same.** What ikaga SHIORI does in C++ (3-3) is rewritten identically as YAYA dictionaries.
  ikaga SHIORI is removed only after the same project gives matching answers on both (3-6).
* **Hand-written YAYA cannot be turned back into blocks.** The direction is one way, “blocks → YAYA”,
  so the files the studio writes and the files people write are kept clearly apart (3-5).
* **SAORI calls that do not wait** (whose answer arrives through `OnSaoriDone`) have no equivalent in YAYA (3-0).
  The block stays: inside, it waits for the answer, then raises `OnSaoriDone` on the next `OnSecondChange` as it does now.
  The ghost stops while a slow SAORI runs, and the block's description will say so.
* **YAYA's license**: used for Ukagaka ghosts and related tools, the AYA Ver.5 license applies; otherwise BSD 3-Clause.
  The notice goes with exported ghosts and with the distributed zip.

### 3-0. Groundwork research (done)

| To do | Done when |
|---|---|
| Read the text of YAYA's license (AYA Ver.5) and decide how to include it | the files and wording to include are decided |
| Check the import tables of the official `yaya.dll` and one built from source with `check-imports` | it is known whether the Windows 2000 premise holds |
| Find out whether YAYA can call SAORI without waiting | it is decided what happens to the “SAORI” block |
| Decide which template's SHIORI/3.0 entry dictionary to use (or write our own) | the base for 3-3 is decided |

> Done (2026-10-22; checked against YAYA Tc607-2 and the 2026-10 yaya-dic):
>
> * **License**: built into Ukagaka ghosts and the programs around them, YAYA is under the original AYA Ver.5 terms
>   (free to use, modified versions may be distributed under your own terms, no liability); otherwise BSD 3-Clause.
>   The `LICENSE` and `readme-original.txt` from the official zip go along unchanged.
> * **Windows 2000**: the official `yaya.dll` is built with an old Visual C++, and all 150 APIs it imports exist
>   in Windows 2000 (the 91 that were missing were added to the table in `tools\check-imports.js`).
>   Built from source with today's Visual Studio (v145), it imports 7 APIs from Windows XP and 9 from Vista,
>   and its header claims Vista or later. So **it is not built from source; the official `yaya.dll` is used** (“Decisions”).
> * **SAORI**: YAYA has no way to run things on another thread; SAORI is only `REQUESTLIB` (waits for the answer).
>   The “call without waiting” block **stays, as a waiting call** (“Things to watch” above, and “Decisions”).
> * **Entry dictionary**: YAYA's system dictionary **`yaya_base`** (yaya-dic, The Unlicense) is used unmodified.
>   It answers SHIORI/3.0 and calls the function named after the event; YAYA templates share it.
>   Hand-written YAYA ghosts usually use it too, which makes it easy to put the studio's dictionaries alongside.
>   It also has a way to raise something at the next event (`SHIORI3FW.DelayEvent`), usable for `OnSaoriDone`.

### 3-1. Bring YAYA in

* Put the official `yaya.dll` (currently Tc607-2) in `third_party/yaya/`, together with `LICENSE` and `readme-original.txt`.
  Put the entry dictionary `yaya_base` in `third_party/yaya-dic/`. Neither is downloaded at build time.
  To move to a newer version, replace the files and check again with `tools\check-imports.js`.
* The import check in `.\build.ps1 -Test` also looks at `yaya.dll`.
* Embed `yaya.dll` in the exe the same way `ikaga.dll` is embedded now.
* Let `shiori/test/test_host.cpp` choose which DLL to load instead of always loading `ikaga.dll`.

Done when: test_host sends `OnBoot` to YAYA with a small dictionary and gets an answer.

### 3-2. Translate blocks into YAYA

* The translator lives in `ui/js/model/`. It does not touch the DOM, so the node tests can use it directly,
  and the UI can show “this block in YAYA”. The exe only receives the translated dictionaries and writes them out.
* Escaping is kept in one place, so YAYA does not reinterpret `%` or `"` in text people write.
* The “completeness” check in `tools/check-blocks.js` looks at the translator instead of `interp.cpp`.

### 3-3. Write the runtime in YAYA

The decisions ikaga SHIORI made in C++ (`shiori.cpp`) go into a **runtime dictionary** that the studio always adds (for example `studio_runtime.dic`).

* How to choose when an event has several candidates (how specific the filter is, weighted draw)
* Thinning “every N seconds”, and random talk that avoids recent talks
* Default replies for events without blocks (Japanese or English by the ghost language), `\-` on `OnClose`
* Where communication goes, petting detection, and information such as “time of day”, “season” and “weekday name” (by the ghost language)
* The length limit (ikaga's `Emit`), and saving variables (using YAYA's own saving)

3-2 and 3-3 go together (each one's tests need both). Done when:

* The parity test ghost (`shiori/test/parity/ghost.json`, one script per block) runs on both ikaga SHIORI and YAYA,
  and all the Sakura Script that comes out matches (**a parity test across SHIORIs**).
* The behavior test (currently 18 scenes, 89 checks) passes against YAYA.

### 3-4. Run “Try” on YAYA

* “Try” also runs on the same 32-bit `yaya.dll` that goes into SSP. The 64-bit exe cannot load it directly,
  so a small 32-bit helper exe (shaped like test_host) is embedded in the exe and does the work.
* The Variables tab reads values through a “return the variables” entry in the runtime dictionary.

Done when: the same block gives the same answer in “Try” and in SSP.

### 3-5. Shape as a helper tool

* **Open an existing YAYA ghost folder** (stage 4's “Import an existing shell folder” is done here too).
* The studio writes **only its own files** (`studio_*.dic`, and a few marked lines in `yaya.txt`).
  It never touches hand-written dictionaries. If a file it is about to write has no mark, it stops instead of overwriting.
* Read the list of functions in hand-written dictionaries so blocks can call them (“Call a YAYA function” and “YAYA expression” blocks).
* When running in SSP, send `\![reload,shiori]` over SSTP after exporting so the ghost reloads
  (ikaga SHIORI reloaded on its own when `ghost.json` changed).

Done when: a hand-written ghost made from a YAYA template is opened, blocks are added and exported,
and the hand-written dictionaries stay byte-for-byte unchanged.

### 3-6. Remove ikaga SHIORI

Removed only after both tests in 3-3 are green.

* Delete `shiori/` (`interp.cpp` and the rest) and the 32-bit/64-bit parity test, and drop `ghost.json` and `ikaga.dll` from the export.
* Existing projects open as they are; exporting them makes a YAYA ghost.
* Rewrite the README, `docs/blocks.md` (the translated YAYA alongside the Sakura Script that comes out), `docs/ghost-json.md`,
  the maintenance guide, the English versions and the CHANGELOG.
* Raise the version number.

Done when: `.\build.ps1 -Release` is green and the zip contains no ikaga SHIORI.

---

## Stage 4 — New features

Candidates. Which comes first is decided along the way through stage 3.
The shell feature “Import an existing shell folder” is done in stage 3 (3-5).

### The rest of SERIKO (“Not there yet” in the README)

* Grouped operations such as `alternativestart`
* `scaling` / `insert`
* The finer kinds of `blend-*`
* Dress-up (MAYUNA) `bind`

### Shell features

* **Import an existing shell folder** (read `surfaces.txt` and the images, and line up numbers and pictures)
* Draw hit areas on top of the picture
* More choices for how the balloon looks

### Editor

* **Notes (comments)** on blocks
* Copy and paste between projects
* Autosave and going back to an earlier version
* Saving a frequently used arrangement as a “part”

---

## Decisions

| When | Decision |
|---|---|
| 2026-10-21 | The logo is a **speech balloon** (2-4) |
| 2026-10-21 | The mascots are **いかがちゃん (main) and しおり (partner)**. The default name for “New” is **あたらしいゴースト** (2-4) |
| 2026-10-21 | English covers **the UI, the exe's messages and the documents — everything**, done **together with** the page rework in stage 2 (2-5) |
| 2026-10-21 | Block colors stay Scratch's, and **the text on blocks becomes black** (for readability; 2-2) |
| 2026-10-21 | **Make English examples too**: separate ones with English dialogue, chosen by the screen language (2-5b) |
| 2026-10-21 | The mascots' English names are **Ikaga / Shiori** (2-5b) |
| 2026-10-21 | **The ghost language is a project setting** (`meta.lang`). New ghosts and examples take the screen language at creation. Built-in lines, values such as “time of day” and the readme follow it, not the screen language at export time (2-5b-2) |
| 2026-10-22 | **Drop ikaga SHIORI and replace it with YAYA**; Ukagaka Studio becomes **a helper tool for YAYA ghosts**. Blocks are translated into YAYA dictionaries on export, and hand-written dictionaries are never touched. This goes in as stage 3, before the new features, which become stage 4 (stage 3) |
| 2026-10-22 | **Use the official `yaya.dll`; do not build it from source** (built with today's Visual Studio, it does not run on Windows 2000; 3-0) |
| 2026-10-22 | The “call SAORI without waiting” block **stays, and becomes a waiting call under YAYA**. `OnSaoriDone` is still raised on the next `OnSecondChange` (3-0) |

## Not decided yet

* How to count version numbers (stage 0-2)
* Details of stage 3:
  * Whether “Try” runs through a 32-bit helper exe, or YAYA is also built as 64-bit and carried directly in the exe
    (3-4; with 64-bit, a 32-bit/64-bit parity test is needed, as now)
  * Whether block variables and hand-written dictionary variables share names, or are kept apart by a mark (a prefix)
  * Whether project files stay in `projects\` next to the exe, or go inside the ghost folder
  * Whether variables of ghosts exported earlier with ikaga SHIORI (`ikaga_save.json`) carry over to YAYA
  * What to do with the name “如何栞 (ikaga SHIORI)” and the name `ikaga` in the code (including the project format `ikaga/1`)
