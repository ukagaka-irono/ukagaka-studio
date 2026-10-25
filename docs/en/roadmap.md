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
Stage 5  More features       trying, editing in bulk, ghost contents, getting started
Stage 6-7                    richer ghost behaviour; easier to write and check
Stage 8  YAYA dictionaries   dictionaries in the project, written as text and blocks
Stage 9  Dictionary help     checks, copy, search and the reference for dictionaries too
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
| 0-2 | Decide the version number (e.g. restart counting from `0.1.0-alpha`) (**done**) | `VERSION` and the version the exe reports to the UI agree |
| 0-3 | Decide the branding: the logo (🍐 for now), the example and default character names (なしこ, なしちゃん, なしゴースト) → **decided** (“Decisions” below). Swapped in stage 2 | the 5 examples and the defaults replaced |
| 0-4 | Show the original project in an “About this software” screen in the app (**done**) | license section 3 satisfied outside the README too |

> **0-2 is done** (2026-10-22). **Versions count on from 2.0.0-alpha with ordinary semver** (see Decisions). 2.0.0 was chosen when
> ikaga SHIORI was removed, so counting does not restart. The version the exe reports to the UI is also made from `VERSION`
> (`version_gen.h`), so changing that one file keeps them in step. The rules are in “Releasing a version” in the maintenance guide.
>
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

## Stage 4 — New features (done)

Every candidate listed here is done (2026-10-22). New ideas will be added here as they come up.

### The rest of SERIKO (done)

* ~~Grouped operations such as `alternativestart`~~, ~~`scaling` / `insert`~~, ~~the finer kinds of `blend-*`~~, ~~dress-up (MAYUNA) `bind`~~

> **The rest of SERIKO is done.** The syntax follows UKADOC's surfaces.txt and shell descript.txt. What was done:
>
> * Frame drawing methods gained `alternativestart` / `alternativestop` / `parallelstart` / `parallelstop` (a list of numbers, written as `,(1,2)`),
>   `scaling` (width and height as %; decimals allowed), `insert` (drawing position for a dress-up), `add` (a dress-up part), and 27 `blend-*` modes
>   (`ANIM_METHODS` in `ui/js/model/model.js`, `KnownMethod` in `studio/src/export_seriko.cpp`).
> * Dress-up: an animation's “when” can be “dress-up” (`interval,bind`), with a category, a name and whether it is worn at start. The shell's
>   `descript.txt` gets `sakura.bindgroupN.name` / `.default` and `sakura.menuitemN` (`kero.` when the base surface is 10 or higher;
>   `BindDescriptLines`). A block to switch it from the ghost, “dress-up C: wear / take off P” (`dress`, `\![bind,…]`), was added too.
> * The per-category selection rule (`mustselect` / `multiple` of `sakura.bindoptionN.group`) and `addid` (also wear) were added afterwards
>   (both exporting and importing from an existing shell).
> * Tests: the export test's input has the new methods and dress-ups, and the shell's `descript.txt` is compared too (34 checks).
>   The parity test gained OnP32 (the dress-up block) and the editor test the normalizing of the new shapes (114 checks).

### Shell features

* ~~Import an existing shell folder~~ (numbered images in 3-5d; animations, rectangular hit areas and dress-up names in stage 4; see “What was done” below)
* ~~Draw hit areas on top of the picture~~ (done: “Hit areas” on each surface draws rectangles by dragging on the picture;
  `shell.areas`, `ui/js/panels/areas.js`; drawn names can be picked in mouse hats; the export test input covers them)
* ~~Also import animations and hit areas from an existing shell~~ (done)
* ~~More choices for how the balloon looks~~ (done: shape, size, tail, line and text colors; `studio/src/export_balloon.cpp`;
  the export test gained the `balloon-styled.json` input)

> **The shell features are done.** Importing an existing shell folder now also reads the animations in `surfaces.txt` (`animationN.*` in the
> new SERIKO/2.0 syntax: frames, when they play, and their hit areas), the surfaces' rectangular hit areas (`collisionN`, which become
> `shell.areas`), and the dress-up names in the shell's `descript.txt` (`sakura.bindgroupN.name` / `.default`) (`studio/src/shell_import.cpp`).
> Non-rectangular surface hit areas (`collisionexN`) and the SERIKO/1 syntax (`0interval` and so on) are not read; their number is reported.
> Animations with the same number on the same surface are replaced. The 3-5d decision not to import animations and hit areas was changed now
> that there is a place for them (`shell.areas`, the new drawing methods; see Decisions). The export test reads a shell built on the spot (36 checks).

### Editor

* ~~**Notes (comments)** on blocks~~ (done; see “What was done” below)
* ~~Copy and paste between projects~~ (done)
* ~~Autosave and going back to an earlier version~~ (done)
* ~~Saving a frequently used arrangement as a “part”~~ (done)

> **Parts are done.** This completes the editor candidates. What was done:
>
> * “Save this and below as a part” in a block's right-click menu (“Save this script as a part” on a hat) saves it under a name.
>   Parts are kept in `parts.json` next to the exe (`GET` / `POST /api/parts`), outside any project, so every project can use them.
> * The palette has a new “Parts” category. Dragging a part places all its blocks and adds any variables it uses that are missing, with their
>   initial values (the same rule as copy and paste). A part's right-click menu renames or deletes it (`ui/js/editor/parts.js`).
> * Tests: the editor test checks that a part holds its name, a copy of the blocks and the initial values of the variables it uses (110 checks).

> **Copy and paste between projects is done.** What was done:
>
> * Copied blocks already survived opening another project (within one run). They are now also kept in WebView2's storage (`localStorage`),
>   so they can be pasted after a language switch reloads the page, and after restarting.
> * When copying, the variables the blocks use (names and their initial values in the current project) are kept too, and only those missing
>   from the project you paste into are added (existing initial values are left alone; undo removes the added variables too). Targets of
>   blocks that call talks are not added (the Check tab reports them as missing talks).
> * Tests: 5 checks in the editor test (variables inside nested blocks, pasting into another project after a restart, which variables are added,
>   the notice, undo).

> **Autosave and earlier versions are done.** What was done:
>
> * Autosave (every minute while there are unsaved changes) already existed; **earlier versions** were added on top. On every save the exe
>   keeps what it overwrites in `projects\.history\<name>\<date-time>.json` (`studio/src/project_history.cpp`): always for manual saves,
>   for autosaves only when the newest version is at least 10 minutes old, and never when the contents are the same.
>   Up to the newest 30 are kept per project, and deleting a project deletes its versions too.
> * In “Open”, 🕘 on each project (and “Earlier versions of this project”) lists the versions and opens one. What you open counts as unsaved,
>   so saving makes it the current version (the current one is kept as an earlier version).
>   Added `GET /api/project/history` and `GET /api/project/version` (error code `version_not_found`).
> * Picking another project in “Open” now asks first when there are unsaved changes (it used to replace it silently).
> * Tests: the export test gained 7 checks for earlier versions (`export_host --history`: first save, manual save, same contents,
>   autosave gap, number kept, file names).

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

## Stage 5 — More features (done)

On 2026-10-23, twelve items centered on what people use every day were listed, to be done from the top.

| | What | |
|---|---|---|
| 5-1 | Click the surface in “Try” to see the reaction (events by hit area) | done |
| 5-2 | Show this script's YAYA | done |
| 5-3 | Reflect into SSP on every save | done |
| 5-4 | A speech list page (read and edit together, CSV in and out) | done |
| 5-5 | Search and replace | done |
| 5-6 | A stronger Check tab (overlong speech, talks never called, unused variables) | done |
| 5-7 | Fold scripts on the canvas | done |
| 5-8 | Add items to SSP's right-click menu | done |
| 5-9 | Anniversary and alarm hat blocks | done |
| 5-10 | Pick hand-written function names | done |
| 5-11 | Set the ghost's thumbnail and readme on screen | done |
| 5-12 | A starter ghost wizard | done |

> **5-1 is done.** Clicking a surface on the stage runs OnMouseClick, double-clicking runs OnMouseDoubleClick, and moving over the same spot
> 8 times runs OnNadeNade, chosen the same way as in SSP (filters and default reactions; `ui/js/panels/touch.js`). Where you touched is decided
> by the drawn hit areas, or by the automatic ones the exe makes from the picture size (`GET /api/shell/areas`, split out as the same
> `DefaultHitAreas` the export uses), and the References are passed in SSP's order. The Try entry (`studio_preview.dic`) runs the event through
> `Studio.Dispatch` when it receives `event:<event name>`. The YAYA test checks that filters work (23 checks).


> **5-2 is done.** “Show YAYA” in a script hat's right-click menu shows that script's YAYA function (with a copy button;
> `ui/js/panels/yayaview.js`). It is cut out of the same `toYaya` output so it never differs from the export (`scriptYaya`),
> and says where the function is called from (through `Studio.Event`, overridden by hand-written code, called from talks). 3 editor checks (119).


> **5-3 is done.** The Export page has “Put into SSP on every save”. When on, saving by hand does the same as “Run it in SSP” if SSP is
> running. Autosaves and the save on closing do not (`panels/dialog.js` sends the `saved` notice and `panels/ssp.js` receives it).
> The setting is kept in this PC's WebView2 storage.


> **5-4 is done.** A “Speech” page was added below the top bar. It lists the speech of every “says” block, grouped by script, editable in place
> (with a filter; clicking a script name jumps to it on the canvas; `ui/js/panels/lines.js`). CSV is exported as UTF-8 with a BOM, and on import
> rows are matched by key (script id and block position) so only changed lines are written back (`ui/js/model/lines.js`). 4 editor checks (123).


> **5-5 is done.** The Search tab gained “Replace with” and “Replace all (number found)”. Only text fields of blocks (text fields of
> `kind: 'input'`, including blocks dropped into slots) are replaced; `literal` fields (YAYA function names and expressions) and variable names
> are not (`ui/js/model/replace.js`). It asks first and replaces in one undo step. 3 editor checks (126).


> **5-6 is done.** The Check tab (`ui/js/model/lint.js`) points out three new things (all warnings): speech longer than 200 characters;
> named talks (the “talk” hat) that no “call” block, choice or “call after … seconds” calls (random talks are picked automatically, so they
> are not flagged; calls from disabled scripts do not count); and variables that are set but never read by a variable block (variables never
> used at all were already flagged). The hint says it is fine to leave them when hand-written YAYA uses them. No example is flagged.
> 8 editor checks (134).


> **5-7 is done.** ▾ above a script and “Fold” in the hat's right-click menu fold the script: only the hat and a “… N blocks (folded)” bar
> are drawn (clicking the bar unfolds it). Right-clicking empty space offers “Fold all” and “Unfold all”. The flag lives in `script.folded`
> (kept only when true), so it is saved and undoable; it does not affect behaviour or the exported YAYA. Nothing is dropped or pasted into a
> folded script, and jumping to a block inside one from Check or Search unfolds it first. 1 editor check (135).


> **5-8 is done.** A new event, “When picked from the SSP menu” (`OnStudioMenu`), turns the hat into “When picked from the SSP menu: …”
> (`@event.menu`) with the name to show in the menu (`script.menu`). The exported ghost.json carries `menu` only for that event (same shape
> from the UI and the exe). studio_program.dic gets `On_sakura.recommendsites` (yaya_base prefixes the `sakura.recommendsites` resource SSP
> asks for with `On_`), which returns “name [1] `script:\![raise,OnStudioMenu,script id]` [1] [1]” per item, joined with [2]. When an item is
> picked, SSP raises OnStudioMenu and `Studio.Dispatch` in `studio_runtime.dic` runs only the script whose id is in Reference0 (nothing for
> disabled scripts or unknown ids). Disabled scripts and scripts whose id has symbols are left out of the menu. When the linked hand-written
> ghost has `On_sakura.recommendsites`, it is not written and the Check tab says so; empty and duplicate names are flagged too. Try passes the
> script's id as Reference0. 1 behavior scenario (20 scenarios, 103 checks), a menu script in the export fixture, 5 editor checks (140).


> **5-9 is done.** New events “At a set time every day” (`OnStudioAlarm`) and “On an anniversary” (`OnStudioAnniversary`) turn the hat into
> hour/minute (`@event.alarm`) or month/day (`@event.anniv`) fields (picking the event again fills missing fields with their defaults).
> The exported ghost.json carries `when` (`'HH:MM'` or `'MM-DD'`, out-of-range values moved to the nearest edge; same shape from the UI and the
> exe), and loading it unpacks it again. `Studio.Def` gains a 14th argument (`when`); `Studio.RunTimed` in `studio_runtime.dic` runs every
> matching script when the minute changes during OnSecondChange (anniversaries first), and not while the ghost cannot talk. Anniversaries
> remember the day they ran in `Studio.annivDone` (saved), so they run once a day. The Check tab flags times and dates that do not exist.
> The YAYA test builds a ghost from the current time (3 checks, 26 in all); the export fixture has one alarm and one anniversary; 7 editor
> checks (147).


> **5-10 is done.** Next to the function name of “call YAYA function F with A B” (`pick: 'yayaFunctions'`), a **▾** appears while a
> hand-written ghost is linked, to pick from that ghost's functions (typing still works). The list comes from `yayaCallChoices` in
> `model/yaya.js`, which leaves out event and resource entry points (`On…`) and system functions (`Studio.…`, `SHIORI3FW.…`, `SHIORI3EV.…`)
> and sorts by name. The canvas is redrawn once the linked ghost has been inspected, so it shows up right after opening. 2 editor checks (149).


> **5-11 is done.** The Ghost info page gained “Thumbnail and readme”. The thumbnail is chosen with the same PNG dialog as surfaces
> (`/api/shell/pick`) and kept in `meta.thumbnail` (path, name, w, h, stamp); on export, a readable PNG goes into the top of the archive as
> `thumbnail.png` (next to install.txt, as in UKADOC's ghost layout). The readme is kept in `meta.readme`; when set, it replaces the top part of
> readme.txt (name, author, version, description), with line breaks made CRLF and the YAYA note below kept. ghost/master/descript.txt also gains
> `readme.charset,UTF-8` (readme.txt is UTF-8, but without it SSP reads it in the OS encoding). 3 export checks (39).


> **5-12 is done.** “New” in the top bar opens the starter wizard (`ui/js/panels/starter.js`): the names of the ghost and its two characters,
> the author, and the parts to start with (startup and closing greetings, double click, pats, 3 random talks, a noon alarm, today as an
> anniversary, “Talk to me” in SSP's menu). `starterProject(opts)` in `ui/js/model/sample.js` places only the picked parts, creates the
> affection variable only when a part uses it, and turns automatic talk off without random talks; the greetings use the entered names.
> The startup template (`sampleProject`) is built from the parts checked by default. Editor checks make sure no combination trips the Check tab
> (affection is read when patted, so the line changes as you keep patting) (6 checks, 155).
>
> **Stage 5 is now complete.**


---

## Stage 6 — Richer ghost behaviour (done)

On 2026-10-23, the three items that save authors the most work were picked from ten candidates, to be done from the top
(they were 6-1, 6-2 and 6-6 in the candidate list).

| | What | |
|---|---|---|
| 6-1 | Filter random talks (time of day, season, affection, boot count) | done |
| 6-2 | Serial talks (one episode further on each boot) | done |
| 6-3 | A list of events without a reaction (click to place the hat) | done |


> **6-1 is done.** The random talk hat gained “when” (`when`: any time, or one of morning, afternoon, evening, night, spring, summer, autumn,
> winter, with the same boundaries as the “time of day” and “season” values) and an “if” condition slot (`cond`; affection and boot count go
> there as comparison blocks). The exported ghost.json carries `when` and `cond` only when used (same shape from the UI and the exe), and
> studio_program.dic gets a `Studio.Cond.…` function per condition (the script's function name with Studio.Script. replaced by Studio.Cond.).
> `Studio.TalkOk` in `studio_runtime.dic` leaves out talks whose time, season or condition does not match, both when picking a random talk and
> for “call one from group”. The Check tab looks inside conditions too (missing and read variables). 2 behavior scenarios (22 scenarios, 111
> checks), a YAYA test of time of day and season against the current time (27), a filtered talk in the export fixture, 4 editor checks (159).


> **6-2 is done.** Control gained “serial … episode 1 (next episode on each boot; at the end …)” (`serial`). Episodes are added with −/+ like
> “one of these at random”, with “episode 2”, “episode 3”, … between them (`dynamicLabel` in the block definition). The translation calls
> `Studio.Serial(name, episode count, 1 to start over)`, which returns the episode to play (`studio_runtime.dic`). It moves on only the first
> time it runs after a new boot (the same episode within one boot), and progress is saved per name in `Studio.serialAt` / `Studio.serialBoot`.
> The Check tab flags an empty name, two serials with the same name and empty episodes. 1 parity case (33; Try gives the same answer), a YAYA
> test that restarts the ghost and sees one episode per boot (both endings; 29 checks), 4 editor checks (163).


> **6-3 is done.** The Check tab gained “Events without a reaction yet” below the warnings. It lists the common events (first boot, boot,
> closing, double click, pats, coming from / going to another ghost, restoring from minimized) that no enabled script handles and the linked
> hand-written dictionary does not have, plus random talk when there is none (`Lint.missingEvents`, no DOM). Each row says whether the ghost
> currently gives the default reaction (answered by `Studio.BuiltinDefault` in `studio_runtime.dic`) or does nothing, and “Place” puts the hat
> in a free spot and scrolls to it. These do not count toward the Check tab badge. 2 editor checks (165).
>
> **Stage 6 is now complete.**


---

## Stage 7 — Easier to write, easier to check (done)

On 2026-10-23, the seven candidates not picked for stage 6, to be done from the top.

| | What | |
|---|---|---|
| 7-1 | A hat for “on the Nth boot” | done |
| 7-2 | Filter “when a key is pressed” by key | done |
| 7-3 | “Expression” buttons on speech fields (insert marks that change the expression or pause) | done |
| 7-4 | Export and import parts as files | done |
| 7-5 | Draw random talks 100 times in “Try” | done |
| 7-6 | See what changed since an earlier version | done |
| 7-7 | A diagram of where choices lead | done |


> **7-1 is done.** A new event, “On a chosen boot” (`OnStudioNthBoot`), turns the hat into one with a count (`@event.nthboot`). The exported
> ghost.json carries the count in `when` (values below 1 become 1; same shape from the UI and the exe), and loading unpacks it again.
> On every OnBoot and OnFirstBoot, `Studio.RunNthBoot` in `studio_runtime.dic` tries the scripts whose count equals the boot count
> (`Studio.boots`) from the top, and if one says something, returns it instead of the usual “on boot”. The Check tab flags unusable counts.
> 1 behavior scenario (23 scenarios, 115 checks), one script in the export fixture, 4 editor checks (169).


> **7-2 is done.** Picking “When a key is pressed” turns the hat into one with a key (`@event.key`). UKADOC says Reference0 is the character
> on the key and Reference1 the virtual key code, so either can be entered: `Studio.Matches` in `studio_runtime.dic` compares text with
> Reference0 ignoring case, and a number with Reference1. Scripts with a key win over those without (`Studio.Specificity`). The exported
> ghost.json carries the key in `when` only when set (trimmed; same shape from the UI and the exe), and Try passes that key in the References.
> 1 behavior scenario (24 scenarios, 118 checks), one script in the export fixture, 3 editor checks (172).


> **7-3 is done.** “says” text is output with `\` turned into `\\` (so Sakura Script cannot be written there), so expressions and pauses
> became marks in the text: `{face:N}` / `{wait:N}` (and the Japanese `{表情:N}` / `{待つ:N}`, also with a full-width colon) are rearranged into
> `Studio.Say`, `Studio.Surface` and `Studio.Wait` by `ui/js/model/yaya.js` (`studio_runtime.dic` is unchanged; unknown marks stay as text).
> In the editor, **☺** appears next to the speech field (`marks` in the block definition) and inserts, where the cursor last was, that
> character's expressions (0–2 for Sakura, 10–12 for Kero, plus prepared surfaces) and 0.5 s / 1 s pauses. Marks are written in the UI
> language. 1 parity case (34; Try gives the same answer).


> **7-4 is done.** “Export parts to a file” and “Import a parts file” sit at the top of the palette's Parts, and a part's right-click menu
> gained “Export this part to a file”. The file is `{ "format": "ikaga-parts/1", "parts": [ { name, blocks, variables } ] }` (without ids),
> written and read by `partsToFile` / `partsFromFile` in `ui/js/model/partsfile.js`. Reading refuses other files (`not_parts`), skips parts
> without a name or blocks and blocks without a type, gives fresh ids, and renames clashing names to “name (2)”. Export uses the WebView2
> download, import a file picker. 6 editor checks (178).


> **7-5 is done.** “Try” gained “🎲 Draw 100”. The draws happen inside YAYA: the candidate selection of `Studio.PlayRandomTalk` in
> `studio_runtime.dic` was split out as `Studio.TalkCandidates` (filters and the no-repeat rule), and `Studio.DrawTalks` uses it to pick by
> weight and remember each pick as recently played (the talks are not run). The Try entry (`studio_preview.dic`) gained `draw:count` (1–1000),
> whose answer carries `draws` (count per script id) and `none` (draws with no talk available); the exe passes them on to the UI, which shows a
> bar per random talk (including those drawn 0 times). Filters use the current time and the continuing Try variables. The YAYA test checks that
> weights 3 and 1 still alternate under the no-repeat rule, that weight 0 and non-matching talks are never drawn, and that passing variables lets
> the conditional talk in (31 checks). The path through the exe (`/api/preview` passing `draws` on) builds, but has not yet been tried in a running exe.


> **7-6 is done.** In 🕘 (earlier versions) under “Open”, versions of the project that is open now get “Compare with now”. It loads that
> version (through `Model.normalize`) and compares it with the current project using `diffProjects` in `ui/js/model/diff.js`: scripts by id
> (added, changed, removed; moving or folding alone does not count; changed ones show their block counts), variables by name (initial
> values), plus the ghost info and settings fields. Clicking an added or changed script in the list jumps to it and highlights it.
> 6 editor checks (184).


> **7-7 is done.** “Links” sits below the canvas, and the right-click menu of empty space gained “See where choices lead (diagram)” (through
> `Commands.showGraph`). `choiceGraph` in `ui/js/model/graph.js` collects lines from choices (targets), “call” and “call after … seconds”
> (disabled scripts are left out), turns missing talks into missing nodes, and assigns columns and rows by walking from nodes nothing leads to
> (it stops on loops). `ui/js/panels/graph.js` draws it as SVG (choices as solid lines with labels, calls dotted, missing talks as red dashed
> boxes, lines going back left curve below the boxes), and clicking a box jumps to the script. `Dialog.modal` gained a wide window (`wide`)
> for the diagram. 3 editor checks (187).
>
> **Stage 7 is now complete.**


---

## Stage 8 — Building a YAYA ghost entirely inside the studio (done)

Decided on 2026-10-25. Today's blocks write what ghost-making needs on top of the studio's own machinery (`Studio.…`), and cannot express all
of YAYA's syntax (functions with arguments and return values, local variables, arrays and hashes, `for` / `foreach` / `case` / `switch`,
`break` / `continue` / `return`, output modes and `--`, `%(expr)`, `#define`, YAYA's built-in functions, and so on).
So **the project will hold YAYA dictionaries (.dic)**, editable as text or as blocks that map 1:1 to YAYA. Blocks and text are linked
**both ways**, live (editing with blocks rewrites the text in a fixed format; comments are kept). Today's simple blocks stay as they are.
The goal is to finish a YAYA ghost inside the studio without linking a hand-written ghost.

| | What | |
|---|---|---|
| 8-1 | Read (parse) and write (pretty-print) YAYA text, covering all of YAYA's syntax, checked against yaya_base and others | done |
| 8-2 | Keep YAYA dictionaries in the project (export, `yaya.txt`, the Check tab, clashes with block events) | done |
| 8-3 | A text editor for dictionaries (line numbers, colouring, where the mistakes are) | done |
| 8-4 | Blocks for every YAYA construct and for the built-in functions | done |
| 8-5 | Two-way live sync between blocks and text | done |
| 8-6 | Import an existing YAYA ghost's dictionaries into the project | done |
| 8-7 | Run dictionary functions in “Try”, and show the simple blocks' YAYA live alongside | done |


> **8-1 is done.** `ui/js/model/yayatext.js` gained `parseYaya`, which turns YAYA dictionary text into a tree, and `printYaya`, which turns the
> tree back into dictionary text (`parseExpr` / `printExpr` for a single expression). It follows YAYA's grammar manual (the grammar pages at
> yaya-shiori.github.io/yaya-docs) and covers functions and selection modes (including `_pool` and `melt_`), nested blocks and their modes, the
> `--` output separator, `parallel` / `void`, numbers (binary, hex, real), strings (doubled `""` / `''`, `%(…)`), heredocs, joining lines with a
> trailing `/` (even in the middle of a name; not at the end of a `//` comment), every operator (by precedence, assignment also binding left to
> right, `_in_` / `!_in_`, the `:=` forms, `,=`, prefix and postfix `++` / `--`, `&` arguments, `[ ]` delimiters and ranges), if / elseif / else
> (also without braces), case / when / others (lists, ranges, one-liners), switch, while, for, foreach (two variables, header parentheses),
> break / continue / return, comments and preprocessor lines such as `#define`. Printing settles indentation (tabs) and the braces of if and
> the like, and keeps strings, numbers, parentheses, comments and blank lines as written. A function that cannot be read does not stop the
> rest: it is kept verbatim and reported with its line number. The new test `ui/test/yayatext.js` (the 10th; 65 checks) covers the manual's
> examples and checks that yaya_base, the runtime dictionaries and the hand-written test ghost all parse and survive printing. Part 11 of the
> YAYA test pretty-prints all 5 yaya_base files, the runtime and the translated dictionary, and the real yaya.dll gives the same answers for
> all 34 parity cases. Right away, the Check tab now reads the expression of “value of YAYA expression C” and flags one that is not valid YAYA
> (one unreadable expression stops YAYA from reading the whole dictionary). 2 editor checks.


> **8-2 is done.** The project gained `dics` (`[{ name, text }]`, `ui/js/model/dics.js`). On export the exe (`studio/src/exporter.cpp`) writes each
> one to `ghost/master/<name>` with CRLF and adds `dic, <name>` after the studio dictionaries in `yaya.txt`. Only names ending in `.dic`, without
> folder separators or characters Windows forbids, and not a studio file (`studio_runtime.dic` and so on) are written (`DicNameOk` in the exe and
> `dicNameOk` in the UI follow the same rule; a second name differing only in case is skipped too). Functions in the dictionaries are passed to the
> export as “hand-written”, as with a linked hand-written ghost, so the block entry for an event the dictionaries define is not written and the
> dictionary's one runs (YAYA refuses all dictionaries when a function name appears twice). The Check tab reports unreadable lines (with the
> dictionary and line), unusable names, duplicate dictionary names, functions defined in two dictionaries, function names the studio or yaya_base
> already uses (the yaya_base list lives in `dics.js` and `ui/test/yayatext.js` checks it against the real thing), and events also used by blocks.
> While linked to a hand-written ghost, the project's dictionaries are not exported (the Check tab says so). 3 export checks (42); part 12 of the
> YAYA test exports with the exe and runs the ghost in the real yaya.dll: the dictionary's OnBoot wins, blocks can call dictionary functions, and
> unusable names are not written (35). 9 editor checks (198). The page to create and edit dictionaries comes next, in 8-3.


> **8-3 is done.** A “Dictionaries” page sits next to “Speech” in the top bar (`ui/js/panels/dictionary.js`). Like the Talk page, it fills the
> height with a left column (the list of dictionaries and “+ New dictionary”) and a text editor in the middle. The editor is a `textarea` over the
> coloured text (`highlightYaya` in `ui/js/model/yayatext.js`) with line numbers; each keystroke goes into the dictionary, and shortly after it is
> parsed again so lines that are not valid YAYA are marked beside their numbers and listed below (click one to go there). Only existing colour
> tokens are used (no new ones). Tab indents; Ctrl+Z inside the text is the text's own undo, and one project undo step is recorded when the editor
> loses focus. Names are checked with `dicNameOk`, and a name taken already (even differing only in case) is refused. The page was designed from
> how the existing pages are built and checked afterwards by a separate agent (the differences it found were fixed). 7 colouring checks in the
> YAYA text test (73).


> **8-4 is done.** `ui/js/model/yblocks.js` adds “dictionary blocks”, one per YAYA construct (30, all starting with `y_`), and `astToView` /
> `viewToAst`, which convert between the dictionary tree (`parseYaya`) and a list of blocks: functions (a hat, with the choice mode), output
> (`parallel`, `void`), `--`, assignment (`=`, `:=`, `+=` and the rest, 13 kinds), `++` `--`, if/elseif/else, case/when/others, switch, while,
> for, foreach, break, continue, return, nested blocks with a choice mode, comments, `#` lines and unreadable functions; for expressions, binary
> operators (all but `,`), unary operators, `++` `--` (before and after), function calls, `[ ]`, `( , )` arrays, parentheses and `&`. Numbers,
> strings, here-documents and names are written into slots as YAYA text (slot text is read as a YAYA expression, so writing `"a" + _b` and
> building the blocks give the same thing). Blank lines, comments at the end of a line and comments between a function's name and its `{` are
> kept; a comment after a `}` becomes a comment on the next line, as it does when the text is parsed. The ▾ beside the name in “call a
> function” picks from the project's dictionary functions and YAYA's built-in functions (197: the manual's index lists 189; DIRECTSSTP and 7
> LINT.* functions have pages but are missing from it). They are drawn like the other blocks (`editor/render.js`), which gained a row of
> argument slots (+ −) and multi-line slots (for `/* */` comments). The YAYA text test checks that the manual's examples and the real dictionaries
> (yaya_base, the runtime dictionaries, the hand-written test ghost) all come back the same after a trip through blocks, that every block is used
> somewhere, and that the list knows every function the real dictionaries call (83). The page that lays the blocks out comes next, in 8-5. The
> pretty-printer also no longer keeps a blank line before a `}`.


> **8-5 is done.** On the Dictionaries page, a palette and a canvas of the same dictionary's blocks (the dictionary blocks from 8-4) sit beside the
> text. The palette, canvas and trash follow the Talk page's rules (the same `style.css` rules also apply to the Dictionaries page's ids) and
> the same rendering (`Render.renderPaletteEntries`). The blocks live outside the project (in `panels/dictionary.js`) and follow the dictionary
> text: typing rebuilds them when the text is parsed again shortly after (an unreadable function becomes an “unreadable YAYA” block), and changing
> a block rewrites the text, pretty-printed (while no block changes, the text keeps its own layout). The text also updates while you type in a
> block's slot. So that undo covers block changes, `Model.act` and `pushUndo` call what was registered with `Model.onCommit` (the Dictionaries
> page writing blocks into the text) before recording. Blocks can now be placed in two places, Talk and Dictionaries (the “roots” in
> `editor/drag.js`). Scripts on the canvas are laid out in one column in text order; moving a hat up or down reorders the functions in the text.
> Blocks that cannot become YAYA (an empty slot, an unreadable expression, an “else” without an “if”, …) leave the text alone, are reported in the
> list below and marked on the canvas; blocks outside any function are reported too. Ctrl+D and Delete work on the Dictionaries page's blocks. The
> page was designed from how the Talk page is built and checked afterwards by a separate agent. 3 editor checks (201), 1 YAYA text check (84).


> **8-6 is done.** The Dictionaries page's left column gained “Import from an existing YAYA ghost”. It asks for a ghost folder (the linked ghost, if any, is
> filled in), and the exe's `/api/yaya/dics` (`ReadYayaGhostDics` in `studio/src/yaya_ghost.cpp`) returns the same dictionaries the hand-written
> ghost inspection finds (yaya.txt's dic, dicif and dicdir contents, except yaya_base and Studio's files) as UTF-8 with LF line ends (Shift_JIS is
> converted). `importDicName` (`ui/js/model/dics.js`) turns folder separators and unusable characters into _ and adds _2 on a clash. A list
> (renamed ones shown as “from → to”) is confirmed first, and the ghost's files are not changed. Clashing functions and events show in the Check
> tab as before. Other yaya.txt settings (SAORI and so on) are not imported. The field is built like the shell import field and was checked by a separate agent. Part 13 of the YAYA test (36), 2 editor checks (203).


> **8-7 is done.** “Try” now passes the project's dictionaries too (`dics` in `/api/preview`; the exe puts them in its work folder and rewrites
> yaya.txt each time, leaving out unusable and duplicate names as export does). Functions in the dictionaries get no block entry (treated as
> hand-written, as on export), and events defined there run the dictionary function directly through “call:name” (`studio_preview.dic`; the
> event's references go into reference, reference.raw and reference0…). The Try tab's picker gained “Dictionary functions”, and function hats on
> the Dictionaries page have their ▶ back. A **YAYA** tab in the Talk page's right column shows the YAYA of the script you last pressed on the canvas,
> translated as “Show YAYA” does (`scriptYaya`) and coloured like the Dictionaries editor, re-rendered on every change (also while typing in a
> slot). It is built like the other right-column tabs and was checked by a separate agent. Part 14 of the YAYA test (40).
> **This completes stage 8.** YAYA dictionaries live in the project, can be written as text or as blocks, imported from an existing ghost, run
> in Try and exported.


---

## Stage 9 — Making dictionaries as easy to write as blocks

Decided on 2026-10-25. Stage 8 made it possible to write, run and export YAYA dictionaries inside the studio. Some help that blocks have is
still missing for dictionaries (Check tab warnings, copy and paste, search and replace, the block reference). This stage fills in those gaps,
found while building stage 8.

| | What | |
|---|---|---|
| 9-1 | The Check tab warns about likely mistakes inside dictionaries (calls to functions that exist nowhere) | done |
| 9-2 | Copy, cut, paste and the right-click menu for blocks on the Dictionaries page | done |
| 9-3 | The Search tab also searches dictionaries, and replacing also replaces inside dictionary strings (speech) | done |
| 9-4 | A table of the dictionary blocks in the block reference (`docs/blocks.md`) | done |

> **9-1 is done.** The Check tab (`dicIssues` in `ui/js/model/dics.js`) warns (⚠, with dictionary and line; click to go there) about calls to
> functions found nowhere: not in the project's dictionaries, YAYA's built-in functions (`YAYA_SYSTEM_FUNCTIONS`), yaya_base, the studio's
> machinery, or the blocks' events. YAYA silently skips a call to a missing function, so a misspelt name is otherwise easy to miss. Calls are
> the names the colouring (`highlightYaya`) marks as followed by “(”, so comments and strings are left out. Each name is reported once per
> dictionary. Unreadable dictionaries, and projects linked to a hand-written ghost, are not checked. Calling a function by its bare name (no
> “(”) cannot be told apart from a variable and is not checked. 3 editor checks (206).

> **9-2 is done.** The Dictionaries page's canvas takes Ctrl+C, Ctrl+X, Ctrl+V, Ctrl+D and Delete, and has a right-click menu (`dicMenu` in
> `editor/contextmenu.js`: on a block copy, cut, paste below, duplicate, delete; on a function hat run, duplicate, fold, delete; on empty space
> paste here, fold all, unfold all). There is one clipboard: dictionary blocks (types starting with y_) paste only on the Dictionaries page and Talk blocks only on
> the Talk page; on the wrong page nothing is pasted and a message says why (`editor/clipboard.js`). Dictionary blocks are rebuilt from the
> text, so “disable”, notes, “save as part” and “show YAYA”, which the text has no place for, are not offered. The menu reuses the Talk
> canvas's menu parts and was checked by a separate agent. 1 editor check (207).

> **9-3 is done.** The Search tab (`panels/search.js`) also searches the project's dictionaries and lists matching lines as 📖 rows (the
> line's text and “Line N of dictionary “…””; click to go to that line). “Replace all” (`model/replace.js`) replaces only inside dictionary strings
> ("…", '…' and here-documents), never function or variable names, comments or code: the speech lives there, and a bulk replace must not break
> YAYA. Strings are found with the colouring (`highlightYaya`), and the quotes are kept. The replace count includes dictionaries, and undo
> reverts it. The rows follow the existing Search rows and were checked by a separate agent. 2 editor checks (209).

> **9-4 is done.** The block reference (`docs/blocks.md` and its English version) ends with a “Dictionary blocks” section: a table of the 30
> dictionary blocks with their UI names, types and the YAYA each becomes (plus how slots take YAYA text and where a comment after `}` goes). The
> YAYA text test checks that every dictionary block has a row in both tables (85).

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
| 2026-10-22 | Versions **count on from 2.0.0-alpha with ordinary semver** (major for big changes, minor for new features, patch for fixes; `-alpha` / `-beta` mark trial versions). Counting does not restart (0-2) |
| 2026-10-22 | Variables of ghosts exported earlier with ikaga SHIORI (`ikaga_save.json`) **are not carried over to YAYA**. After exporting again, variables start from the project's initial values (“Clear the ghost's memory” also deletes a leftover `ikaga_save.json`) (stage 3) |
| 2026-10-22 | From an existing shell, **animations (SERIKO/2.0), rectangular hit areas and dress-up names are imported too**; non-rectangular surface hit areas and SERIKO/1 are not (changes the 3-5d decision now that there is a place for them; stage 4) |
| 2026-10-25 | To cover all of YAYA's syntax, **the project holds YAYA dictionaries**, edited **both ways** as text and as blocks that map 1:1 to YAYA; today's simple blocks stay (stage 8) |
| 2026-10-24 | Branches are split into **`main` (what is distributed), `develop` (everyday work) and `fix/…` (fixes)**; see “How branches are split” in the maintenance guide |
| 2026-10-22 | The name “如何栞 (ikaga SHIORI)” and the `ikaga` names in the code (the project format `ikaga/1`, the input box ID `ikaga:<variable>`, the `ikaga.lang` setting and so on) **stay as they are**, for compatibility with earlier projects and exported ghosts; the docs call them “a leftover from the 1.x SHIORI's name” (stage 3) |

## Not decided yet

* Nothing right now (decisions go into the table above).
