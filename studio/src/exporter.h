// 伺かスタジオ - ゴースト書き出し（フォルダ / .nar）
#pragma once

#include "json.h"

#include <string>
#include <vector>

namespace ikaga {

struct OutFile {
    std::string name;    // ゴーストのルートからの相対パス（/ 区切り）
    std::string data;
    bool shell;          // シェル画像などは既存があれば残す
};

struct ExportResult {
    bool ok = false;
    std::string error;     // うまくいかなかったときのコード（mkdir_failed など。文は画面が出す）
    std::string detail;    // その補足（書けなかったファイルの名前）
    std::wstring root;
    std::string folder;
    std::vector<std::string> written;
    std::vector<std::string> skipped;
};

std::string SafeFolderName(const std::string& name, const char* fallback);

// 書き出すときのフォルダ名（meta.folder、無ければ meta.name。どちらも無ければ ikaga-ghost）
std::string GhostFolderName(const JValue& project);

// ゴーストの言語（meta.lang）。"en" なら英語、それ以外（無いときも）は日本語。
// 書き出すもの（readme.txt・名前が空のときの名前・バルーンの名前）と、栞が自分で言うこと・
// 「いまごろ」などの値は、この言語になります（画面の言語ではありません）。
bool EnglishGhost(const JValue& project);
const char* ByGhostLang(const JValue& project, const char* ja, const char* en);

// ゴーストの名前（meta.name）。空や空白だけのときは「あたらしいゴースト」（英語のゴーストなら New Ghost）
// （名前の欄を消して書き出しても、install.txt や descript.txt の name が空にならないように）
std::string GhostName(const JValue& project);

// 名前の欄が無いときの、さくら側・うにゅう側の名前（ゴーストの言語で）
const char* DefaultSakuraName(const JValue& project);
const char* DefaultKeroName(const JValue& project);

// 栞が読む ghost.json の中身（エディタ専用の項目を落としたもの）。
// 英語のゴーストなら meta.lang を "en" にします（日本語のときは書きません）
std::string RuntimeProgramJson(const JValue& project);

// 仮シェルの立ち絵を1枚だけ描いて PNG で返す（エディタのリアルタイム表示用）。
// surfaceId: 0/1/2 = さくら（通常・笑顔・驚き）、10/11/12 = うにゅう。
// それ以外の id は同じ系統の「通常」に丸める。空文字なら既定色。
std::string RenderSurfacePng(int surfaceId, const std::string& hairHex, const std::string& clothHex);

// 絵の大きさから作る、自動の当たり判定（あたま・かお・むね・スカート・て）。書き出しと「ためす」で同じものを使う
struct HitArea { std::string name; int x1 = 0, y1 = 0, x2 = 0, y2 = 0; };
std::vector<HitArea> DefaultHitAreas(int w, int h);

// プロジェクトでその番号に割り当てた画像ファイルのパス（無ければ空）
std::string ShellImagePath(const JValue& project, int surfaceId);

// YAYA で動かすときの yaya.txt（書き出すゴーストのもの。画面の yayaTxt() と同じ中身）
std::string YayaTxt();

// ゴースト一式のファイル。
//   kit … ghost/master/ に置く YAYA 一式（yaya.dll・yaya_base/…・studio_runtime.dic）。名前は master からの相対
//   dic … 画面がブロックを訳した studio_program.dic（ui/js/model/yaya.js の toYaya）
std::vector<OutFile> BuildGhostFiles(const JValue& project, const std::vector<OutFile>& kit,
                                     const std::string& dic, bool includeShell, std::string* folderOut);

// ネットワーク更新の照合表（updates2.dau）を、そのフォルダの中身から作る
std::string BuildUpdatesDau(const std::wstring& root);

ExportResult ExportToDir(const JValue& project, const std::wstring& outDir, const std::vector<OutFile>& kit,
                         const std::string& dic, bool includeShell, bool overwriteShell);

ExportResult ExportToNar(const JValue& project, const std::wstring& outDir, const std::vector<OutFile>& kit,
                         const std::string& dic, bool includeShell);

} // namespace ikaga
