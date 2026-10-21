#define WIN32_LEAN_AND_MEAN
#include <windows.h>

#include "lang.h"

namespace ikaga {

static Lang g_lang = Lang::Ja;

Lang CurrentLang() { return g_lang; }
void SetLang(Lang lang) { g_lang = lang; }

Lang ParseLang(const std::string& code, Lang fallback) {
    if (code == "ja") return Lang::Ja;
    if (code == "en") return Lang::En;
    return fallback;
}

const char* LangCode(Lang lang) { return lang == Lang::En ? "en" : "ja"; }

Lang SystemLang() {
    return PRIMARYLANGID(GetUserDefaultUILanguage()) == LANG_JAPANESE ? Lang::Ja : Lang::En;
}

const char* Tr(const char* ja, const char* en) { return g_lang == Lang::En ? en : ja; }
const wchar_t* Tr(const wchar_t* ja, const wchar_t* en) { return g_lang == Lang::En ? en : ja; }

const wchar_t* AppNameW() { return Tr(L"伺かスタジオ", L"Ukagaka Studio"); }
std::string AppName() { return Tr("伺かスタジオ", "Ukagaka Studio"); }

} // namespace ikaga
