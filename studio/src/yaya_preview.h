// 伺かスタジオ - 「ためす」を YAYA で動かす（段階 3-4）
//
// SSP に入るのと同じ 32bit の yaya.dll でブロックを動かします。64bit の exe からは直に読めないので、
// exe に埋めこんだ 32bit の手伝い（yaya_host.exe）に頼みます。
//
//   作業用のフォルダ（%TEMP%\ukagaka-studio-preview-<プロセス番号>\）に、YAYA 一式
//   （yaya.dll・yaya_host.exe・yaya_base・studio_runtime.dic・studio_preview.dic）と、
//   画面が訳した辞書（studio_program.dic）を置いて、OnStudioPreview を 1 回たずねます。
//   中身の決まりは studio/res/yaya/studio_preview.dic にあります。
#pragma once

#include "json.h"

#include <string>

namespace ikaga {

// 「ためす」の結果
struct PreviewResult {
    bool ok = false;
    std::string error;     // うまくいかなかったときのコード（script_not_found など。文は画面が出す）
    std::string detail;    // その補足
    std::string script;    // 出てきたさくらスクリプト
    std::string commTo;    // 話しかける相手（いれば）
    JValue vars;           // 動かしたあとの変数
};

// dic … 画面が訳した studio_program.dic、input … {"vars":…, "sys":…, "refs":…} の JSON
PreviewResult RunYayaPreview(const std::string& dic, const std::string& scriptId, const std::string& input);

// 作業用のフォルダを消す（終わるときに呼びます）
void CleanupYayaPreview();

// 強制終了などで残った、もう動いていない伺かスタジオの作業用フォルダを消す（起動したときに呼びます）
void CleanupStaleYayaPreviews();

} // namespace ikaga
