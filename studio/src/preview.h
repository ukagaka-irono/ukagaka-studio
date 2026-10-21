// 伺かスタジオ - 64bit の如何栞でかたまりを動かす
//
// もとは「ためす」がこれを使っていました。段階 3-4 から「ためす」は YAYA で動かすので
// （yaya_preview.h）、いまは一致テストの preview_host.exe だけが使います（32bit と 64bit の見くらべ）。
// 結果の形（PreviewResult）は、YAYA の「ためす」も同じものを使います。
#pragma once

#include "json.h"

#include <string>
#include <vector>

namespace ikaga {

// エディタから来る「ためす」の材料
struct PreviewRequest {
    JValue project;                    // ghost.json そのもの
    std::string scriptId;              // どのかたまりを動かすか（scripts[].id）
    std::vector<std::string> refs;     // イベントの情報（Reference0..）
    JValue vars;                       // 続きから動かすときの変数

    // 情報ブロックが返す値。プレビューは SSP につながっていないので、呼ぶ側で決めます。
    // 既定を置かないのは、一致テストが「起動していない状態」（名前が空）で
    // 動かすためです。ふつうの使いかたの既定は api.cpp が入れます。
    int uptime = 0;
    int boots = 1;
    int talks = 0;
    std::string ghostName;
    std::string shellName;
    std::string lastTalk;
};

struct PreviewResult {
    bool ok = false;
    std::string error;     // うまくいかなかったときのコード（script_not_found など。文は画面が出す）
    std::string detail;    // その補足
    std::string script;    // 出てきたさくらスクリプト
    std::string commTo;    // 話しかける相手（いれば）
    JValue vars;           // 動かしたあとの変数
};

// ブロックを動かして、さくらスクリプトを返します。
// SAORI は呼びません（本物の DLL が要るので、SSP に入れてから確かめてもらいます）。
PreviewResult RunPreview(const PreviewRequest& req);

} // namespace ikaga
