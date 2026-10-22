# The rework plan

日本語: [../roadmap.md](../roadmap.md)

> **This is the English translation of [docs/roadmap.md](../roadmap.md). The Japanese version is authoritative;**
> **if the two differ, follow the Japanese one.**

The plan for substantially reworking **Ukagaka Studio (伺かスタジオ)**, which branched off from
“Nashi SHIORI + Nashi Studio”. Decisions are added here as they are made.

---

## What does not change (premises)

Whatever the rework does, these stay. Each is a core strength of the original project.

* **Exported ghosts run from Windows 2000.** The SHIORI is the official `yaya.dll`, used as it is (not built from source).
  `node tools\check-imports.js` watches this.
* **Only YAYA runs blocks.** The UI's “Try” also runs on the same `yaya.dll` that goes into SSP.
  The rules that translate blocks into YAYA live in one place only, `ui/js/model/yaya.js`, and the fixed behavior in one place only,
  the runtime dictionary `studio/res/yaya/studio_runtime.dic`.
* **Ukagaka Studio runs as a single exe.** No runtime to install, no open ports,
  no outside connections (it only talks to SSP).
* **No new tools to build the UI.** The files in `ui/` go into the exe as written
  (you can build with just `.\build.ps1`, without installing Node or npm).
* **Nothing goes in unless the tests pass.** Each stage turns `.\build.ps1 -Test` green before moving on.

> **Stage 3 changed the first and second premises above** (decided on 2026-10-22, done in 3-6; see “Decisions” below).
> Up to stage 2 they read “ikaga SHIORI (`ikaga.dll`) runs from Windows 2000; it is built without the C runtime” and
> “the rules that run blocks live in one place only, `shiori/src/interp.cpp`”. ikaga SHIORI was dropped and replaced with **YAYA**,
> and Ukagaka Studio became **a helper tool for YAYA ghosts**. The other three are unchanged.

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
| 0-1 | Push to GitHub and confirm Actions (`build.yml`) is green in the fork too (**done**) | a green badge |
| 0-2 | Decide the version number (e.g. restart counting from `0.1.0-alpha`) | `VERSION` and `kStudioVersion` (`api.cpp`) agree |
| 0-3 | Decide the branding: the logo (🍐 for now), the example and default character names (なしこ, なしちゃん, なしゴースト) → **decided** (“Decisions” below). Swapped in stage 2 | the 5 examples and the defaults replaced |
| 0-4 | Show the original project in an “About this software” screen in the app (**done**) | license section 3 satisfied outside the README too |

> **0-1 is done** (2026-10-22). `main` was pushed to `ukagaka-irono/ukagaka-studio`, and Actions' “ビルドとテスト” (build and test:
> `.\build.ps1 -Release` and the 9 tests) and “そろい点検” (block coverage) turned green, producing the distribution artifact
> `ukagaka-studio-<version>-<sha>`. No tag was pushed, so the Release job is skipped.
>
> **0-4 is done.** Help now has “About this software”, with the version (from `VERSION`), the notice about the original project
> (the same 3 lines as in the README and LICENSE; not translated even in the English UI, with an English explanation above it), and a button
> that opens the original project's page (`ui/js/panels/about.js`). `ui\test\editor.js` checks that the notice matches the README and LICENSE
> character for character. It also says that exported ghosts do not need to carry the notice.

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

## Stage 3 — Replace ikaga SHIORI with YAYA (done)

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

### 3-1. Bring YAYA in (done)

* Put the official `yaya.dll` (currently Tc607-2) in `third_party/yaya/`, together with `LICENSE` and `readme-original.txt`.
  Put the entry dictionary `yaya_base` in `third_party/yaya-dic/`. Neither is downloaded at build time.
  To move to a newer version, replace the files and check again with `tools\check-imports.js`.
* The import check in `.\build.ps1 -Test` also looks at `yaya.dll`.
* Embed `yaya.dll` in the exe the same way `ikaga.dll` is embedded now.
* Let `shiori/test/test_host.cpp` choose which DLL to load instead of always loading `ikaga.dll`.

Done when: test_host sends `OnBoot` to YAYA with a small dictionary and gets an answer.

> Done:
>
> * The official `yaya.dll` (Tc607-2) and its accompanying files are in `third_party/yaya/`, and `yaya_base` is in
>   `third_party/yaya-dic/`, byte-for-byte as distributed (`.gitattributes` keeps line endings too). Origin and upgrade steps: `third_party/README.md`.
> * `test_host.exe` takes `--dll yaya.dll` to choose the DLL (without it, `ikaga.dll` as before).
>   Node tests drive it through `runYaya` in `shiori/test/lib/host.js` (which puts `yaya.dll` and `yaya_base` in place).
> * New test `shiori\test\yaya\yaya.js`: `yaya.dll` matches the SHA-256 in `third_party/README.md`, and with the smallest
>   dictionary it answers `OnBoot`, receives References, and returns 204 for an event with no function (6 checks).
>   `.\build.ps1 -Test` also runs the import check on `yaya.dll`. There are now 9 tests.
> * `yaya.dll` is embedded in the exe (resource 903, `IDR_YAYA_DLL`). Exports do not use it yet.
> * The release zip now carries the text of YAYA's license (`third_party/`), and the README's “Bundled components” says so.

### 3-2. Translate blocks into YAYA (done)

* The translator lives in `ui/js/model/`. It does not touch the DOM, so the node tests can use it directly,
  and the UI can show “this block in YAYA”. The exe only receives the translated dictionaries and writes them out.
* Escaping is kept in one place, so YAYA does not reinterpret `%` or `"` in text people write.
* The “completeness” check in `tools/check-blocks.js` looks at the translator instead of `interp.cpp`.

### 3-3. Write the runtime in YAYA (done)

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

> Done (3-2 and 3-3):
>
> * **Translator** `ui/js/model/yaya.js` (`toYaya`): makes `studio_program.dic` from the exported ghost.json form.
>   Each script becomes one YAYA function (`Studio.Script.<id> : void`), a block becomes one line such as
>   `Studio.Say(0, 'Hello', 1)`, and “if” and “repeat” become YAYA's `if` / `for` / `while`. For an English ghost the
>   dictionary's comments are in English too. The UI does not use it yet (`TEST_ONLY` in `ui\test\modules.js`).
> * **Runtime dictionary** `studio/res/yaya/studio_runtime.dic`: the decisions of ikaga's `shiori.cpp` and `interp.cpp`
>   (choosing among candidates, thinning, random talk, “call after N seconds”, default replies, communication, petting,
>   the input box, the value rules, length limits) rewritten in YAYA. The entry stays `yaya_base`; it starts from `OnGhostLoad.Studio`.
>   yaya_base's own random talk (`aitalkinterval`) is turned off; random talk comes from this dictionary.
> * **Block variables live in one hash, `Studio.var['name']`** (“Decisions”). Together with the boot count and the recent talks,
>   they survive a restart through YAYA's own saving (`yaya_variable.cfg`).
> * YAYA replaces `#globaldefine` names even inside strings, so when text people wrote contains `TALK_INTERVAL` and the like,
>   the string is split (`YAYA_DEFINES`). Other YAYA pitfalls are collected under “YAYA dictionaries” in the maintenance guide.
> * **Tests** `shiori\test\yaya\yaya.js` (137 checks): the parity ghost run on both ikaga SHIORI and YAYA gives the same answer
>   in all 30 cases (**a parity test across SHIORIs**), all 19 behavior scenarios hold on YAYA too, variables and the boot
>   count survive a restart, and `YAYA_DEFINES` matches yaya_base. The behavior scenarios moved to
>   `shiori/test/behavior/scenarios.js` so both SHIORIs share them.
>   `tools\check-blocks.js` also checks that the translation knows every block, information key and operation (6 places to add a block).
> * New cases: OnP30 in the parity ghost (`#globaldefine` names, quotes, tabs, emoji, number formats), and a random-talk scenario
>   in the behavior test (interval, avoiding the last one, silence when the ghost cannot talk; neither SHIORI had a test for it).
> * **A mismatch found**: large numbers were written differently by the 32-bit ikaga SHIORI in SSP (`1e+023`) and the 64-bit one
>   behind “Try” (`1e+23`). They now follow SSP (`NumToStr` in `shiori/src/util.cpp`). The official YAYA build also writes `1e+023`.
>
> Where it does not match ikaga SHIORI (on purpose, or not possible in YAYA):
>
> * The “call SAORI without waiting” block waits for the answer (as decided in 3-0). How it reports (`OnSaoriDone` on the next second) is the same.
> * “and” and “or” evaluate both sides first (a difference shows only with SAORI or random values inside a condition).
> * The cap on work per request (40,000 steps in ikaga) counts loop iterations and talk calls, so it may stop at a slightly different point.
> * Event names with spaces or symbols cannot be YAYA function names and are not exported (the dictionary says so).
>   The same goes for names yaya_base uses itself, such as `OnRequest`.
> * Writing `:chain=` in speech is read as a yaya_base chain talk. Events from external SSTP (`SecurityLevel: external`)
>   are routed by yaya_base to `ExternalEvent.*`, so blocks do not run for them.
> * When comparing text, the order of two-unit characters such as emoji very rarely differs.

### 3-4. Run “Try” on YAYA (done)

* “Try” also runs on the same 32-bit `yaya.dll` that goes into SSP. The 64-bit exe cannot load it directly,
  so a small 32-bit helper exe (shaped like test_host) is embedded in the exe and does the work.
* The Variables tab reads values through a “return the variables” entry in the runtime dictionary.

Done when: the same block gives the same answer in “Try” and in SSP.

> Done:
>
> * The UI turns the project into the export form (`programOf`; the test checks it matches the exe's `RuntimeProgramJson`),
>   translates it into YAYA, and sends that dictionary to `POST /api/preview` (the project itself is no longer sent).
> * The exe (`studio/src/yaya_preview.cpp`) writes the YAYA kit to a work folder `%TEMP%\ukagaka-studio-preview-<process id>\`
>   and has the 32-bit helper **`yaya_host.exe`** (`studio/yaya_host/`, built as 32-bit by `shiori\build.ps1`) ask once.
>   The kit is in the exe as resources 903 and up (`kYayaKit` in `assets_gen.h`). The folder is deleted when the exe closes;
>   a run with no answer after 20 seconds is stopped.
> * The Try entry is **`studio/res/yaya/studio_preview.dic`** (`OnStudioPreview`). It takes the carried-over variables,
>   the values for information blocks and the event references as JSON, runs one script, and returns the Sakura Script,
>   the communication target and the variables as JSON. It never goes into an exported ghost (it would let outsiders
>   rewrite variables). It does not call SAORI.
> * **No 64-bit YAYA; a 32-bit helper instead** (“Decisions”). “Try” and SSP run the same `yaya.dll`, so there is no
>   32-bit/64-bit parity to check.
> * The test (`shiori\test\yaya\yaya.js`, 170 checks) now also runs the 30 parity cases the way “Try” does
>   (`yaya_host.exe`) and checks they match how SSP runs them, checks initial and carried-over variables and the error for
>   a missing id, and checks that the export form built in the UI matches the exe's.
> * In a scratch copy of the exe: the five scripts of the first-run sample run in “Try”, variables carry over, each run
>   returns in about 0.1 s (0.5–2 s for the first few after startup while Windows scans the files), and the work folder is
>   gone after the exe closes.
> * New error codes `no_dic` (no dictionary) and `yaya_failed` (could not run on YAYA), with UI text in both languages.

### 3-5. Shape as a helper tool

* **Open an existing YAYA ghost folder** (stage 4's “Import an existing shell folder” is done here too).
* The studio writes **only its own files** (`studio_*.dic`, and a few marked lines in `yaya.txt`).
  It never touches hand-written dictionaries. If a file it is about to write has no mark, it stops instead of overwriting.
* Read the list of functions in hand-written dictionaries so blocks can call them (“Call a YAYA function” and “YAYA expression” blocks).
* When running in SSP, send `\![reload,shiori]` over SSTP after exporting so the ghost reloads
  (ikaga SHIORI reloaded on its own when `ghost.json` changed).

Done when: a hand-written ghost made from a YAYA template is opened, blocks are added and exported,
and the hand-written dictionaries stay byte-for-byte unchanged.

3-5 is large, so it is split into three parts (decided on 2026-10-22; see “Decisions” below).

| Order | To do | Why this order |
|---|---|---|
| 3-5a | **Switch the export to YAYA** (the first half of 3-6, moved ahead). Export `yaya.dll`, `yaya.txt`, `yaya_base`, the runtime dictionary and the translated dictionary instead of `ikaga.dll`; the ghost's saved state and log become YAYA's too | Without exporting YAYA ghosts, there is nothing to put next to hand-written ones |
| 3-5b | **Open an existing YAYA ghost.** The project remembers the ghost folder and writes only the studio's files and the marked lines of `yaya.txt`. Read the hand-written functions; when an event exists in both, hand-written wins | After the export is YAYA |
| 3-5c | **Blocks that call hand-written functions** (“Call a YAYA function”, “YAYA expression”) | Needs the function list of an opened ghost |
| 3-5d | **Importing an existing shell folder** (split off from 3-5c) | Different in nature (work on the shell pages), so it goes separately from the blocks |

Decisions (see the “Decisions” table for details):

* **For the same event, hand-written code wins.** For an event the hand-written dictionaries also define, the studio does not
  write the entry function (with both, YAYA cannot read the dictionaries and the whole ghost goes silent — confirmed while
  preparing 3-5). Calling `Studio.Event('OnBoot')` inside the hand-written function runs the blocks too. The Check tab says so.
* **An opened ghost's `yaya.dll` and `yaya_base` are used as they are.** When they cannot run the studio's runtime
  (too old, or the entry is not yaya_base), the studio says so and stops before exporting.
* **Project files stay in `projects\` next to the exe**, and a project remembers the ghost folder it is linked to.

> **3-5a is done.** What was done:
>
> * Exports (folder, .nar and “Run it in SSP”) put `yaya.dll`, `yaya.txt`, `yaya_base`, `studio_runtime.dic` and the
>   `studio_program.dic` translated by the UI into `ghost/master/`, and set `shiori` in `descript.txt` to `yaya.dll`.
>   `ikaga.dll` is no longer included. `ghost.json` stays as a copy of the blocks (so “Import” can open it; YAYA does not read it).
>   The UI now sends the dictionary (`dic`) when exporting (`no_dic` without it). The YAYA kit is the one embedded in the exe (`Api::YayaKitFiles`).
> * “Clear the ghost's memory” deletes `yaya_variable.cfg` (and an old `ikaga_save.json`, if any). The log is `studio_debug.txt`,
>   which the runtime dictionary writes only when the file exists (loading, YAYA's warnings, unknown names for “call after N
>   seconds”, SAORI that cannot be loaded). Neither goes into `updates2.dau`.
> * The SAORI file name rule (refusing anything that points outside the ghost folder) is now in the runtime dictionary too.
> * Tests: the export test gained `yaya.txt`, the translated dictionary (Japanese and English) and the file list (the expected
>   files were regenerated only after checking their contents). The YAYA test gained “a ghost exported the way the exe does
>   runs on YAYA as it is” and “the log is written only when studio_debug.txt exists” (173 checks).
> * In a scratch copy of the exe: exported to a folder and a .nar from the UI, and the exported ghost answered on YAYA
>   (`OnFirstBoot`, `OnBoot`, double-click, `OnClose`).
> * UI text (the SHIORI status, the ghost's memory, the log, “About the SHIORI” in Help) and what the README, ghost-json.md
>   and blocks.md say about exported ghosts now describe YAYA (English versions too). The description of ikaga SHIORI
>   itself is rewritten in 3-6.

> **3-5b is done.** What was done:
>
> * The Export page gained “Link to a hand-written YAYA ghost” (`ui/js/panels/yayalink.js`). Linking stores the folder in the
>   project's `meta.ghostDir` and takes the names from `descript.txt`. The inspection result (hand-written dictionaries,
>   functions, what is missing) lives in `Session.yayaGhost` (the exe's `POST /api/yaya/inspect`, `InspectYayaGhost` in `studio/src/yaya_ghost.cpp`).
> * While linked, Export and “Run it in SSP” go through `ExportLinked` and write only `studio_runtime.dic`, `studio_program.dic`
>   and the marked lines of `yaya.txt` (no .nar). The studio's files carry the mark `// ukagaka-studio: generated` on line 1, and a
>   same-named file without it stops the export. The `yaya.txt` lines read `dic, studio_…dic, UTF-8`, so they work even when the
>   hand-written ghost uses Shift_JIS.
> * Found while preparing: YAYA also refuses dictionaries that call a function defined nowhere (the ghost goes silent). So before
>   linking, the studio checks yaya.dll (YAYA 6.x?) and yaya_base (does it have the functions the runtime uses?) and stops exports if not.
> * For the same event, hand-written code wins (`toYaya(…, { handwritten })` writes no entry and leaves a comment saying so). The Check tab points it out.
> * yaya_base's random talk (`aitalkinterval`) is no longer turned off when the blocks have no random talks (for hand-written ghosts).
> * Tests: linking to the Shift_JIS hand-written ghost `shiori/test/yaya/handwritten/` and exporting twice keeps the hand-written
>   files byte-for-byte, appends the marked lines to `yaya.txt` exactly once, lets the hand-written `OnBoot` win, runs blocks
>   through `Studio.Event` from hand-written code, and stops in the three cases it should (unmarked file, no yaya_base, old yaya.dll)
>   (179 YAYA checks). The editor test gained the Check tab notice (96 checks).
> * In a scratch copy of the exe: linked a hand-written ghost from the UI (“てがきちゃん (1 hand-written dictionary, 4 functions)”),
>   checked the Check tab notice, the export (only the two studio files and yaya.txt changed), the .nar refusal, and the exported ghost's answers.

> **3-5c is done.** What was done (importing a shell folder was split off as 3-5d):
>
> * Two blocks: “**call YAYA function F with A B**” in Control (`yaya_call`; calls a hand-written function and speaks its answer
>   as it is) and “**value of YAYA expression C**” in Operators (`yaya_expr`). They run on `Studio.YayaCall` and `Studio.YayaExpr`
>   in the runtime dictionary. Functions are called through `EVAL` and skipped (and logged) when missing (calling a missing
>   function directly would make YAYA refuse the dictionaries). Arguments go through variables (`Studio.argA`, `Studio.argB`),
>   so no text in them is ever read as code.
> * **No blocks can go into** the function name and expression fields (`literal: true`; `editor/render.js`, `drag.js`), so words
>   from other ghosts never run as YAYA code; the translator also translates them only when they are written text.
> * ikaga SHIORI does nothing for either (empty). “Try” has no hand-written dictionaries, so the function call does nothing there.
> * Check tab: an empty name, a block in the field, not linked, and a name missing from the hand-written dictionaries.
> * Tests: parity case OnP31 (empty on both SHIORIs); the YAYA test's “blocks use hand-written functions and expressions”
>   (calls the hand-written `Hand.Greet`, speaks its answer, outputs `Studio.var['数'] + 2`; a missing function does nothing;
>   181 checks); six Check tab checks in the editor test (102 checks).
> * In a scratch copy of the exe: both blocks can be placed, their fields refuse blocks (2 fields), the Check tab, and “Try” shows
>   the expression's value. Noticing that a killed exe leaves Try's work folder behind, the exe now cleans up folders of studios
>   that are no longer running when it starts (`CleanupStaleYayaPreviews`).

> **3-5d is done**, which completes 3-5. What was done:
>
> * “Surfaces” on the Characters page gained “**Import from an existing shell folder**”. From a shell folder (or a ghost folder:
>   `shell/master`, else the first shell found under `shell`) it collects numbered images such as `surface0.png` and
>   `surface0010.png` and assigns them to their numbers (same numbers are replaced, others stay). In the exe:
>   `studio/src/shell_import.cpp` (`POST /api/shell/import`). With two images for one number the shorter name wins; files that
>   are not readable PNGs are left out and reported.
> * `surfaces.txt` is read only to learn numbers (`surface0`, `surface10,11`, `surface100-102`, `surface.append3`).
>   Numbers that only combine images have no single picture, so they are not imported, and the studio says so.
> * **Animations (SERIKO) and hit areas are not imported** (decided). The project builds hit areas from image sizes and has
>   no place for a shell's own yet; they will be considered with “the rest of SERIKO” and “draw hit areas on the picture” in stage 4.
> * Tests: the export test reads a shell folder assembled on the spot with tiny PNGs (from a ghost folder or directly,
>   zero-padded names, two images for one number, an unreadable image, a non-numbered image, combination-only numbers, and refusing
>   a folder that is not a shell; 26 checks).
> * In a scratch copy of the exe: imported the shell of a previously exported ghost from the UI, and the six images (0–2, 10–12)
>   lined up under their numbers.

### 3-6. Remove ikaga SHIORI (done)

Removed only after both tests in 3-3 are green.

* Delete `shiori/` (`interp.cpp` and the rest) and the 32-bit/64-bit parity test, and drop `ghost.json` and `ikaga.dll` from the export.
* Existing projects open as they are; exporting them makes a YAYA ghost.
* Rewrite the README, `docs/blocks.md` (the translated YAYA alongside the Sakura Script that comes out), `docs/ghost-json.md`,
  the maintenance guide, the English versions and the CHANGELOG.
* Raise the version number.

Done when: `.\build.ps1 -Release` is green and the zip contains no ikaga SHIORI.

> What was done (this completes stage 3):
>
> * Deleted ikaga SHIORI's sources (`interp.cpp`, `shiori.cpp`, `saori.cpp`, `program.cpp`, `dllmain.cpp`, `tinycrt.cpp` and the
>   `.def` files in `shiori/src/`), `studio/src/preview.cpp` and `studio/test/preview_host.cpp`, which ran the 64-bit ikaga SHIORI,
>   and the test ghost `shiori/test/fixture/`. `json.cpp` and `util.cpp`, which the studio also uses, moved to `studio/src/`,
>   minus the random numbers and the log (`ikaga_debug.txt`) nothing uses any more. The exe no longer embeds `ikaga.dll` (resource 900 is gone).
> * `shiori\build.ps1` now builds only the 32-bit helper `yaya_host.exe` (plus `test_host.exe` and `slow_saori.dll` with `-Test`).
>   `test_host.exe` loads `yaya.dll` by default, and `tools\check-imports.js` defaults to `third_party\yaya\yaya.dll`.
>   The “SHIORI only” Actions artifact (`ikaga-dll-…`) is gone.
> * **The parity test** no longer compares the 32-bit and 64-bit ikaga SHIORI; it **compares the answers on YAYA with `expected.json`**.
>   `expected.json` is a copy of ikaga SHIORI's answers (30 cases) taken before removing it (OnP25, which reads the clock, is built from the
>   current time). It also runs the same scripts the way “Try” does (`yaya_host.exe`) and checks they match the way SSP runs them (31 cases).
>   When you change an answer on purpose, regenerate it with `node shiori\test\parity\parity.js --update`.
> * **The behavior test** now translates the blocks into YAYA and runs them (19 scenarios, 98 checks). The parts that moved to the parity
>   and behavior tests were taken out of the YAYA test (21 checks). `tools\check-blocks.js` looks only at the YAYA translation
>   (`yaya.js` and the runtime dictionary) instead of `interp.cpp` (adding a block now takes 5 places).
> * `ghost.json` is **kept in the export as a copy of the blocks**, not dropped (so “Open” can load it; see Decisions).
> * The version is now **2.0.0-alpha** (see Decisions). The version the UI gets (`/api/state`) is now made from `VERSION`
>   (it used to be hard-coded as `1.0.0`, out of step with `VERSION`).
> * Rewrote the README, `docs/blocks.md`, `docs/ghost-json.md` and the maintenance guide for YAYA (and their English versions).
>   The description of SAORI “called without waiting” now says that YAYA waits for the answer.
> * Dropped `bad_project`, which only ikaga SHIORI's preview returned, from the UI's error table. `ui\test\i18n.js` also checks the codes
>   the Try entry dictionary returns (`script_not_found`).

---

## Stage 4 — New features

Candidates. Which comes first is decided along the way through stage 3.
The shell feature “Import an existing shell folder” was done in stage 3 (3-5d; numbered images only).

### The rest of SERIKO (“Not there yet” in the README)

* Grouped operations such as `alternativestart`
* `scaling` / `insert`
* The finer kinds of `blend-*`
* Dress-up (MAYUNA) `bind`

### Shell features

* ~~Import an existing shell folder~~ (done in 3-5d, numbered images only; importing animations and hit areas goes with the next two)
* Draw hit areas on top of the picture
* More choices for how the balloon looks

### Editor

* ~~**Notes (comments)** on blocks~~ (done; see “What was done” below)
* Copy and paste between projects
* Autosave and going back to an earlier version
* Saving a frequently used arrangement as a “part”

> **Notes are done.** What was done:
>
> * Blocks and scripts can carry a note (`note`), added with “Add a note” in the right-click menu. It appears like a sticky note to the
>   right of the script, can be edited right there, and disappears when all its text is erased (`ui/js/editor/notes.js`). Closing it
>   without writing anything leaves no undo entry.
> * Notes do not affect behavior. They go into the exported `ghost.json` as they are, and into the YAYA dictionary as a `// メモ: …` comment
>   just before their block (`// Note: …` for English ghosts), which also helps people reading the YAYA by hand.
> * The Search tab searches notes too. “Tidy up” counts notes overhanging to the right in the width.
> * Tests: the YAYA test now checks that adding notes to all 176 blocks and every script of the parity ghost leaves all 30 answers unchanged
>   (with notes containing a trailing `/`, `*/`, a `#globaldefine` name and an empty line; this also confirmed that YAYA does not join the next
>   line onto a comment line ending in `/`). The export test's input got a note too (the copy's shape matches between the UI and the exe).

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
| 2026-10-22 | 3-5 is split into **3-5a (export as YAYA) → 3-5b (open an existing YAYA ghost) → 3-5c (blocks calling hand-written functions) → 3-5d (shell import)**; switching the export (the first half of 3-6) comes first (3-5) |
| 2026-10-22 | When hand-written dictionaries and blocks share an event, **hand-written wins**. The studio does not write that entry; calling `Studio.Event('…')` from the hand-written function runs the blocks too (3-5) |
| 2026-10-22 | An opened ghost's **`yaya.dll` and `yaya_base` are used as they are**; if they fall short, the studio says so and stops (3-5) |
| 2026-10-22 | Project files **stay in `projects\`**, and a project remembers the ghost folder it is linked to (3-5) |
| 2026-10-23 | From an existing shell folder, **only numbered images** are imported; animations (SERIKO) and hit areas are not (the project has no place for them yet; considered together in stage 4; 3-5d) |
| 2026-10-22 | “Try” runs **the same `yaya.dll` as SSP through a 32-bit helper (`yaya_host.exe`)**; no 64-bit YAYA is built (we use the official build; 3-4) |
| 2026-10-22 | Block variables live in **one hash, `Studio.var['name']`**, under YAYA. Any name works as it is, and they never clash with hand-written variables; hand-written YAYA reads and writes them as `Studio.var['name']` (3-2) |
| 2026-10-22 | The exported **`ghost.json` stays, as a copy of the blocks** (YAYA does not read it; it is there so “Open” can load it; 3-6) |
| 2026-10-22 | The version without ikaga SHIORI is **2.0.0-alpha** (3-6) |

## Not decided yet

* How to count version numbers (stage 0-2)
* Details of stage 3:
  * Whether variables of ghosts exported earlier with ikaga SHIORI (`ikaga_save.json`) carry over to YAYA
  * What to do with the name “如何栞 (ikaga SHIORI)” and the name `ikaga` in the code (including the project format `ikaga/1`)
