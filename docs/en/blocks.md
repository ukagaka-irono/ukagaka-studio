# Block reference

日本語: [../blocks.md](../blocks.md)

> **This is the English translation of [docs/blocks.md](../blocks.md). The Japanese version is authoritative;**
> **if the two differ, follow the Japanese one.**

The blocks you can build with in the editor, and how each is written in `ghost.json`.
Block names are given as they appear in the English UI.

When you add a new block, you write it in **6 places, including this table and its Japanese original** (during stage 3, that includes the translation into YAYA).
The steps are in “Adding one block” in [`maintenance.md`](maintenance.md).
If you forget one, `node tools\check-blocks.js` stops and names it,
so **run that first after adding a block** (no build needed).

The rules that run blocks live in **one place only: `shiori/src/interp.cpp`**.
The editor's “Try” and ghosts installed in SSP both go through it
(the editor asks the SHIORI through `POST /api/preview`).

Slots that take a number or text (the `%` parts) **accept blocks from the Operators and Info categories**.
When you drop one in, the slot's value becomes a block (an object) instead of a string or number.

---

## Events (script hats)

A hat block is not a block but “the kind of script”.

| Hat | ghost.json |
|---|---|
| When … | `{ "kind": "event", "event": "OnBoot", "blocks": [...] }` |
| Random talk “name” weight N group G | `{ "kind": "talk", "name": "...", "weight": 1, "group": "G", "blocks": [...] }` |
| When “name” is called | `{ "kind": "function", "name": "...", "blocks": [...] }` |
| When … (who, area) (mouse events) | `{ "kind": "event", "event": "OnNadeNade", "filter": { "area": "Head", "who": 0 }, "blocks": [...] }` |
| Repeat forever every N seconds | `{ "kind": "event", "event": "OnSecondChange", "everySec": 5, "blocks": [...] }` |
| When talked to (from …, containing …) | `{ "kind": "event", "event": "OnCommunicate", "filter": { "from": "Sakura", "contains": "Hello" }, "blocks": [...] }` |

A `function` runs from a choice's target or from a “call …” block.
A `talk` can be called by name too.

Random talks can have a **group** (morning talks, season talks, and so on).
From the talks with the same group name, the “**call a talk from group …**” block calls exactly one,
picked by weight. If it is empty, the talk is in no group.

Main event names: `OnFirstBoot` / `OnBoot` / `OnClose` / `OnMouseDoubleClick` /
`OnMouseClick` / `OnNadeNade` / `OnMouseMove` / `OnMouseWheel` / `OnHourChange` /
`OnMinuteChange` / `OnSecondChange` / `OnChoiceSelect` / `OnCommunicate` /
`OnGhostChanged` / `OnGhostChanging` / `OnKeyPress` / `OnSurfaceRestore` /
`OnWindowStateMinimize` / `OnWindowStateRestore` /
`OnUpdateBegin` / `OnUpdateReady` / `OnUpdateComplete` / `OnUpdateFailure` /
`OnSaoriDone` / `OnUserInput` / `OnUserInputCancel`.
Events not in the list can be typed in with “Other (type it in)”
(fine-grained progress events such as `OnUpdate.OnDownloadBegin` can be written there too).

When you choose a mouse event (click, double-click, petting, wheel, mouse move),
the hat becomes “**When … (who, area)**”, and you can narrow it down by **the area hit** and
**who was hit**. The area names are `Head` / `Face` / `Bust` (chest) / `Skirt` / `Hand`,
and the exported placeholder shell has hit areas with these names.
Hit areas you add to animations show up in this list too.

Broadly, `OnFirstBoot` / `OnBoot` are **the first time**, `OnSecondChange` is **the steady loop**,
and the rest are **events**. Choosing “Repeat forever” turns the hat into the “every N seconds” form.
SSP calls it every second, so anything stacked there runs every second.
About 5 seconds keeps it light without a noticeable difference
(“wait N ms” is `\_w`, a block that **pauses the speech**; it does not delay the next loop).

`OnNadeNade` (when petted) is not an SSP event.
The SHIORI makes it and runs it itself when `OnMouseMove` hits the same area 8 times in a row.

Choosing **When talked to** (`OnCommunicate`) turns the hat into
“**When talked to (from …, containing …)**”. The first is the sender's name, the second is what was said;
each **matches if it is contained**, and an empty field means “anyone / anything”.
When talked to from SSP's communicate box, the sender's name is `user`.

When the same event has both a script with conditions and one without, **the one with conditions wins**
(if there is “When talked to containing ‘Hello’”, the plain “When talked to” is not used).
The same goes for mouse filters.

---

## Speech

| Block | JSON | Sakura Script output |
|---|---|---|
| ◯ says □ (then new line) | `{"type":"say","who":0,"text":"…","nl":1}` | `\0…\n` |
| new line × N | `{"type":"newline","count":1}` | `\n` |
| wait for a click | `{"type":"click_wait"}` | `\x` |
| clear the balloon | `{"type":"clear"}` | `\c` |
| show choice “L” → T | `{"type":"choice","label":"L","target":"T"}` | `\q[L,T]` |
| show link “L” → URL | `{"type":"link","label":"L","url":"…"}` | `\_a[…]L\_a` |
| ◯ talks to T: □ | `{"type":"communicate","who":0,"to":"T","text":"…"}` | `\0…` (plus `Reference0: T` in the reply) |
| output Sakura Script □ as is | `{"type":"raw","text":"…"}` | unchanged |

In `say` text, `\` is turned into `\\` and line breaks into `\n` automatically.
A `%` such as `%username` passes through, so SSP's substitutions work.

Text put into **a link's URL, a sound's file name, and a choice's label and target** has
`[` `]` and line breaks (and `,` for targets) removed before it is written out.
Even if you drop in **text from outside** such as “what was said” or the answer to “ask”,
it cannot close the tag with `]` and continue with another command.
Only `output Sakura Script □ as is` (`raw`) is, as the name says, **passed through untouched**.
Do not put text from outside into it.

**Talks to** (`communicate`) is shown on screen like normal speech and,
at the same time, reaches the other ghost's `OnCommunicate`. Put the other ghost's
**main character (`\0`) name** in `to`. To reply to whoever talked to you, drop the
“who talked to me” block into `to`. The editor's “Try” only shows the recipient's name,
so check in SSP whether it really arrives.

## Looks

| Block | JSON | Output |
|---|---|---|
| change surface of ◯ to N | `{"type":"surface","who":0,"id":0}` | `\0\s[0]` |
| from now on, character N speaks | `{"type":"chara","id":2}` | `\p[2]` (0 and 1 are `\0` `\1`) |
| play animation N | `{"type":"anim","id":0}` | `\i[0]` |
| switch balloon to N | `{"type":"balloon","id":0}` | `\b[0]` |
| play sound F | `{"type":"sound","file":"a.wav"}` | `\_v[a.wav]` |

**Animations** (`anim`) play SERIKO animations. Their contents are not blocks: you make them on the
editor's “Characters” page, and they are written to `shell/master/surfaces.txt`.
The preview does not animate the pictures, but `\i[n]` appears in the Sakura Script.

Each frame can be **shifted** by “x” and “y” (relative to the top left of the base picture;
negative values are allowed). At 0 it sits exactly on the base picture.

The **method** (SERIKO's drawing method) can be chosen per frame too.

| Name in the UI | surfaces.txt | What it does |
|---|---|---|
| overlay | `overlay` | draws on top, keeping transparency (the usual choice) |
| overlay (fast) | `overlayfast` | draws only over the opaque parts of the picture below |
| replace the base | `base` | swaps out the base picture itself |
| replace, transparency too | `replace` | replaces it including transparency |
| fill transparent parts only | `interpolate` | draws only where the picture below is transparent |
| ignore transparency | `asis` | does not use the transparency information |
| cut out (reduce) | `reduce` | makes what it covers transparent |
| move only | `move` | shifts the display position without changing the picture |
| blend: multiply / screen / overlay / add | `blend-multiply` and others | blends the colors differently |
| start another animation | `start` | starts the animation with the chosen number (no picture or wait needed) |
| stop another animation | `stop` | stops the animation with the chosen number |
| insert an animated image | `import` | plays an APNG / GIF / WebP as is (a file name instead of a surface) |

`start` / `stop` write only the “animation #” (`animation0.pattern0,start,5`).
`import` is not written if the file name contains a comma or `..` (it would break the line).

You can also **swap hit areas**. “Add hit area” on an animation creates a place you can touch
**only while that animation plays**.
If you name it, the name appears in the area list of mouse hats,
so you can write things like “the wings can be touched only while they flap”.

| Shape | surfaces.txt | What you enter |
|---|---|---|
| rectangle | `animationN.collisionM,left,top,right,bottom,name` | top left and bottom right |
| ellipse | `animationN.collisionexM,name,ellipse,left,top,right,bottom` | top left and bottom right of the bounding box |
| circle | `animationN.collisionexM,name,circle,centerx,centery,radius` | center and radius |
| polygon | `animationN.collisionexM,name,polygon,x,y,x,y,…` | 3 or more corners as `x,y` |

## Control

| Block | JSON |
|---|---|
| wait N ms | `{"type":"wait","ms":500}` → `\_w[500]` |
| if ◇ then | `{"type":"if","cond":◇,"then":[...]}` |
| if ◇ then / else | `{"type":"if_else","cond":◇,"then":[...],"else":[...]}` |
| repeat N times | `{"type":"repeat","count":3,"body":[...]}` |
| repeat while ◇ | `{"type":"while","cond":◇,"body":[...]}` |
| one of these at random | `{"type":"random_one","branches":[[...],[...]]}` |
| call ◯ | `{"type":"call","name":"talk name"}` |
| call a talk from group ◯ | `{"type":"call_group","group":"group name"}` |
| set random talk interval to N seconds | `{"type":"talk_interval","sec":180}` |
| ask, and put the answer in V | `{"type":"ask","into":"V","initial":""}` → `\![open,inputbox,ikaga:V,-1,…]` |
| call ◯ in N seconds | `{"type":"later","sec":30,"name":"talk name"}` |
| raise event E | `{"type":"raise","event":"E","a":""}` → `\![raise,E,…]` |
| switch to ghost ◯ | `{"type":"change_ghost","name":"…"}` → `\![change,ghost,…]` |
| open URL in the browser | `{"type":"open_browser","url":"…"}` → `\![open,browser,…]` |
| run a network update | `{"type":"update"}` → `\![updatebymyself]` |
| call F with A B (put the answer in V without waiting) | `{"type":"saori_call","file":"F","a":A,"b":B,"into":"V","value":-1}` |
| end the talk here | `{"type":"end"}` → `\e` |
| close the ghost | `{"type":"close"}` → `\-` |

Loops stop after 5000 rounds, and running blocks stops after 40000 steps
(safety stops so SSP does not freeze).
One reply's Sakura Script is at most 32000 bytes, and so is one variable.
Anything beyond is not output (the whole piece is dropped rather than cut in the middle).

**Ask** (`ask`) shows an input box and **puts what the user typed straight into a variable**.
Say the question itself first with an ordinary speech block
(place “says ‘What's your name?’” → ask, in that order).
The input box ID is `ikaga:<variable name>`; when SSP returns `OnUserInput`,
the SHIORI reads it and puts the contents into the variable. You also get it as an event,
so a “When an answer comes back” hat can say thanks.
Variable names containing commas or square brackets cannot be used (they would break the command to SSP; the Check tab stops them).

**Call … in N seconds** (`later`) runs a named talk **later**. The SHIORI remembers the reservation
and checks the time on the next “Repeat forever”. Up to 32 reservations, at most one day ahead.
They are dropped when the ghost closes (they are not saved).

**Switch to ghost** (`change_ghost`) is the last block under a hat (nothing after it runs).
With the name `random`, it switches to a random installed ghost.

**Raise event** (`raise`) is for handing over to another hat block.
What you put in “info” arrives as `Reference0`.

**Network update** (`update`) asks SSP to “go and check for something new”.
If the ghost's **Update URL** (`homeurl` in `descript.txt`) is empty, nothing happens,
so the Check tab warns about it. The result comes back as `OnUpdateComplete` / `OnUpdateFailure`.
See “Network updates” in the [README](../../README.en.md) for details.

## Variables

| Block | JSON |
|---|---|
| set V to X | `{"type":"set","name":"V","value":X}` |
| change V by X | `{"type":"change","name":"V","value":X}` |
| V (read the value) | `{"type":"var","name":"V"}` |

A variable's initial value is kept in the project's `variables`, and its actual value
is saved in the ghost's `ikaga_save.json`.

## Operators (values and conditions)

| Block | JSON |
|---|---|
| A ＋ B (− × ÷ mod) | `{"type":"arith","op":"+","a":A,"b":B}` |
| A ＜ B (＝ ＞ ≠) | `{"type":"compare","op":"<","a":A,"b":B}` |
| A and B / A or B | `{"type":"logic","op":"and","a":A,"b":B}` |
| not A | `{"type":"not","a":A}` |
| random number from A to B | `{"type":"random","min":A,"max":B}` |
| A % chance | `{"type":"chance","a":A}` |
| join A and B | `{"type":"join","a":A,"b":B}` |
| A contains B | `{"type":"contains","a":A,"b":B}` |
| length of A | `{"type":"length","a":A}` |
| round / round down / round up / absolute value of A | `{"type":"round","op":"round","a":A}` |
| answer of F called with A B | `{"type":"saori","file":"F","a":A,"b":B,"value":-1}` |

Comparisons compare as numbers when both sides read as numbers, and as text otherwise.
Yes/no is treated as the numbers **1 / 0** (dropped into speech, it comes out as `1` or `0`).

**External modules (SAORI)** call a DLL placed in the ghost folder.
`file` is relative to the ghost folder; `..` and absolute paths are not allowed.
The DLL must be **32-bit, like the SHIORI**. A `value` of `-1` takes `Result:`;
`0` and up take `Value0:` onward. If the call fails it returns an empty string, and
the reason goes to `ikaga_debug.txt` (it is logged if you create an empty file next to `ikaga.dll`).
A loaded DLL stays loaded until the ghost closes.
The preview cannot load real DLLs, so it **always returns empty**. Check in SSP.

This block **waits for the answer**, so calling a slow SAORI (one that goes online, say)
stops SSP for that long. In that case use
“**call F with A B (put the answer in V without waiting)**” (`saori_call`) from the Control category.
It calls on another thread; **when the answer arrives it goes into variable V**, and the next
“Repeat forever” raises `OnSaoriDone` (`Reference0` is the file called, `Reference1` the answer).

* Up to 4 can run at the same time. Calls beyond that are not made.
* Many SAORI DLLs are not written to be called concurrently, so the calls themselves
  (waiting or not) are made **one at a time, in order**.
* Nothing happens in the preview (and nothing goes into the variable).

## Info

| Block | JSON | Meaning |
|---|---|---|
| current hour and so on | `{"type":"sys","key":"hour"}` | `hour` `minute` `second` `year` `month` `day` `weekday` (0=Sunday) |
| seconds / minutes since start | `{"type":"sys","key":"uptime"}` / `uptimemin` | |
| times started | `{"type":"sys","key":"boots"}` | recorded in the save data |
| talks this session | `{"type":"sys","key":"talks"}` | |
| ghost name / shell name | `{"type":"sys","key":"ghostname"}` / `shellname` | |
| who talked to me / what was said | `{"type":"sys","key":"commfrom"}` / `commtext` | `Reference0` / `Reference1` of `OnCommunicate` |
| time of day | `{"type":"sys","key":"daypart"}` | `朝`(5-11) / `昼`(11-17) / `夕方`(17-22) / `夜`(22-5). English ghosts: `morning` / `afternoon` / `evening` / `night` |
| season | `{"type":"sys","key":"season"}` | `春`(3-5) / `夏`(6-8) / `秋`(9-11) / `冬`(12-2). English ghosts: `spring` / `summer` / `autumn` / `winter` |
| weekday name | `{"type":"sys","key":"weekdayname"}` | `日` to `土`. English ghosts: `Sunday` to `Saturday` |
| previous talk | `{"type":"sys","key":"lasttalk"}` | the id of that talk |
| event info N | `{"type":"ref","index":0}` | SSP's `ReferenceN` |

The values of “time of day”, “season” and “weekday name” depend on the **ghost language** (`meta.lang`),
not on the screen language, because scripts compare against them.

What `ReferenceN` holds differs per event. The common ones:

| Event | 0 | 1 | 2 | 3 | 4 |
|---|---|---|---|---|---|
| OnMouseDoubleClick | X | Y | wheel | who (0/1) | hit area |
| OnSecondChange | window | can talk | total seconds | | |
| OnChoiceSelect | picked ID | | | | |
| OnBoot | shell name | | | | |
| OnCommunicate | sender name | what was said | | | |
| OnUpdateBegin | ghost name | folder path | | type | |
| OnUpdateReady | number of files − 1 | file names (comma-separated) | type | | |
| OnUpdateComplete | none / changed | updated file names | | type | |
| OnUpdateFailure | reason | failed file names | | type | |
| OnSaoriDone | called file | answer | | | |
| OnUserInput | question ID | input text | | | |
| OnUserInputCancel | question ID | close / timeout | | | |

Reference 0 of `OnUpdateComplete` is `none` (nothing new) or `changed` (updated).
Reference 0 of `OnUpdateFailure` is `timeout` / `md5 miss` / `artificial` (stopped by yourself) / `404` and so on.

If you write no blocks for them, the SHIORI says a word **only when the update succeeded** and **when it failed**
(it stays quiet about “nothing changed” and the steps in between, which would get noisy).
