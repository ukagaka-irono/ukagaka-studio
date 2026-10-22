// 伺かスタジオ - exe に埋め込んだファイル（UI 一式・栞・サンプル）
#pragma once

#include <string>

#define IDI_IKAGA_APP        101
#define IDR_SAMPLE_PROJECT   901
#define IDR_SAMPLE_PROJECT_EN 902   // 英語のサンプル（はじめて起動したとき、exe の言語が英語なら置く）
#define IDR_YAYA_DLL         903    // YAYA の公式ビルド（third_party/yaya/）
// 904〜（yaya_host.exe・辞書・yaya_base）も YAYA 一式。番号と名前の対応は assets_gen.h の kYayaKit
#define IDR_WEB_ASSET_BASE  1000

namespace ikaga {

// リソースをそのまま取り出す
bool LoadEmbedded(int id, std::string& out);

// "/index.html" のようなパスから UI ファイルを取り出す
bool FindWebAsset(const std::string& path, std::string& out, std::string& mime);

// YAYA 一式（「ためす」が作業用のフォルダに書き出すもの）。名前はフォルダの中での相対パス
int YayaKitCount();
int YayaKitId(int i);
std::wstring YayaKitName(int i);

} // namespace ikaga
