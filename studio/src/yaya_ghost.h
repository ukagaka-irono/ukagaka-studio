// 伺かスタジオ - 手書きの YAYA ゴーストにつなぐ（段階 3-5b）
//
// いまある YAYA ゴーストのフォルダを調べ（手書きの辞書・その中の関数・足りないもの）、
// つないだプロジェクトを書き出すときは、スタジオのファイルだけを書きます。
//
//   書くもの … studio_runtime.dic・studio_program.dic（1 行目に印 "ukagaka-studio: generated"）と、
//             yaya.txt の中の印をつけた数行（"// ukagaka-studio: begin" 〜 "// ukagaka-studio: end"）
//   書かないもの … 手書きの辞書・descript.txt・シェル・yaya.dll・yaya_base など、ほかのすべて
//
// 書こうとした studio_*.dic に印が無ければ（人が書いたものなら）、上書きせずに止めます。
#pragma once

#include "exporter.h"

#include <string>
#include <vector>

namespace ikaga {

// スタジオが書くファイルの 1 行目にある印
extern const char* kStudioMark;

struct YayaGhostInfo {
    bool ok = false;
    std::string error;                    // 開けないときのコード（not_yaya_ghost など）
    std::wstring master;                  // ghost/master のフォルダ
    std::string name, sakuraName, keroName;   // descript.txt から
    std::vector<std::string> dics;        // 手書きの辞書（master からの相対パス）
    std::vector<std::string> functions;   // 手書きの辞書にある関数の名前
    // 書き出す前に直してもらうこと（コード）。空なら書き出せる
    //   yaya_dll_missing / yaya_dll_old / yaya_base_missing / yaya_base_old / not_studio_file
    std::vector<std::string> problems;
    std::string problemDetail;            // not_studio_file のときのファイル名
    bool linked = false;                  // yaya.txt に、もう印の行がある
};

// path はゴーストのフォルダ（ghost/master をふくむもの）か、ghost/master そのもの
YayaGhostInfo InspectYayaGhost(const std::wstring& path);

// 手書きの辞書の中身（段階 8-6。プロジェクトに読みこむ）。name は master からの相対パス（/ 区切り）、
// text は UTF-8 で、改行は \n（Shift_JIS の辞書も UTF-8 にします）
struct YayaDicFile {
    std::string name;
    std::string text;
};

// InspectYayaGhost と同じ辞書（yaya_base・スタジオのファイルはのぞく）を読む。開けないときは error にコードを入れて false
bool ReadYayaGhostDics(const std::wstring& path, std::vector<YayaDicFile>& out, std::string& error);

// つないだゴーストに書き出す。runtime は studio_runtime.dic、dic は訳した studio_program.dic
ExportResult ExportLinked(const std::wstring& path, const std::string& runtime, const std::string& dic);

// yaya.txt の印の数行を、いまの形に書きかえたもの（無ければ末尾に足す）。テストからも使います
std::string WithStudioLines(const std::string& yayaTxt);

} // namespace ikaga
