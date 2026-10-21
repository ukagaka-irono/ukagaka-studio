# よそから持ってきたもの

ここにあるファイルは、配られたときのバイトのまま持っています（`.gitattributes` で改行も書きかえません）。
**手を入れないでください。** 版を上げるときは、まるごと差しかえます。

| フォルダ | 中身 | もと | ライセンス |
|---|---|---|---|
| `yaya/` | 栞 YAYA の公式ビルド（`yaya.dll`）と、添えられていた `LICENSE`・`readme-original.txt`・`README.md` | [YAYA-shiori/yaya-shiori](https://github.com/YAYA-shiori/yaya-shiori) のリリース **Tc607-2** の `yaya.zip`（2026-10-19） | ゴーストとその周りに組みこむなら AYA Ver.5 の条件、それ以外は BSD 3-Clause（`yaya/README.md`） |
| `yaya-dic/` | YAYA のシステム辞書 `yaya_base`（SHIORI/3.0 の受け口）と `LICENSE`・`README.md` | [YAYA-shiori/yaya-dic](https://github.com/YAYA-shiori/yaya-dic) の `b12f3da`（2026-10-13） | The Unlicense |

`yaya.dll` の SHA-256: `66f2cb96a9399d64809533fdb30a446c7b3048c70f7cf8f8ddd5eebd3f01a799`

## なぜ公式のビルドを使うか

YAYA をソースからいまの Visual Studio で組むと、Windows XP・Vista からの API が入り、Windows 2000 で動かなくなります。
公式のビルドは古い Visual C++ で組まれていて、Windows 2000 で動きます（`docs/roadmap.md` の 3-0）。
`.\build.ps1 -Test` の輸入の点検（`tools\check-imports.js`）が、`yaya/yaya.dll` も見張ります。

## 版を上げるとき

1. `yaya/` に新しい `yaya.zip` の中身を、`yaya-dic/yaya_base/` に新しい `yaya_base` を、まるごと上書きします。
2. この表の版・日付と SHA-256 を書きかえます。
3. `.\build.ps1 -Test` を緑にします（輸入の点検と、YAYA を実際に動かすテストが走ります）。

---

**English:** these are third-party files kept byte-for-byte as distributed — do not edit them; replace them as a whole
to upgrade. `yaya/` is the official YAYA build (release Tc607-2; AYA Ver.5 terms when built into ghosts, BSD 3-Clause
otherwise). `yaya-dic/` is YAYA's system dictionary `yaya_base` (commit b12f3da; The Unlicense). The official build is
used because building YAYA with today's Visual Studio drops Windows 2000 support; `tools\check-imports.js` checks it.
