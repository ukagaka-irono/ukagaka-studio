// 伺かスタジオ - exe が自分で出す言葉の言語（日本語・英語）
//
// 画面（ui/js/i18n）と同じく、日本語が正です。英語のときだけ英語を出します。
//   ・起動したとき … 設定（ukagaka-studio.json の lang）→ Windows の表示言語、の順で決めます。
//   ・画面が読みこまれたら … 画面から lang:ja / lang:en が届くので、それに合わせます（main.cpp）。
//
// ここで訳すのは、exe が自分で見せるもの（メッセージボックス・ファイルをえらぶ窓・書き出す readme など）
// だけです。/api/* のエラーは訳さず、コード（bad_json など）で返し、画面が辞書で文にします
// （ui/js/core/api.js）。
#pragma once

#include <string>

namespace ikaga {

enum class Lang { Ja, En };

Lang CurrentLang();
void SetLang(Lang lang);

// "ja" / "en" から。それ以外なら fallback
Lang ParseLang(const std::string& code, Lang fallback);
const char* LangCode(Lang lang);

// Windows の表示言語が日本語なら Ja、それ以外は En（画面の i18n.js と同じ決めかた）
Lang SystemLang();

// いまの言語に合わせて、日本語か英語のどちらかを返す
const char* Tr(const char* ja, const char* en);
const wchar_t* Tr(const wchar_t* ja, const wchar_t* en);

// アプリの名前（伺かスタジオ / Ukagaka Studio）。ウィンドウとメッセージボックスの題、SSTP の Sender に使います
const wchar_t* AppNameW();
std::string AppName();

} // namespace ikaga
