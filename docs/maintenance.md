# 手入れの手引き

しばらく触っていないこのリポジトリに戻ってきたとき用の覚え書きです。
「どこに何があるか」は README の**フォルダ構成**にあります。
ここに書くのは、**書いてある場所が離れていて、片方だけ直すと静かに壊れる決まり**のほうです。

---

## まず、これを走らせる

```powershell
node tools\check-blocks.js     # 1 秒。ビルド不要。ブロックがそろっているか
.\build.ps1 -Test              # 3 分ほど。ビルドしてテスト 7 本
```

`check-blocks.js` はビルドが要らないので、**手を入れたら、まずこれ**です。
`build.ps1 -Test` の中でも、ビルドより先に走ります（書き忘れが 2 分待たずに分かります）。

---

## ブロックを動かすのは、いつも栞です

**規則は `shiori/src/interp.cpp` の 1 か所にしかありません。**

| どこで動くか | 誰が動かすか |
|---|---|
| SSP に入れたゴースト | `ikaga.dll`（32bit）の `interp.cpp` |
| エディタの「ためす」 | `ukagaka-studio.exe`（64bit）に積んだ **同じ** `interp.cpp` |

画面（`ui/js/`）はブロックを解釈しません。`POST /api/preview` に頼んで、
返ってきたさくらスクリプトを `ui/js/player.js` が再生するだけです。

> むかしは `ui/js/sim.js` に同じ規則を JavaScript でもう一度書いていました。
> 片方だけ直すと、エディタでは思ったとおりなのに SSP では違う、という形で
> あとから分かる、いちばん厄介なズレかたをしました。474 行を消してあります。

そのかわり **32bit と 64bit で同じものを組む**ことになったので、一致テストは
その 2 つを見くらべます。`int` と `size_t` の大きさに頼った書きかたをすると、
そこで止まります。

`interp.cpp` は SAORI の DLL の読みかたを知りません（`saori.h` の `SaoriHost` で
一枚はさんであります）。おかげでスタジオは `saori.cpp` を持たずに解釈部だけを使えます。
プレビューは SAORI を呼ばないので、そこに `NULL` を渡しています。

---

## ブロックを 1 つ足す

順番に、4 か所です。`node tools\check-blocks.js` が、抜けたところを名指しで教えます。

1. **`ui/js/blocks.js`** — `def({ type: '…', cat: '…', shape: '…', spec: '…', args: {…} })`。
   見た目と `ghost.json` の形が決まります。そして `PALETTE` の、置きたいカテゴリに
   名前を足します（足さないと、定義してもパレットに並びません）。
2. **`shiori/src/interp.cpp`** — `RunBlock` に `if (type == "…")`。**ここだけが動かす側です。**
   文字を出すときは直に足さず、**`Emit(ctx, …)`** を通してください（長さの上限がかかります）。
3. **`docs/blocks.md`** — 表に 1 行。`{"type":"…"}` の形と、出るさくらスクリプトを書きます。
4. **`shiori/test/parity/ghost.json`** — `OnP**` の帽子で 1 つ。`id` も付けてください。
   **毎回おなじ結果になる形**にしてください（乱数や時計を使うと、毎回ちがう答えになります）。

「空だと困る欄」があるブロックなら、**`ui/js/lint.js`**（チェックタブ）にも足します。

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

## テスト 7 本と、それぞれが守っているもの

| 走らせかた | 守っているもの |
|---|---|
| `node tools\check-blocks.js` | ブロックが 4 か所にそろっているか（書き忘れ探し） |
| `node shiori\test\parity\parity.js` | 同じ `interp.cpp` を 32bit と 64bit で組んで、出力が同じか（ビット幅に頼った書きかたを見つける） |
| `node shiori\test\behavior\behavior.js` | 栞**だけ**が持っている判断（どれを選ぶか・既定の反応・間引き・通信・SAORI） |
| `node studio\test\export.js` | 書き出したファイルの中身（バイトで見くらべ） |
| `node ui\test\editor.js` | 読みこみの整形（`model.js`）とチェックタブ（`lint.js`） |
| `node ui\test\modules.js` | `ui\js\*.js` が `main.js` からたどれて、どれを最初に読んでも落ちず、`Xxx.yyy()` の呼び先がそろっているか |
| `node tools\check-imports.js` | `ikaga.dll` が Windows 2000 から読みこめるか（輸入表を直に読む） |

`parity` と `behavior` は `shiori\dist\test_host.exe` を、`parity` はさらに
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
| `ukagaka-studio-<版>-<sha>` | 配る zip とまったく同じ（`ukagaka-studio.exe` / `README.md` / `CHANGELOG.md` / `LICENSE` / `docs`） |
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
* 使うものは、ファイルの先頭で `import { Model } from './model.js';` のように受け取ります。
  読みこみ順を気にする必要はありません。
* **`app.js` と、`render.js` / `drag.js` / `shell.js` / `search.js` / `dialog.js` / `ssp.js` は、
  おたがいに import しあっています。** どちらが先に読まれても動くように、
  * 相手のものは**関数の中でだけ**使ってください。ファイルのいちばん外で
    `App.xxx = …` や `const api = App.api;` と書くと、読みこみの時点で落ちます。
  * `app.js` からほかのファイルへ渡す関数は、**`function` で書いて**、`app.js` の終わりの
    `export { … }` に足してください。`function` で書いた関数は読みこみ順にかかわらず
    最初から呼べますが、`const f = () => …` は呼べません。
  * ここは段階 1-2（`app.js` を分ける）で、おたがいに import しない形に直す予定です
    （`docs/roadmap.md`）。
* 画面の外から触れるのは、`main.js` が `window.IKAGA` に載せたものだけです。
  exe（`studio/src/main.cpp`）が、閉じるときに `IKAGA.Model.dirty` と
  `IKAGA.Dialog.requestSaveAndClose()` を呼びます。名前を変えたら、そちらも直してください。
* `ui/js/package.json`（`"type": "module"`）は、node のテストがここを ES モジュールとして
  読むための印です。exe には入れていません（`studio/tools/embed.ps1`）。

`node ui\test\modules.js` が、この決まりを守れているかを見ます。
ファイルを 1 つずつ「最初に読みこむもの」にして別々に読みこむので、
おたがいに import しあうところの読みこみ順の問題も、ファイルと行を名指しして止めます。

node のテストは ES モジュールを `require()` で読むので、**Node.js 22.12 以降**が要ります
（Actions は 24 を使っています）。

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
* さくらスクリプトや SHIORI の仕様そのもの → UKADOC（伺か関連ドキュメント）
