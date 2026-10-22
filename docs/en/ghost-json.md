# The ghost.json specification

日本語: [../ghost-json.md](../ghost-json.md)

> **This is the English translation of [docs/ghost-json.md](../ghost-json.md). The Japanese version is authoritative;**
> **if the two differ, follow the Japanese one.**

> **From stage 3-5a, exported ghosts run on YAYA.** `ghost.json` is still exported as a copy of the blocks that were
> translated into the YAYA dictionary (`studio_program.dic`); “Import” in Ukagaka Studio opens it, and YAYA does not read it.
> The description of “the SHIORI” below is ikaga SHIORI's; YAYA is built to behave the same. Saving goes to
> `yaya_variable.cfg`, and the log to `studio_debug.txt`.

ikaga SHIORI (`ikaga.dll`) runs by reading **`ghost.json`** in its own folder
(`ikaga.json` also works). You may write it by hand without the editor.

The encoding is **UTF-8** (with or without a BOM). If it was written in Shift_JIS,
it is converted automatically. `//` and `/* */` comments are skipped.

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

The SHIORI (`ikaga.dll`) does not look at `format`: every export bundles the SHIORI that matches it.

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
| `everySec` | How often `OnSecondChange` runs it, in seconds (omitted = every second). SSP sends it every second, so the SHIORI thins it out |
| `filter` | Narrows down the event. Mouse events use `area` (hit area name `Head` / `Face` / `Bust` / `Skirt` / `Hand`) and `who` (`0` = main character, `1` = partner). `OnCommunicate` uses `from` (the sender's name) and `contains` (a word in what was said); each **matches if it is contained**. Omitted items mean “anywhere / anyone / anything” |
| `disabled` | `true` disables it |
| `x` / `y` | The position in the editor. The SHIORI ignores them |

For the contents of `blocks`, see the [block reference](blocks.md).

## Rules of behavior

* **Drawing an event** — When several scripts have the same `event`, one is drawn by weight.
  The one picked last time is left out, so the same reaction does not happen twice in a row.
  If the picked one outputs nothing, up to 4 others are tried.
* **Random talk** — It counts `OnSecondChange`, and once `randomTalkInterval` seconds have passed,
  it draws one `kind: "talk"` by weight and plays it.
  **Recently used ones are left out** (how many is `noRepeatCount`; 0 means
  half the number of talks, up to 8). If that leaves nothing, the oldest come back first.
  The order is kept in `ikaga_save.json`, so it does not repeat right after a restart either.
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
  To talk to someone, use the `communicate` block. The SHIORI adds
  `Reference0: <their name>` to the reply, and SSP delivers it as their `OnCommunicate`.
  It also adds `Age` (the generation of the exchange: 0 first, +1 for each reply),
  so SSP can stop conversations that run too long.
  The SHIORI itself also stops sending after 8 rounds back and forth and only talks
  (so ghosts do not chat with each other forever).
* **Petting** — When `OnMouseMove` stays over the same area 8 times in a row, the SHIORI makes an
  **`OnNadeNade`** event itself and runs it (reset after a 1.5-second gap or when the area changes).
  SSP never sends an event with this name. Moves outside hit areas are not counted.
* **Choices** — The `function` / `talk` whose `name` (or `id`) matches the ID in `\q[label,ID]`
  runs on `OnChoiceSelect`.
* **Closing** — Replies to `OnClose` / `OnCloseAll` always get `\-`
  (forgetting it cannot leave the ghost unable to close).
* **Adding `\e`** — If the output ends with neither `\e` nor `\-`, `\e` is added.
* **Saving** — Variables are saved to `ikaga_save.json` (on close and every 2 minutes).
  Saved values take precedence over the project's initial values.
  To start over, delete `ikaga_save.json`.
* **Automatic reload** — It checks `ghost.json` for changes every 3 seconds
  and, if it changed, rereads it without stopping SSP.
  Only newly added variables are added, with their initial values.

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

If `ghost.json` cannot be read, it says so at startup along with the error
(in both Japanese and English, since it cannot tell which language the ghost was exported in).

## Debugging

Create an empty **`ikaga_debug.txt`** in the same folder as `ikaga.dll`, and the load results
and reload messages are appended to it.
