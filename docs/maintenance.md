# 手入れの手引き

English: [en/maintenance.md](en/maintenance.md)（英語版。こちらの日本語版が正です）

しばらく触っていないこのリポジトリに戻ってきたとき用の覚え書きです。
「どこに何があるか」は README の**フォルダ構成**にあります。
ここに書くのは、**書いてある場所が離れていて、片方だけ直すと静かに壊れる決まり**のほうです。

---

## まず、これを走らせる

```powershell
node tools\check-blocks.js     # 1 秒。ビルド不要。ブロックがそろっているか
.\build.ps1 -Test              # 3 分ほど。ビルドしてテスト 9 本
```

`check-blocks.js` はビルドが要らないので、**手を入れたら、まずこれ**です。
`build.ps1 -Test` の中でも、ビルドより先に走ります（書き忘れが 2 分待たずに分かります）。

---

## ブロックを動かすのは、いつも栞です

**段階 3（如何栞を YAYA に置きかえる）のあいだは、動かすものが 2 つあります。**

| どこで動くか | 誰が動かすか |
|---|---|
| SSP に入れたゴースト | いまはまだ `ikaga.dll`（32bit）の `interp.cpp`（3-6 で YAYA に置きかえます） |
| エディタの「ためす」 | **YAYA**（SSP に入るのと同じ 32bit の `yaya.dll`。exe に埋めこんだ `yaya_host.exe` が動かします） |

画面（`ui/js/`）はブロックを解釈しません。ブロックを YAYA の辞書に訳して（`ui/js/model/yaya.js`）
`POST /api/preview` に頼み（`studio/src/yaya_preview.cpp`）、返ってきたさくらスクリプトを
`ui/js/model/player.js` がほどき、`ui/js/panels/stage.js` が再生するだけです。
2 つが同じ答えになることは、`shiori\test\yaya\yaya.js` が見ます（如何栞と YAYA、YAYA の「ためす」と SSP の動かしかた）。

「ためす」は、作業用のフォルダ（`%TEMP%\ukagaka-studio-preview-<プロセス番号>\`）に YAYA 一式
（`yaya.dll`・`yaya_host.exe`・`yaya_base`・`studio_runtime.dic`・「ためす」の入り口 `studio_preview.dic`）を書き出し、
かたまりを 1 つ動かすたびに `yaya_host.exe` を 1 回動かします（1 回 0.1 秒ほど。起動して最初の 1 回だけ、
Windows の検査で 1〜2 秒かかることがあります）。フォルダは exe を閉じるときに消します。
`studio_preview.dic` は書き出すゴーストには入れません（外から変数を書きかえられてしまうため）。

> むかしは `ui/js/sim.js` に同じ規則を JavaScript でもう一度書いていました。
> 片方だけ直すと、エディタでは思ったとおりなのに SSP では違う、という形で
> あとから分かる、いちばん厄介なズレかたをしました。474 行を消してあります。

如何栞の一致テストは、同じ `interp.cpp` を 32bit と 64bit で組んで見くらべます（64bit のほうは、
もとは「ためす」が使っていたものです。いまはテスト用の `preview_host.exe` だけが使います）。
`int` と `size_t` の大きさに頼った書きかたをすると、そこで止まります。

`interp.cpp` は SAORI の DLL の読みかたを知りません（`saori.h` の `SaoriHost` で
一枚はさんであります）。プレビューは SAORI を呼ばないので、そこに `NULL` を渡しています。
YAYA の「ためす」も SAORI は呼びません（`Studio.noSaori`）。

---

## ブロックを 1 つ足す

順番に、6 か所です。`node tools\check-blocks.js` が、抜けたところを名指しで教えます。

1. **`ui/js/model/blocks.js`** — `def({ type: '…', cat: '…', shape: '…', spec: '…', args: {…} })`。
   見た目と `ghost.json` の形が決まります。そして `PALETTE` の、置きたいカテゴリに
   名前を足します（足さないと、定義してもパレットに並びません）。
2. **`shiori/src/interp.cpp`** — `RunBlock` に `if (type == "…")`。**ここだけが動かす側です。**
   文字を出すときは直に足さず、**`Emit(ctx, …)`** を通してください（長さの上限がかかります）。
3. **`docs/blocks.md`** — 表に 1 行。`{"type":"…"}` の形と、出るさくらスクリプトを書きます。
4. **`docs/en/blocks.md`** — 英語版の表にも同じ 1 行（ブロックの名前は、英語の画面に出る名前で）。
5. **`shiori/test/parity/ghost.json`** — `OnP**` の帽子で 1 つ。`id` も付けてください。
   **毎回おなじ結果になる形**にしてください（乱数や時計を使うと、毎回ちがう答えになります）。
6. **`ui/js/model/yaya.js`** — YAYA に訳すところ（段階 3）。値のブロックなら `expr()`、文のブロックなら `stmt()` に
   `case '…':` を足して、しくみの辞書の `Studio.〜` を呼ぶ 1 行にします。新しい動きが要るなら、
   **`studio/res/yaya/studio_runtime.dic`** に `Studio.〜` を足します（情報ブロックの key は `Studio.Sys` に `_key == '…'`）。
   如何栞と同じ答えになるかは、`node shiori\test\yaya\yaya.js` が 5. の場面を両方で動かして見ます。

「空だと困る欄」があるブロックなら、**`ui/js/model/lint.js`**（チェックタブ）にも足します。
ブロックの文は `t()` を通すので、**`ui/js/i18n/en.js` に英語の文**も足します（無いと `ui\test\i18n.js` が止めます）。

`PALETTE` に足したブロックは、`/` の「ブロックを探して置く」にも自動で出ます（`model/blockindex.js` が
`PALETTE` から一覧を作ります）。`ui\test\editor.js` が、パレットのブロックが全部さがせることを確かめます。

`ui/` を直したら、**`studio\build.ps1` で exe を作りなおします**（UI は exe に埋め込まれています）。
`interp.cpp` を直したときは、**栞とスタジオの両方**を作りなおしてください
（`.\build.ps1` が順に作ります）。

### 情報ブロック（`sys`）を足すとき

`blocks.js` の `sys` の `options` と、`interp.cpp` の `SysValue` の 2 か所です。
時計まわりの値は毎回ちがう答えになるので、一致テストには乗せられません
（`check-blocks.js` が「テストで動かしていない情報ブロック」として、お知らせに並べます）。

### わざと片方だけにするとき

手書きの `ghost.json` むけに、パレットには出さない型や演算があります
（`stop`、`arith` の `min` / `max` など）。`tools/check-blocks.js` の **`KNOWN`** に、
**なぜそうなのかを書いて**足してください。書いておかないと、次に来たとき
「消し忘れ」なのか「わざと」なのか分かりません。

---

## テスト 9 本と、それぞれが守っているもの

| 走らせかた | 守っているもの |
|---|---|
| `node tools\check-blocks.js` | ブロックが 6 か所にそろっているか（書き忘れ探し） |
| `node shiori\test\parity\parity.js` | 同じ `interp.cpp` を 32bit と 64bit で組んで、出力が同じか（ビット幅に頼った書きかたを見つける） |
| `node shiori\test\behavior\behavior.js` | 栞**だけ**が持っている判断（どれを選ぶか・既定の反応・間引き・通信・SAORI）。英語のゴーストの既定の反応と「いまごろ」などの値も |
| `node shiori\test\yaya\yaya.js` | YAYA（`third_party\yaya\yaya.dll`）が公式のビルドのまま（`third_party\README.md` の SHA-256 と同じ）で動くか。ブロックを YAYA に訳して、一致テストのゴーストが如何栞と同じ答えになるか（栞をまたいだ一致テスト）、ふるまいテストの場面（`shiori\test\behavior\scenarios.js`）を YAYA でも満たすか、変数が次の起動に残るか |
| `node studio\test\export.js` | 書き出したファイルの中身（バイトで見くらべ）。英語のゴーストの readme.txt・既定の名前・`meta.lang` も |
| `node ui\test\editor.js` | 読みこみの整形と形の版（`model.js`）とチェックタブ（`lint.js`）、ブロックを字でさがすところ（`blockindex.js`）。お手本（日本語と英語）がチェックに引っかからないか |
| `node ui\test\modules.js` | `ui\js\` が `main.js` からたどれて、import が層の決まりどおり・輪が無く、どれを最初に読んでも落ちず、`Xxx.yyy()` の呼び先がそろっているか。`style.css` の色がトークンを通っているか |
| `node tools\check-imports.js` | `ikaga.dll` が Windows 2000 から読みこめるか（輸入表を直に読む）。`.\build.ps1 -Test` は、`third_party\yaya\yaya.dll` もこれで見ます |
| `node ui\test\i18n.js` | 画面の日本語がすべて `t()` を通り、英語の訳があるか。英語の辞書に、使われていない訳や `{差しこみ}`／`%欄` のずれが無いか。exe が返すエラーのコードが、すべて画面の文になるか。文書の英語版がそろっているか |

`parity` と `behavior` と `yaya` は `shiori\dist\test_host.exe` を、`parity` はさらに
`studio\test\preview_host.exe` を使うので、**先にビルドが要ります**（`.\build.ps1 -Test`）。
`check-imports` も出来あがった `ikaga.dll` を見るので、ビルドが要ります。
`check-blocks` と `editor` と `modules` はビルド無しで走ります。

書き出しかたをわざと変えたときは、出てきたものを**目で確かめてから**
`node studio\test\export.js --update` で期待値を作りなおします。

### 押したら勝手に走ります

`.github/workflows/build.yml` が、`main` への push・タグ（`v*`）・プルリクのたびに
**手元と同じ `.\build.ps1 -Release`** を windows-latest で走らせます。
打ち忘れても止まるようにするためのものなので、**赤くなったら直してから進んでください**。

* ジョブは 2 つ。`そろい点検`（ビルド不要・1 分ほど）が先に赤/緑を出し、
  `ビルドとテスト`（5 分ほど）が本番と同じ手順を通します。
* ランナーには MSVC も Windows SDK も入っていて、WebView2 の SDK は
  `studio/third_party` に置いてあるので、**落としてくるものはありません**。
* スマートアプリコントロールはランナーには無いので、手元より素直に通ります。

### できたものを落とす

Actions の実行ページをいちばん下まで送ると **Artifacts** があります。**30 日間**残ります。

| 名前 | 中身 |
|---|---|
| `ukagaka-studio-<版>-<sha>` | 配る zip とまったく同じ（`ukagaka-studio.exe` / `README.md` / `README.en.md` / `CHANGELOG.md` / `LICENSE` / `docs`（英語版の `docs/en` も）/ `third_party`（YAYA のライセンス）） |
| `ikaga-dll-<版>-<sha>` | `ikaga.dll` だけ。自分でゴーストに入れる人むけ（エディタの exe にも同じものが入っています） |

`LICENSE` を必ず添えるのは、同梱している WebView2 SDK が配るときに著作権表示を
求めているためです。`build.ps1 -Release` も、`LICENSE` が無ければ**その場で止まります**。

> **Actions の成果物は、GitHub にログインしていないと落とせません。**
> ダウンロードのボタンが、ログインしていない人には出ないためです。
> 誰にでも配りたいときは、`v` で始まるタグを押して Release にしてください。

署名していないので、手元の exe と同じく Windows に止められることがあります。

---

## 画面のファイルの決まりごと

`ui/js/` は **ES モジュール**です（`import` / `export`）。ビルドの道具は使いません。
WebView2 も node も、書いたファイルをそのまま読みます。

* `index.html` が読むのは **`js/main.js` の 1 つだけ**（`<script type="module">`）。
  ほかのファイルは、`main.js` から `import` をたどって読みこまれます。
  **ファイルを足したら、どこかで `import` してください**（たどれないファイルは使われません）。
* 使うものは、ファイルの先頭で `import { Model } from '../model/model.js';` のように受け取ります。

### 4 つの層

```
ui/js/
├── main.js        組み立て（各部品の init() を呼ぶ・まとめて描きなおす）
├── shortcuts.js   キーボード（いろいろな層を呼ぶので、組み立ての側）
├── panels/        画面   pages / tabs / run / stage / vars / search / chara / ghost / dialog / ssp / guide / language
├── editor/        キャンバスとパレット   render / drag / palette / scripts / zoom / contextmenu / picker / clipboard
├── core/          画面の土台   dom / api / toast / session / title / commands / events / theme
└── model/         データと規則（DOM を触らない）   blocks / model / lint / blockindex / player / sample / yaya
```

**import は上から下へだけ**向けます。同じ層の中どうしは構いませんが、**輪にしてはいけません**
（A が B を、B が A を import する形）。

| 層 | import してよい先 |
|---|---|
| `model/` | `model/` |
| `core/` | `core/` `model/` |
| `editor/` | `editor/` `core/` `model/` |
| `panels/` | `panels/` `editor/` `core/` `model/` |
| 直下（`main.js` `shortcuts.js`） | どこでも。ただし直下のファイルを import できるのは `main.js` だけ |

* **下の層から、上の層の操作を呼びたいとき**（ブロックの ▶ ボタンから「ためす」を動かす、など）は、
  `core/commands.js` の `Commands` を通します。ここに名前を足し、持ち主が `init()` の中で
  `provide({ … })` で中身を入れます。いまあるのは `runScript`（`panels/run.js`）と
  `promptNewVariable`（`panels/vars.js`）の 2 つだけです。**増やす前に、その関数を下の層へ
  動かせないかを先に考えてください。**
* **「何かが済んだ」ことを上の層に知らせたいとき**（お手本を開いた・▶ で動かした・書き出した →
  はじめてガイドの ✓）は、`core/events.js` の `Events.emit('名前')` を使います。受ける側が
  `Events.on('名前', fn)` で待ちます。`Commands` とちがって、知らせる側は受ける側がいるかどうかを気にしません。
  いまある名前は `sample-opened`・`ran`・`exported`・`installed` です。
* プロジェクトの中身（`ghost.json` になるもの）と、元にもどす・保存していない印は
  `model/model.js` の `Model` が持ちます。変えるときは `Model.act(() => { … })` を通すと、
  元にもどす記録と描きなおしがついてきます。
* 保存しない「いまの画面の状態」（ズーム・ためすときの変数・コピーしたブロックなど）は
  `core/session.js` の `Session` に置きます。
* 部品は `{ init, render, … }` の形の 1 つのものを export します。ボタンをつなぐのは
  その部品自身の `init()` で、`main.js` は順に呼ぶだけです。描きなおしは、`Model` が
  変わるたびに `main.js` の `renderAll()` が各部品の `render()` を呼びます。
* **画面（`.page`）は 1 つだけ見せます**（`panels/pages.js`。トーク・キャラと絵・ゴースト情報・書き出し・ヘルプ）。
  `renderAll()` が描きなおすのは、いつも見えているもの（上のバーとチェックの数）と、**いま見えている画面だけ**です。
  画面を切りかえたら `Pages.onShow` でその画面を描きます。新しい画面を足すときは、`index.html` に
  `<div class="page" data-page="…">` を、`#mode-bar` にボタンを、`renderAll()` の `switch` に描く部品を足します。
* 画面の部品は、プロジェクトを `Model.act` / `Model.pushUndo` で変えるだけにして、自分で描きなおさないでください
  （見えていれば `renderAll()` が描きなおします。2 回描くと、打ちかけの欄がとぶことがあります）。
* キャンバスは描きなおすたびに作りなおすので、えらんでいたブロックの見た目も新しくなります。
  `renderAll()` は描いたあとに `Drag.reselect()` を呼び、同じブロックの新しい見た目をえらびなおします
  （`/` で続けて置いていけるのは、これがあるためです）。
* `model/` は DOM を触らないので、node のテスト（`ui\test\editor.js`）からそのまま使えます。

### 画面の言葉（日本語・英語）

* **画面に出す文は、すべて `t('日本語の文')` を通します**（`ui/js/i18n/i18n.js`）。日本語の文そのものが鍵です。
  値を入れるときは、文をつなぎあわせず `t('「{name}」を保存しました', { name })` のように 1 つの文にします
  （英語では語順が変わるため）。ブロックの文の `%who` のような欄も、そのまま鍵に入れておきます。
* 英語は `ui/js/i18n/en.js` に `'日本語の文': 'English'` の形で書きます。**画面の文には、すべて訳が要ります**
  （訳の無い文があると `ui\test\i18n.js` が止めます。`node ui\test\i18n.js --missing` で、訳の無い文を en.js の形で出せます）。
  **日本語の文を書きかえたら、en.js の鍵も同じ文に直してください**（古い訳も止めます）。
* 同じ日本語の文には、訳は 1 つだけです。場所によって英語を変えたいとき（見出しの「Surfaces」と欄の「surface #」など）は、
  日本語の文のほうを分けます（「立ち絵」と「立ち絵の番号」）。
* `index.html` の文は、`<b>` などではさまれた切れはしごとに訳します。切れはしの前に HTML の空白があると、その空白は残るので、
  そこの訳を「,」や「;」で始めないでください（「/ , search」のようになります）。
* `t()` には文字そのものを渡します（変数を渡すと、どの文が使われているか点検できません）。
* 画面に出さない日本語（作る人むけのエラーなど）は、その行に `// i18n-ignore` と書きます。
* `index.html` に直に書いた文と `title` などは、そのままで構いません。起動したときに `translateDom()` が置きかえます
  （改行と字下げは 1 つの空白にまとめて辞書を引きます）。
* 言語は起動したときに 1 度だけ決まります（設定 `ikaga.lang` → Windows の表示言語）。`setLang()` は画面を読みなおします。
  そのため、ブロックの定義のようにファイルの外側で作る文も `t()` で書けます。
* `ui/js/i18n/` は、いちばん下の層です（どこからでも import でき、ほかを import しません）。
  node のテストは、`globalThis.IKAGA_LANG = 'ja'` で日本語に決めうちしています（node の言語は en-US のため）。
* 上のバーの「English」／「日本語」（`panels/language.js`）で切りかえると、画面を読みなおします。開いているプロジェクトは
  （保存していない変更も、見ていた画面も）`sessionStorage` にあずけて、読みなおしたあとの起動（`main.js` の `boot`）で受けとります。
  元にもどす記録は引きつぎません。
* **exe が自分で出す言葉**（メッセージボックス・ファイルをえらぶ窓・書き出す readme.txt など）は、`studio/src/lang.h` の
  `Tr("日本語", "English")` で書きます。exe の言語は、起動したときに設定（`ukagaka-studio.json` の `lang`）→ Windows の表示言語で決まり、
  画面が読みこまれると `main.js` が `lang:ja` / `lang:en` を送って合わせます（exe は設定にも覚えます）。
  メッセージボックスのボタン（はい・いいえ）は Windows の言語のままです。
* **`/api/*` のエラーは、exe では訳しません。** `JsonError(res, 400, "bad_json")` のようにコードで返し、
  画面が `ui/js/core/api.js` の `ERRORS` で文にします（補足は `detail` で）。エラーを足したら `ERRORS` にも足してください。
  足し忘れは `ui\test\i18n.js` が止めます。
* **ゴーストの言語は、画面の言語とは別**で、プロジェクトの `meta.lang`（`"ja"` / `"en"`）に持ちます（ゴースト情報の「ゴーストの言語」）。
  新しいゴーストとお手本は、作ったときの画面の言語になります。無いもの（前からあるプロジェクト）は日本語です。
  `Model.normalize` は、ここを画面の言語で埋めません（日本語で作ったゴーストが、英語の画面で開いただけで英語にならないように）。
* ゴーストの言語が英語なら、書き出すもの（readme.txt・名前が空のときの名前 New Ghost・Sakura・Kero・バルーンの名前）が英語になり、
  `ghost.json` の `meta.lang` が `"en"` になります（日本語のときは書かないので、前と同じ中身のままです）。
  栞はそれを見て、自分で言う決まり文句（`shiori.cpp`）と、「いまごろ」「季節」「曜日の名前」の値（`interp.cpp`。
  `朝` → `morning` など）を英語にします。値はゴーストの中で比べるものなので、ゴーストの言語で決まり、画面の言語では変わりません。
  「ためす」も同じ栞の仕組みで動くので、同じ値になります。
* **お手本は言語ごと**です。英語のお手本は `ui/samples/en/`（日本語と同じ数。`ui\test\editor.js` が数とゴーストの言語を見ます）、
  はじめて起動したときに置くサンプルは `studio/res/sample-project.json` と `sample-project.en.json` です
  （exe の言語が英語なら英語のほう。`Api::PlaceFirstRunSample`）。お手本の置き場所は、その言語の画面で「整列」をかけて決めています。
  「新規」のひな形（`model/sample.js`）は、どちらの言語でも同じ置き場所なので、両方の言語で重ならないかを確かめてください。

### 色（明るい表示と暗い表示）

* **色は `ui/style.css` の `:root` にあるトークンだけを使います**（`var(--surface)` `var(--text-muted)` など）。
  各トークンは `light-dark(明るいとき, 暗いとき)` の形で、両方の色をそこに書きます。
  新しい色が要るときは、まず似たトークンが無いかを見て、無ければ `:root` に足します。
* 直に書いてよいのは、ブロックの上に重ねる白と黒の半透明（`#fff`・`rgba(0,0,0,…)`・`rgba(255,255,255,…)`）だけです。
  それ以外を直に書くと、暗い表示のときにそこだけ明るいまま残ります（`ui\test\modules.js` が止めます）。
* JS から色を付けるときも `var(--danger)` のようにトークンを使います。ブロックのカテゴリの色は `--cat-<id>` です。
* どちらの表示にするかは `core/theme.js` が `html` の `data-theme` で決めます（無ければ Windows の設定に合わせる）。
  exe にも `theme:dark` / `theme:light` を送って、タイトルバーの色をそろえています（`studio/src/main.cpp`）。

### よそから持ってきたもの（`third_party/`）

* `third_party/` には、YAYA の公式ビルド（`yaya/`）とシステム辞書 `yaya_base`（`yaya-dic/`）を、
  **配られたときのバイトのまま**入れています（`.gitattributes` で改行も書きかえません）。**手を入れないでください。**
* 版を上げるときは、まるごと差しかえて、`third_party/README.md` の版・日付・SHA-256 を書きかえます。
  `shiori\test\yaya\yaya.js` が、`yaya.dll` がその SHA-256 と同じかを見ます。
* YAYA はソースからは組みません。いまの Visual Studio で組むと、Windows 2000 に無い API が入るためです（`docs/roadmap.md` の 3-0）。
* exe に `yaya.dll` を埋めこんでいるので、配布用の zip には YAYA のライセンスの本文を入れています（`build.ps1` の `-Release`）。

### YAYA の辞書（段階 3）

ブロックは `ui/js/model/yaya.js` が YAYA の辞書（`studio_program.dic`）に訳し、決まった部分は
`studio/res/yaya/studio_runtime.dic` の `Studio.〜` にあります。YAYA の辞書を書くときの落とし穴:

* **`_変数` は `{ }` の中で作ると、外から見えません。** `if` の中で入れて外で使うなら、先に `_r = ''` のように作っておきます。
* **関数の中に式だけの行が 2 つあると、YAYA はどちらかをランダムに返します。** 答えを返す関数は、通る道ごとに
  式の行を 1 つだけにして、すぐ `return` します。何も返さない関数には `: void` を付けます。
* **数の書きかた `1e20` は読めません**（0 になります）。大きな数は `TOREAL('1e20')` と書きます（`yaya.js` の `yayaNum`）。
* **`#globaldefine` の名前は、文字列の中でも置きかえられます。** 人の書いた文は `yayaStr` を通して書きます
  （名前の途中で文字列を分けます。名前の一覧 `YAYA_DEFINES` は、yaya_base とそろっているかをテストが見ます）。
* **`reference[n]` は、数に見える文字を数に変えてしまいます**（`007` → 7）。文字のまま使うときは `reference.raw[n]`。
* 小数を `+` で文字につなぐと `3.500000` になります。文字にするときは `Studio.S`（如何栞と同じ書きかた）を通します。

### 文書（日本語と英語）

* `README.md` と `docs/` の文書には、英語版があります（`README.en.md`、`docs/en/`）。**日本語版が正**で、
  英語版の先頭には「日本語版が正です」と書いてあります。ライセンス（`LICENSE`）は元の作者のものなので訳しません
  （英語の参考訳は `LICENSE` の中に元からあります）。`CHANGELOG.md` は日本語だけです。
* **日本語の文書を直したら、英語版も直してください。** 文書を足したら英語版も足します
  （`docs/` の文書に英語版が無い・先頭の一文が無いと、`ui\test\i18n.js` が止めます）。
* ブロック一覧は、英語版（`docs/en/blocks.md`）にもすべてのブロックがあるかを `tools\check-blocks.js` が見ます。
* 英語版の中のリンクは、1 つ深いところ（`docs/en/`）からのものです。日本語版へのリンクは `../`、
  README は `../../README.en.md` です。

### キーボードと右クリック

* ショートカットは `ui/js/shortcuts.js` にまとめてあります。**足したら、ヘルプの画面の表**
  （`index.html` の「キーボードとマウス」）**にも足してください。** 文字を打っている欄の中では、
  `Ctrl+S` などの一部を除いて動きません。ブロックの操作は、トークの画面が見えているときだけです。
* 右クリックのメニューは `editor/contextmenu.js` です。項目に `key: 'Ctrl+C'` のように書くと、右にキーが出ます。
* ブロックのコピー・切り取り・はりつけ・複製・削除は `editor/clipboard.js` にあり、メニューとキーの両方がそれを呼びます。
  片方だけ直すと、メニューとキーで動きがずれるので、ここを直してください。

### そのほか

* 画面の外から触れるのは、`main.js` が `window.IKAGA` に載せたものだけです。
  exe（`studio/src/main.cpp`）が、閉じるときに `IKAGA.Model.dirty` と
  `IKAGA.Dialog.requestSaveAndClose()` を呼びます。名前を変えたら、そちらも直してください。
* `ui/js/package.json`（`"type": "module"`）は、node のテストがここを ES モジュールとして
  読むための印です。exe には入れていません（`studio/tools/embed.ps1`）。

`node ui\test\modules.js` が、この決まりを守れているかを見ます。
層の向きがちがう import と、輪になった import を、ファイルと行を名指しして止めます。
ほかに、ファイルを 1 つずつ「最初に読みこむもの」にして別々に読みこみ、落ちないかも見ます。

node のテストは ES モジュールを `require()` で読むので、**Node.js 22.12 以降**が要ります
（Actions は 24 を使っています）。

---

## スタジオ側（`studio/src/`）の決まりごと

**`/api/…` を 1 つ足すとき**は 3 か所です。

1. `api.h` の `Api` に、`void Xxx(const HttpRequest& req, HttpResponse& res);` を書く
   （用事ごとにまとめてあるので、近いもののところへ）。
2. 中身を、近い用事の `api_*.cpp` に書く。返すのは `Json(res, 200, o)`、
   失敗は `JsonError(res, 400, "コード")`（どちらも `api_util.h`）。エラーは文ではなくコード（`bad_json` など）で返し、
   新しいコードなら `ui/js/core/api.js` の `ERRORS` に画面の文を足します。
3. `api.cpp` の **`kRoutes`** に `{ "POST", "/api/…", &Api::Xxx }` を 1 行足す。

よそのページからの要求を断る確かめは、`kRoutes` を引く前に `Api::HandleApi` が 1 か所でしています。
`api_*.cpp` の中でもう一度する必要はありません。

**書き出すファイルを足す・変えるとき**は、`exporter.cpp` の `BuildGhostFiles` が一覧の組み立て役で、
中身はファイルの種類ごとに `export_*.cpp` にあります（`exporter.cpp` の先頭に一覧があります）。
`export_*.cpp` どうしで使うものは `export_parts.h` に、ほかからも使うものは `exporter.h` に書きます。
書き出しテスト（`studio\test\export.js`）がバイトで見くらべているので、中身を変えたときは
目で確かめてから `--update` で期待値を作りなおしてください。

**exe が自分で見せる文**（メッセージボックスなど）は、`Tr("日本語", "English")`（`lang.h`）で両方を書きます。

**`.cpp` を足したら、`studio\build.ps1` の一覧にも足します**（`$apiSources` / `$exportSources`。
書き出しまわりは、書き出しテスト用コンソールにも同じ一覧が入ります）。

---

## 栞は、C ランタイムを使わずに組んでいます

SSP は **Windows 2000 以降**で動きます。栞は SSP に読みこまれる DLL なので、そこに合わせます。

ところが Visual Studio の C ランタイムをふつうに静的リンク（`/MT`）すると、**自分では
一度も呼んでいないのに** `FlsAlloc` や `InitializeCriticalSectionEx`（どちらも Vista から）
といった API が輸入表に載ります。輸入表は**読みこみのときに全部そろっている必要がある**ので、
古い Windows では **DLL を開くことすらできません**。手元が Windows 11 だと当然動くので、
ソースを読んでも気づけません。

そこで栞は、

* `/NODEFAULTLIB` で CRT を丸ごと外し、
* **Windows に最初から入っている `msvcrt.dll`** につなぎ（`shiori/src/msvcrt.def`）、
* それでも足りない Visual Studio 独自のものだけを `shiori/src/tinycrt.cpp` で用意する

という組みかたにしてあります。`strtod` や `sprintf` のような「自分で書くと間違えるもの」は
借りものの本物です。`ikaga.dll` は 268KB から 134KB になりました。

**ねらいどおりかは `node tools\check-imports.js` が見ます。** 出来あがった PE の輸入表を
直に読んで、Windows 2000 に無い API が混ざっていたら名指しで止めます。
`.\build.ps1 -Test` にも入っています。

### ここを触るときの注意

* **`shiori/src/msvcrt.def` は ASCII だけで書いてください。** `lib.exe` は `.def` を
  ANSI コードページで読むので、日本語のコメントを入れると**次の行を巻きこんで消します**
  （実際に `memcpy` と `strlen` が黙って落ちました）。
* 借りる関数を足すときは、**Windows 2000 の `msvcrt.dll` にもあるか**確かめてください。
* 例外は投げません。投げるはずの場面（メモリ不足・長さ超過）は、その場で終わります。
  栞は 32KB で頭打ちにしてあるので、ふつうは起きません。
* `<random>` や 64bit 整数と小数の行き来は、CRT にしか無い関数を呼びます。
  避けかたは `util.cpp` の `NumToStr` と乱数のところにコメントで書いてあります。
* **伺かスタジオ（64bit）はふつうの CRT のままです。** 同じ `.cpp` を両方で組んでいますが、
  `tinycrt.cpp` をリンクするのは栞だけです。一致テストが、両方で同じ答えになることを見ています。

---

## ロゴとマスコット

**ロゴ**は `ui/img/logo.svg` の 1 枚だけです。上のバー・タブのアイコンはこれをそのまま使います。
exe のアイコン（`studio/res/ukagaka-studio.ico`）は、描きかえたら作りなおしてください。

```powershell
node studio\tools\make-icon.mjs     # Windows の Edge で 16〜256px に描いて .ico にまとめる
.\build.ps1                         # exe に入れなおす
```

ビルドのたびには走らせません（できあがった .ico をリポジトリに入れておきます）。

**マスコット**（本体「いかがちゃん」・相方「しおり」。英語では Ikaga・Shiori）の名前は、お手本の中身にそのまま書いてあります。
名前を変えるときに書きかえるのは、次のファイルです。

| ファイル | 書いてあるところ |
|---|---|
| `ui/samples/*.json`（5 つ）・`ui/samples/en/*.json`（英語の 5 つ） | `meta.sakuraName` / `meta.keroName`、あいさつのお手本はセリフにも |
| `studio/res/sample-project.json`・`sample-project.en.json` | はじめて起動したときのサンプル。`meta` とセリフ |
| `studio/src/api.cpp` | はじめて起動したときに置くファイル名（`いかがちゃん.json`・`Ikaga.json`） |
| `docs/ghost-json.md`・`README.md`（と英語版） | 例として |

「新規」の既定の名前（**あたらしいゴースト**、英語では **New Ghost**）は、画面（`model.js`・`sample.js`・`title.js`・`index.html`。
英語は `en.js`）と、書き出しの `GhostName()`（`studio/src/exporter.cpp`）にあります。栞のテスト用ゴースト・書き出しテストの材料に
出てくる「なしこ」「つぶ」は、テストの材料なので変えていません。

---

## つまずきやすいところ

**スマートアプリコントロールが、作りたてのファイルを止める。**
`test_host.exe` や `ikaga.dll` や `ukagaka-studio.exe` が
「An Application Control policy has blocked this file」（エラー 4551）で
読み込めないことがあります。**もう一度ビルドすると通る**ことが多いです。
くわしくは README の「スマートアプリコントロールでブロックされたら」。

ウイルス対策（Defender）に見つかったのだと思いがちですが、**別のものです**。
止めているのはコード整合性（Code Integrity）で、Defender の検出履歴には何も残りません。
**どちらなのかは、この 2 つで分かります。**

```powershell
# 1=オン(強制) / 2=評価中 / 0=オフ
Get-ItemPropertyValue "HKLM:\SYSTEM\CurrentControlSet\Control\CI\Policy" VerifiedAndReputablePolicyState

# 止めた本人が、ファイル名つきで残っている（ID 3077 がブロック）
Get-WinEvent -FilterHashtable @{LogName="Microsoft-Windows-CodeIntegrity/Operational"; Id=3077} -MaxEvents 5 |
  Select-Object TimeCreated, Message
```

ここに `ikaga.dll` の名前が出ていれば、それが原因です。
Defender のほうを疑うなら `Get-MpThreatDetection`（何も出なければ、Defender は無関係）。

**`studio\test\expected\` は、バイトのまま見くらべています。**
`.gitattributes` で `-text` にして、git が改行を書きかえないようにしてあります。
期待値を作りなおしたあとに差分がおかしいときは `git add --renormalize` を試してください。

**テスト用の SAORI（`slow_saori.dll`）は `load` / `unload` を持っています。**
栞と同じ名前なので、中間ファイルを同じ場所に置くとリンクでぶつかります
（`obj\x86\testbuild\` に分けてあります）。

**`ukagaka-studio.exe` は画面つきです。** スクリプトから `& .\ukagaka-studio.exe` と書くと
戻ってきません。動きを確かめたいときは自分の手で起動してください。

**`ui/` を直したら exe を作りなおす。** ブラウザで `ui\index.html` を直接開くと
見た目は出ますが、保存・書き出し・「ためす」は動きません（どれも exe の中を呼んでいます）。

---

## 版を上げて配る

1. `VERSION`（ルートの 1 行）を直す。zip の名前と exe のプロパティは、ここだけを見ています。
2. `CHANGELOG.md` に、変わったことを足す。
3. `.\build.ps1 -Release` — きれいに作り直し、テストを通し、`dist\ukagaka-studio-<版>.zip` を作ります。
   （手元で見ておくためのものです。配るのは Actions が作ったほうです）
4. `git tag -a v<版> -m "…"` して `git push origin v<版>`。
5. **あとは Actions がやります。** タグを受けとると、ビルドしてテストを通し、
   その zip を貼った Release を**下書きで**作ります。
6. GitHub の Releases を開いて中身を見て、よければ **Publish release** を押す。
   押すまでは誰にも見えません。

> **なぜ下書きなのか。** タグを押した時点では、まだ取り下げたくなることがあるためです
> （`v1.0.4-beta` が実際そうなりました）。公開を 1 回押す手間だけ残してあります。
> 自動で公開したくなったら、`build.yml` の `--draft` を消してください。

配られるのは、**そのタグでテストを通ったものそのもの**です。手元でビルドし直した
別の zip を貼ることはありません。`v1.0.4-alpha` のように `-` が付いたタグは、
自動で「試し版（pre-release）」になります。

---

## 迷ったら

* ブロックの意味 → `docs/blocks.md`
* `ghost.json` の形 → `docs/ghost-json.md`
* つかいかた・フォルダ構成・栞のしくみ → `README.md`
* 改修の計画と、これまでに決めたこと → `docs/roadmap.md`
* 英語版 → `README.en.md`・`docs/en/`（日本語版が正）
* さくらスクリプトや SHIORI の仕様そのもの → UKADOC（伺か関連ドキュメント）
