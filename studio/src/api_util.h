// 伺かスタジオ - api_*.cpp で使う小さな道具（中身は api.cpp）
#pragma once

#include "webreq.h"
#include "json.h"
#include "sstp.h"

#include <string>

namespace ikaga {

void Json(HttpResponse& res, int status, const JValue& v);
// エラーは文ではなく、コード（bad_json など）で返します: {"error": コード, "detail": 補足}。
// 文にするのは画面です（ui/js/core/api.js の表。画面の言語で出すため）。
// detail は、そのまま見せる補足（ファイル名・SSP の返事など）で、無ければ付けません。
void JsonError(HttpResponse& res, int status, const std::string& code,
               const std::string& detail = std::string());
bool ParseBody(const HttpRequest& req, JValue& out);

JValue SspToJson(const SspInfo& ssp);

// ukagaka-studio.json（exe のとなりの設定ファイル）
JValue ReadConfig(const std::wstring& path);
void WriteConfig(const std::wstring& path, const std::string& key, const std::string& value);

// 前後の空白と、まわりの "…" を外す（エクスプローラの「パスのコピー」は "" つきになるため）
std::string Unquote(const std::string& raw);

} // namespace ikaga
