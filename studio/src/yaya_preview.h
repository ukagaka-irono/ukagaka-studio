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

#include "preview.h"

#include <string>

namespace ikaga {

// dic … 画面が訳した studio_program.dic、input … {"vars":…, "sys":…, "refs":…} の JSON
PreviewResult RunYayaPreview(const std::string& dic, const std::string& scriptId, const std::string& input);

// 作業用のフォルダを消す（終わるときに呼びます）
void CleanupYayaPreview();

} // namespace ikaga
