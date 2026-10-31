# SSP のプラグインと組む

English: [en/plugins.md](en/plugins.md)（英語版。こちらの日本語版が正です）

GitHub の [ukagaka-plugin](https://github.com/topics/ukagaka-plugin) にあるプラグインを、
伺かスタジオで作ったゴーストから使うための早見表です。

使うブロックは 2 つだけです。

* **プラグイン P にイベント E を伝える（情報 … を付ける）**（制御）— ゴーストからプラグインへ。
  `\![raiseplugin,P,E,情報…]` になります。P はプラグイン名か id です。
  情報は `,` で区切ると、いくつでも付けられます（例: `set,100,おこづかい`）。
* **イベントの帽子ブロック** — プラグインからゴーストへ。イベントの一覧の「プラグインから」にあります。
  届いた中身は「イベントの情報 ◯番目」（情報）で読めます。

プラグインは、使う人が SSP に入れておく必要があります。入っていないと、伝えても何も起きません。

多くのプラグインは、ゴーストが何も返さないと、プラグインが用意したセリフを出します。
帽子ブロックの下で話すと、そのセリフのかわりに、ゴーストのセリフが出ます。

## ゴーストから呼んで、答えを受けとるもの

### GetWindowTitle（いちばん前のウィンドウの名前）

[ambergon/ukagakaPlugin_getWindowTitle](https://github.com/ambergon/ukagakaPlugin_getWindowTitle)

| 伝える | プラグイン `GetWindowTitle`・イベント `OnGetWindowTitle`・情報なし |
|---|---|
| 返ってくる | 「いちばん前のウィンドウの名前がとどいたとき」（`OnRecieveGetWindowTitle`。綴りはプラグインのまま）<br>0番目＝ウィンドウの名前（ゴースト自身が前にあれば、ゴーストの名前） |

### Wallet of Unyu（うにゅうの財布）

[nikolat/wallet_of_unyu](https://github.com/nikolat/wallet_of_unyu)

| 伝える | プラグイン `c58b6320-caf8-11ed-a901-0800200c9a66`（プラグインの説明にある id。名前 `Wallet of Unyu` でも）・イベント `OnWalletOfUnyu`・情報は次のどれか<br>`set,金額,ひとこと`（入れる。出すときは金額をマイナスに）／`get`（残高を聞く）／`menu`（財布を開く） |
|---|---|
| 返ってくる | 「財布から答えがとどいたとき」（`OnWalletOfUnyu`）<br>0番目＝したこと（set / get / menu）、1番目＝残高 |

### DBdiary（日記）

[ambergon/UkagakaPlugin_DBdiary](https://github.com/ambergon/UkagakaPlugin_DBdiary)

| 伝える | プラグイン `DBdiary` と、次のイベント |
|---|---|
| `OnCallInputBeautifulDiary` | 情報 `前のセリフ,後のセリフ`。入力ボックスを出し、書いたものを今日の日記に足す |
| `OnCallInputDirtyDiary` | 情報 `前のセリフ,後のセリフ`。書いたものをファイル名に入れて残す |
| `OnGetBeautifulDiary` | 情報 `日付(yyyymmdd),前,後,書いていないとき,無いとき`。その日の日記を見せる |
| `OnCheckWrittenDiary` | 情報なし。下のイベントで今日の日記が返ってくる |
| 返ってくる | 「今日の日記がとどいたとき」（`OnRecieveCheckWrittenDiary`）<br>0番目＝今日の日記（`notExist`＝無い / `notWrite`＝書いていない） |

### うかてん（天気予報）

[nikolat/ukaten](https://github.com/nikolat/ukaten)。気象庁のデータを使うので、使うときは出典として気象庁の名前を出してください。

| 伝える | プラグイン `うかてん` と、次のイベント。答えは**同じ名前のイベント**で返ってきます |
|---|---|
| `OnGetWeatherInfo` | 情報 `種類,地域の番号,項目`（どれも空でよい）<br>種類＝`forecast` / `overview_forecast` / `overview_week`、地域の番号＝`130000` など（空ならえらんである地域）、項目＝`text` / `headlineText` / `reportDatetime` / `targetArea` など<br>→「天気の情報がとどいたとき」0番目＝たずねた情報 |
| `OnGetSavedArea` | 情報なし →「えらんである地域がとどいたとき」0番目＝地域の番号、1番目＝地域の名前 |
| `OnGetPluginVersion` | 情報なし →「プラグインの版がとどいたとき」0番目＝版（`ukaten/1.1` など） |

うかてんのメニューから天気を出すときは、「プラグインが話そうとしたとき」（`OnPluginExec`。情報は下の「プラグインのほうから話しかけてくるもの」と同じ）も届きます。

### スタンプ帳

[YAYA-shiori/stampcollection](https://github.com/YAYA-shiori/stampcollection)

| 伝える | プラグイン `スタンプ帳` と、次のイベント |
|---|---|
| `OnStampAdd` | 情報 `画像の場所,題,ひとこと`。画像は 32×32 の PNG で、場所はゴーストのフォルダから（`ghost\master\stamp.png` など。`..` や先頭の `\` は使えません） |
| `OnMenuExec` | 情報なし（かゴーストの名前）。スタンプ帳を開く |
| `OnStampInfoCall` | 情報なし。下のイベントを、いますぐ送ってもらう |
| 返ってくる | 「スタンプ帳の中身がとどいたとき」（`OnStampInfo`。ゴーストの起動のときなどにも届く）<br>0番目＝スタンプの数、1番目＝自分のスタンプがあるか（1＝ある）、2番目＝プラグインの場所、3番目＝すべてのスタンプ、4番目＝動いているか |

スタンプの画像は、いまのところ伺かスタジオから書き出せません。書き出したゴーストのフォルダに、自分で置いてください。

### BalloonSelector（バルーンをえらぶ）

[nikolat/balloonselector](https://github.com/nikolat/balloonselector)

| 伝える | プラグイン `BalloonSelector`・イベント `OnMenuExec`（はじめのページ）か `OnBalloonSelectMenuOpen`（情報＝ページ。0 から） |
|---|---|
| 返ってくる | 「バルーンをえらぶ画面を出したとき」（`OnBalloonSelectMenu`）0番目＝ページ<br>「バルーンがえらばれたとき」（`OnBalloonSelectExec`）0番目＝バルーンの名前<br>「バルーンをえらばずに閉じたとき」（`OnBalloonSelectCancel`） |

### UkagakaGhostMessenger（メッセージ）

[lost-nd-xxx/UkagakaGhostMessenger](https://github.com/lost-nd-xxx/UkagakaGhostMessenger)。
ゴーストの名前に `/` などがあるときは `_` にして送ります。くわしい決まりはプラグインの wiki（Specification）にあります。

| 伝える | プラグイン `UkagakaGhostMessenger` と、次のイベント |
|---|---|
| `OnUkagakaGhostMessenger_Send` | 情報は `--MessageId=…,--Text=…,--Condition=…` のように `--名前=値` を並べる（順番は自由。`MessageId` は必ず） |
| `OnUkagakaGhostMessenger_Trigger` | 情報 `きっかけのID,ゴースト,送り手のID` |
| `OnUkagakaGhostMessenger_Request` | 情報 `ゴースト,送り手のID,メッセージID` |
| `OnUkagakaGhostMessenger_Cancel` | 情報 `送り手のID` |
| 返ってくる | 「メッセージが送られたとき」（`_Ringing`）、「メッセージのようすがとどいたとき」（`_Response`）、<br>「メッセージの予約ができたとき」（`_SendComplete`）、「メッセージの予約に失敗したとき」（`_SendFailure`） |

`Text` に `,` を入れたいときは `、` を使ってください（`,` は情報の区切りになります）。

## プラグインのほうから話しかけてくるもの

伝えるものはありません。帽子ブロックを置くと、プラグインのセリフのかわりに、ゴーストが話せます。

| プラグイン | 帽子ブロック | 情報 |
|---|---|---|
| [Nostrゅう](https://github.com/nikolat/nostryu) | 「Nostr の投稿がとどいたとき」（`OnNostr`） | 0＝`Nostr/0.3`、1＝種類（note）、2＝投稿の中身、3＝名前、4＝表示名、5＝アイコンの URL |
| [うかどんゅう](https://github.com/nikolat/ukadonyu) | 「お知らせがとどいたとき（うかどんゅう）」（`OnukadonyuSSTP`）、「プラグインが話そうとしたとき」（`OnPluginExec`） | `OnPluginExec` は 0＝`Version=…`、1＝`From=プラグイン名`、2＝`Script=…`、3＝`Event=…` |
| [すどはいくゅう](https://github.com/nikolat/sudohaikuyu) | 「お知らせがとどいたとき（すどはいくゅう）」（`OnsudohaikuyuSSTP`）、`OnPluginExec` | 同上 |
| [CharameLNetwork](https://github.com/nikolat/CharameLNetwork) | 「タイムラインを開いたとき」（`OnCharameLNetwork`） | なし |

うかどんゅう・すどはいくゅうは、`OnUkadonyuAPI`・`OnSudohaikuyuAPI` で中の関数を呼ぶこともできます（情報＝`関数の名前,引数…`）。

CharameLNetwork は、ゴーストのフォルダの `ghost\master\CharameL.txt` を読みます。このファイルは、いまのところ伺かスタジオでは作れません。

## ゴーストの側では何もしなくてよいもの

入れるだけで、伺かスタジオのゴーストでもそのまま動きます。

| プラグイン | すること |
|---|---|
| [Bouyomi](https://github.com/apxxxxxxe/Bouyomi) | セリフを棒読みちゃんで読み上げる |
| [CeVIO-Talker](https://github.com/ambergon/ukagakaPlugin_CeVIO-Talker)・[CeVIO-TalkerV2](https://github.com/ambergon/ukagakaPlugin_CeVIO-TalkerV2) | セリフを CeVIO AI で読み上げる |
| [A.I.VOICE送信](https://github.com/opera7133/SSP-AIVOICE) | セリフを A.I.VOICE で読み上げる |
| [TMIDI Messages](https://github.com/JiayuYangX/tmidi_msg) | TMIDI Player の曲名をゴーストに言わせる |
| [CD Player](https://github.com/tyvy14/CD-Player_Plugin) | プラグインのメニューから CD をかける |

読み上げのプラグインは、ゴーストのメニューの名前（`descript.txt` の `name`）で声を分けます。

## 一覧に入れていないもの

* [kagari_as_plugin](https://github.com/Tatakinov/kagari_as_plugin) — プラグインを**作るため**のひな形で、ゴーストに向けたイベントはありません。
* [ghost-messenger](https://github.com/arsuren/ghost-messenger) — 伺かのプラグインではありません（Android のアプリです）。
  ダウンロードのリンクがリポジトリに無いファイルを指していて、あやしいので落とさないでください。
