# The ghost.json specification

日本語: [../ghost-json.md](../ghost-json.md)

> **This is the English translation of [docs/ghost-json.md](../ghost-json.md). The Japanese version is authoritative;**
> **if the two differ, follow the Japanese one.**

The format of Ukagaka Studio projects (`projects\*.json`) and of `ghost/master/ghost.json` in exported ghosts.

Exported ghosts run on the **YAYA** SHIORI. Ukagaka Studio translates the blocks into a YAYA dictionary (`studio_program.dic`),
and the runtime dictionary (`studio_runtime.dic`) handles the fixed behavior. `ghost.json` is **a copy of the original blocks**
(it is there so “Open” in Ukagaka Studio can load it). **YAYA does not read `ghost.json`**:
editing it by hand changes nothing in the ghost until you open it in Ukagaka Studio and export again.

The encoding is **UTF-8** (with or without a BOM). Ukagaka Studio also converts files written in Shift_JIS
automatically. `//` and `/* */` comments are skipped.

## Overall shape

```jsonc
{
  "format": "ikaga/1",

  "meta": {
    "name": "Ikaga",               // ghost name
    "sakuraName": "Ikaga",         // main character's name
    "keroName": "Shiori",          // partner's name
    "craftman": "author name",
    "craftmanUrl": "",
    "homeUrl": "",                 // where network updates live (homeurl in descript.txt)
    "version": "1.0.0",
    "lang": "en"                   // only when the ghost language is English (makes the defaults below and values such as "time of day" English)
  },

  "settings": {
    "randomTalkEnabled": true,     // whether it talks by itself
    "randomTalkInterval": 180,     // how often it talks, in seconds (0 = never)
    "noRepeatCount": 0             // how many recent talks to leave out (0 = auto)
  },

  "variables": [                   // initial values of variables
    { "name": "affection", "value": 0 }
  ],

  "scripts": [ /* see below */ ]
}
```

`meta` and `settings` can be omitted; defaults are used.

### `format` (format version)

The `1` in `"ikaga/1"` is the version of this format. Ukagaka Studio checks it when opening a file.

| `format` | When opened in Ukagaka Studio |
|---|---|
| `ikaga/1` | Opens as is |
| `nashi/1` | A project from the original “Nashi Studio”. The format is the same, so it opens, and becomes `ikaga/1` when saved |
| not written | Treated as hand-written and opened as version 1 |
| `ikaga/2` or any newer version | Not opened (it tells you to update Ukagaka Studio). The file is left untouched |
| anything else (`foo/1` and so on) | Not opened |

**When you change the format** (renaming items, changing nesting, anything that makes old files unreadable as they are),
raise `FORMAT_VERSION` in `ui/js/model/model.js` by one and add to `MIGRATIONS` “a function that upgrades from the
previous version”. When a file is opened, it is upgraded step by step from its own version.
If you only add an item whose default is fine when missing, you do not need a new version (`Model.normalize` fills it in).

Exported ghosts never look at `format` (YAYA does not read `ghost.json`).
The `ikaga` in `ikaga/1` is a leftover from the name of the 1.x SHIORI (ikaga SHIORI).

## scripts

`scripts` is an array of “the group of blocks under one hat block”.

```jsonc
// reacts to an event
{ "id": "s1", "kind": "event", "event": "OnBoot", "weight": 1, "blocks": [ … ] }

// a random talk
{ "id": "t1", "kind": "talk", "name": "Monologue", "weight": 2, "blocks": [ … ] }

// called by name (a choice's target, the call block)
{ "id": "f1", "kind": "function", "name": "Petted", "blocks": [ … ] }

// runs only when Sakura's head is petted
{ "id": "s2", "kind": "event", "event": "OnNadeNade",
  "filter": { "area": "Head", "who": 0 }, "blocks": [ … ] }

// runs every 5 seconds (the steady loop)
{ "id": "s3", "kind": "event", "event": "OnSecondChange", "everySec": 5, "blocks": [ … ] }

// runs only when another ghost says something containing "Hello"
{ "id": "s4", "kind": "event", "event": "OnCommunicate",
  "filter": { "contains": "Hello" }, "blocks": [ … ] }
```

| Key | Meaning |
|---|---|
| `id` | Any identifier. Used to avoid repeating random talks and as an alternative key for `call` |
| `kind` | `event` / `talk` / `function`. Anything else (`loose` and so on) is ignored |
| `event` | The event name when `kind: "event"` |
| `name` | The name of a `talk` / `function`, used by `call` and choice targets |
| `weight` | How likely it is to be picked (default 1). When an event has several scripts, one is drawn by weight |
| `everySec` | How often `OnSecondChange` runs it, in seconds (omitted = every second). SSP sends it every second, so the runtime dictionary thins it out |
| `filter` | Narrows down the event. Mouse events use `area` (hit area name `Head` / `Face` / `Bust` / `Skirt` / `Hand`, or the names of hit areas drawn on the Characters page) and `who` (`0` = main character, `1` = partner). `OnCommunicate` uses `from` (the sender's name) and `contains` (a word in what was said); each **matches if it is contained**. Omitted items mean “anywhere / anyone / anything” |
| `disabled` | `true` disables it |
| `note` | A note on the script (does not affect behavior; goes into the dictionary as a `//` comment). Blocks can carry the same `note` |
| `x` / `y` | The position in the editor. Not written into the dictionaries |

For the contents of `blocks`, see the [block reference](blocks.md).

## Rules of behavior

How exported ghosts behave (handled by the runtime dictionary `studio_runtime.dic`).

* **Drawing an event** — When several scripts have the same `event`, one is drawn by weight.
  The one picked last time is left out, so the same reaction does not happen twice in a row.
  If the picked one outputs nothing, up to 4 others are tried.
* **Random talk** — It counts `OnSecondChange`, and once `randomTalkInterval` seconds have passed,
  it draws one `kind: "talk"` by weight and plays it.
  **Recently used ones are left out** (how many is `noRepeatCount`; 0 means
  half the number of talks, up to 8). If that leaves nothing, the oldest come back first.
  The order is kept in `yaya_variable.cfg`, so it does not repeat right after a restart either.
  While SSP says “do not talk now” (`Reference1` is not `1`), it waits.
  Saying anything resets the timer.
* **Loop interval** — A script with `everySec` runs only when the seconds since start are a multiple of it.
  Running everything every second gets heavy by itself,
  so scripts declare “every N seconds” instead.
* **Filters** — A script with a `filter` is a candidate only when its conditions match
  (mouse events use `Reference4` = the area hit and `Reference3` = who; `OnCommunicate` uses
  `Reference0` = the sender's name and `Reference1` = what was said).
  If nothing matches, the default reaction is returned.
* **More specific wins** — When an event has scripts both with and without a `filter`,
  **only the ones with conditions** are candidates (“when talked to containing ‘Hello’” comes before
  “when talked to”). Among several with conditions, one is drawn by weight.
* **Talking between ghosts** — For `OnCommunicate`, `Reference0` is the sender's name
  (`user` from SSP's communicate box) and `Reference1` is what was said.
  To talk to someone, use the `communicate` block. It adds
  `Reference0: <their name>` to the reply, and SSP delivers it as their `OnCommunicate`.
  It also adds `Age` (the generation of the exchange: 0 first, +1 for each reply),
  so SSP can stop conversations that run too long.
  The ghost itself also stops sending after 8 rounds back and forth and only talks
  (so ghosts do not chat with each other forever).
* **Petting** — When `OnMouseMove` stays over the same area 8 times in a row, the runtime dictionary makes an
  **`OnNadeNade`** event itself and runs it (reset after a 1.5-second gap or when the area changes).
  SSP never sends an event with this name. Moves outside hit areas are not counted.
* **Choices** — The `function` / `talk` whose `name` (or `id`) matches the ID in `\q[label,ID]`
  runs on `OnChoiceSelect`.
* **Closing** — Replies to `OnClose` / `OnCloseAll` always get `\-`
  (forgetting it cannot leave the ghost unable to close).
* **Adding `\e`** — If the output ends with neither `\e` nor `\-`, `\e` is added.
* **Saving** — Variables are saved to `yaya_variable.cfg` by YAYA's own saving (when the ghost closes).
  Saved values take precedence over the project's initial values; only newly added variables get their initial values.
  To start over, delete `yaya_variable.cfg` (“Clear the ghost's memory” under “Try” does it too).
* **Reloading** — YAYA does not reload by itself when the dictionaries change. Ukagaka Studio's “Run it in SSP”
  makes SSP reload the SHIORI after exporting (`\![reload,shiori]`).

## Default behavior when there are no blocks

Events with no matching script get a modest default reply.

| Event | Default reply |
|---|---|
| `OnFirstBoot` | “Nice to meet you. I'm …. Let's get along!” |
| `OnBoot` | “Welcome back.” |
| `OnClose` / `OnCloseAll` | “See you.” plus `\-` |
| `OnMouseDoubleClick` | one of 3 such as “What is it?” at random |
| `OnNadeNade` | on the head, one of 3 such as “Hehe.”; elsewhere, “...Please don't touch me so much.” |
| `OnUpdateComplete` / `OnUpdateFailure` | only says whether the update succeeded or failed |
| others | no reply (204 No Content) |

When `meta.lang` is `"en"`, it says these in English as above; without it, in Japanese
(「おかえりなさい。」 and so on). Ukagaka Studio writes `"en"` only when “Ghost language” on the Ghost info page is English.
For English ghosts, the values of the info blocks “time of day”, “season” and “weekday name” are English too ([blocks.md](blocks.md)).

## Debugging

Create an empty **`studio_debug.txt`** in the same folder as `yaya.dll`, and loading, YAYA's warnings, misspelled names in
“call … in N seconds”, SAORI that could not be loaded and so on are appended to it
(“Start logging” under “Try” in Ukagaka Studio creates it too).
For errors in YAYA itself (dictionaries that cannot be read and the like), see SSP's developer palette or YAYA's `yaya.log`.
