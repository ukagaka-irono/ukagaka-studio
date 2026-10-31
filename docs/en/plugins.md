# Working with SSP plugins

日本語: [../plugins.md](../plugins.md)

> **This is the English translation of [docs/plugins.md](../plugins.md). The Japanese version is authoritative;**
> **if the two differ, follow the Japanese one.**

A quick reference for using the plugins listed under GitHub's
[ukagaka-plugin](https://github.com/topics/ukagaka-plugin) topic from a ghost made with Ukagaka Studio.

You only need two blocks:

* **Send event E to plugin P (with info …)** (Control) — from the ghost to the plugin.
  It becomes `\![raiseplugin,P,E,info…]`. P is the plugin's name or id.
  Separate info with `,` to pass as many values as you like (e.g. `set,100,pocket money`).
* **An event hat block** — from the plugin to the ghost. Look under “From plugins” in the event list.
  Read what arrived with “event info #n” (Info).

The user has to install the plugin in SSP. If it is not installed, sending to it does nothing.

Many plugins show their own line when the ghost returns nothing.
If the ghost talks under the hat block, the ghost's line is shown instead.

## Plugins you call and get an answer from

### GetWindowTitle (title of the front window)

[ambergon/ukagakaPlugin_getWindowTitle](https://github.com/ambergon/ukagakaPlugin_getWindowTitle)

| Send | plugin `GetWindowTitle`, event `OnGetWindowTitle`, no info |
|---|---|
| Comes back | “When the front window's title arrives” (`OnRecieveGetWindowTitle`, spelled as the plugin spells it)<br>#0 = window title (the ghost's name if the ghost itself is in front) |

### Wallet of Unyu

[nikolat/wallet_of_unyu](https://github.com/nikolat/wallet_of_unyu)

| Send | plugin `c58b6320-caf8-11ed-a901-0800200c9a66` (the id from the plugin's readme; the name `Wallet of Unyu` also works), event `OnWalletOfUnyu`, info is one of<br>`set,amount,message` (deposit; a negative amount withdraws) / `get` (ask the balance) / `menu` (open the wallet) |
|---|---|
| Comes back | “When the wallet answers” (`OnWalletOfUnyu`)<br>#0 = what was done (set / get / menu), #1 = balance |

### DBdiary

[ambergon/UkagakaPlugin_DBdiary](https://github.com/ambergon/UkagakaPlugin_DBdiary)

| Send | plugin `DBdiary` and one of these events |
|---|---|
| `OnCallInputBeautifulDiary` | info `line before,line after`. Shows an input box and appends what was written to today's diary |
| `OnCallInputDirtyDiary` | info `line before,line after`. Keeps what was written in the file name |
| `OnGetBeautifulDiary` | info `date (yyyymmdd),before,after,if not written,if missing`. Shows that day's diary |
| `OnCheckWrittenDiary` | no info. Today's diary comes back in the event below |
| Comes back | “When today's diary arrives” (`OnRecieveCheckWrittenDiary`)<br>#0 = today's diary (`notExist` = none / `notWrite` = not written) |

### ukaten (weather forecast)

[nikolat/ukaten](https://github.com/nikolat/ukaten). It uses Japan Meteorological Agency data; credit the JMA as the source when you use it.

| Send | plugin `うかてん` and one of these events. The answer comes back **as an event with the same name** |
|---|---|
| `OnGetWeatherInfo` | info `type,area code,key` (all may be empty)<br>type = `forecast` / `overview_forecast` / `overview_week`, area code = `130000` etc. (empty = the chosen area), key = `text` / `headlineText` / `reportDatetime` / `targetArea` etc.<br>→ “When weather info arrives” #0 = the requested info |
| `OnGetSavedArea` | no info → “When the chosen area arrives” #0 = area code, #1 = area name |
| `OnGetPluginVersion` | no info → “When the plugin version arrives” #0 = version (`ukaten/1.1` etc.) |

When ukaten shows the weather from its own menu, “When a plugin is about to talk” (`OnPluginExec`; its info is as in “Plugins that talk to the ghost on their own” below) arrives too.

### Stamp Collection

[YAYA-shiori/stampcollection](https://github.com/YAYA-shiori/stampcollection)

| Send | plugin `スタンプ帳` and one of these events |
|---|---|
| `OnStampAdd` | info `image path,title,comment`. The image is a 32×32 PNG; the path is from the ghost's folder (`ghost\master\stamp.png` etc.; no `..` and no leading `\`) |
| `OnMenuExec` | no info (or a ghost name). Opens the stamp book |
| `OnStampInfoCall` | no info. Asks for the event below right away |
| Comes back | “When the stamp book contents arrive” (`OnStampInfo`; also sent when a ghost boots and so on)<br>#0 = number of stamps, #1 = has own stamp (1 = yes), #2 = plugin folder, #3 = all stamps, #4 = running |

Ukagaka Studio cannot export the stamp image yet. Put it in the exported ghost's folder yourself.

### BalloonSelector

[nikolat/balloonselector](https://github.com/nikolat/balloonselector)

| Send | plugin `BalloonSelector`, event `OnMenuExec` (first page) or `OnBalloonSelectMenuOpen` (info = page, from 0) |
|---|---|
| Comes back | “When the balloon picker opens” (`OnBalloonSelectMenu`) #0 = page<br>“When a balloon is picked” (`OnBalloonSelectExec`) #0 = balloon name<br>“When the balloon picker closes without a pick” (`OnBalloonSelectCancel`) |

### UkagakaGhostMessenger

[lost-nd-xxx/UkagakaGhostMessenger](https://github.com/lost-nd-xxx/UkagakaGhostMessenger).
Replace characters such as `/` in ghost names with `_`. The full rules are in the plugin's wiki (Specification).

| Send | plugin `UkagakaGhostMessenger` and one of these events |
|---|---|
| `OnUkagakaGhostMessenger_Send` | info is a list of `--Name=value`, e.g. `--MessageId=…,--Text=…,--Condition=…` (any order; `MessageId` is required) |
| `OnUkagakaGhostMessenger_Trigger` | info `trigger ID,ghost,sender ID` |
| `OnUkagakaGhostMessenger_Request` | info `ghost,sender ID,message ID` |
| `OnUkagakaGhostMessenger_Cancel` | info `sender ID` |
| Comes back | “When a message is delivered” (`_Ringing`), “When a message status arrives” (`_Response`),<br>“When a message is scheduled” (`_SendComplete`), “When scheduling a message fails” (`_SendFailure`) |

A `,` inside `Text` would split the info; use another character instead.

## Plugins that talk to the ghost on their own

There is nothing to send. Put a hat block and the ghost can talk instead of the plugin's line.

| Plugin | Hat block | Info |
|---|---|---|
| [nostryu](https://github.com/nikolat/nostryu) | “When a Nostr post arrives” (`OnNostr`) | 0 = `Nostr/0.3`, 1 = kind (note), 2 = post text, 3 = name, 4 = display name, 5 = icon URL |
| [ukadonyu](https://github.com/nikolat/ukadonyu) | “When a notice arrives (ukadonyu)” (`OnukadonyuSSTP`), “When a plugin is about to talk” (`OnPluginExec`) | `OnPluginExec`: 0 = `Version=…`, 1 = `From=plugin name`, 2 = `Script=…`, 3 = `Event=…` |
| [sudohaikuyu](https://github.com/nikolat/sudohaikuyu) | “When a notice arrives (sudohaikuyu)” (`OnsudohaikuyuSSTP`), `OnPluginExec` | same as above |
| [CharameLNetwork](https://github.com/nikolat/CharameLNetwork) | “When the timeline opens” (`OnCharameLNetwork`) | none |

ukadonyu and sudohaikuyu can also run their internal functions through `OnUkadonyuAPI` / `OnSudohaikuyuAPI` (info = `function name,arguments…`).

CharameLNetwork reads `ghost\master\CharameL.txt` in the ghost's folder. Ukagaka Studio cannot make this file yet.

## Plugins that need nothing from the ghost

Install them and they work with Ukagaka Studio ghosts as they are.

| Plugin | What it does |
|---|---|
| [Bouyomi](https://github.com/apxxxxxxe/Bouyomi) | reads the ghost's lines aloud with BouyomiChan |
| [CeVIO-Talker](https://github.com/ambergon/ukagakaPlugin_CeVIO-Talker), [CeVIO-TalkerV2](https://github.com/ambergon/ukagakaPlugin_CeVIO-TalkerV2) | reads the ghost's lines aloud with CeVIO AI |
| [A.I.VOICE送信](https://github.com/opera7133/SSP-AIVOICE) | reads the ghost's lines aloud with A.I.VOICE |
| [TMIDI Messages](https://github.com/JiayuYangX/tmidi_msg) | makes the ghost announce the TMIDI Player song title |
| [CD Player](https://github.com/tyvy14/CD-Player_Plugin) | plays a CD from the plugin's menu |

The speech plugins pick a voice by the ghost's menu name (`name` in `descript.txt`).

## Not in the list

* [kagari_as_plugin](https://github.com/Tatakinov/kagari_as_plugin) — a template **for making** plugins; it has no events for ghosts.
* [ghost-messenger](https://github.com/arsuren/ghost-messenger) — not an ukagaka plugin (it is an Android app).
  Its download links point at files that are not in the repository, which looks suspicious; do not download them.
