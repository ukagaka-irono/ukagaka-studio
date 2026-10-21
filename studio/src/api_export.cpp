// 伺かスタジオ - 書き出し・エクスプローラで開く
#include "api.h"
#include "api_util.h"
#include "exporter.h"
#include "fsutil.h"
#include "util.h"

#include <shellapi.h>

namespace ikaga {

// POST /api/export … ゴースト一式をフォルダか .nar に書き出す
void Api::Export(const HttpRequest& req, HttpResponse& res) {
    JValue body;
    if (!ParseBody(req, body)) { JsonError(res, 400, "bad_json"); return; }
    const JValue& project = body["project"];
    if (!project.isObj()) { JsonError(res, 400, "no_project"); return; }

    std::string outUtf8 = body["outDir"].asStr();
    std::wstring outDir = outUtf8.empty() ? outputDir_ : Utf8ToWide(outUtf8);
    std::string dll = DllBytes();
    bool includeShell = body["includeShell"].asBool(true);
    bool overwriteShell = body["overwriteShell"].asBool(false);
    bool nar = body["mode"].asStr() == "nar";

    ExportResult r = nar ? ExportToNar(project, outDir, dll, includeShell)
                         : ExportToDir(project, outDir, dll, includeShell, overwriteShell);
    if (!r.ok) { JsonError(res, 500, r.error.empty() ? "export_failed" : r.error, r.detail); return; }
    WriteConfig(configPath_, "lastOutDir", WideToUtf8(outDir));

    JValue o = JValue::makeObj();
    o.set("mode", JValue::makeStr(nar ? "nar" : "dir"));
    o.set("folder", JValue::makeStr(r.folder));
    o.set("dll", JValue::makeBool(!dll.empty()));
    o.set("root", JValue::makeStr(WideToUtf8(r.root)));
    o.set("path", JValue::makeStr(WideToUtf8(r.root)));
    JValue written = JValue::makeArr();
    for (size_t i = 0; i < r.written.size(); i++) written.arr.push_back(JValue::makeStr(r.written[i]));
    o.set("written", written);
    JValue skipped = JValue::makeArr();
    for (size_t i = 0; i < r.skipped.size(); i++) skipped.arr.push_back(JValue::makeStr(r.skipped[i]));
    o.set("skipped", skipped);
    Json(res, 200, o);
}

// POST /api/reveal … エクスプローラで開く（ファイルなら、そのフォルダを）
void Api::Reveal(const HttpRequest& req, HttpResponse& res) {
    JValue body;
    if (!ParseBody(req, body)) { JsonError(res, 400, "bad_json"); return; }
    std::wstring path = Utf8ToWide(body["path"].asStr());
    if (path.empty() || !PathExists(path)) { JsonError(res, 404, "not_found"); return; }
    if (!IsDirectory(path)) path = ParentDir(path);
    ShellExecuteW(NULL, L"open", L"explorer.exe", (L"\"" + path + L"\"").c_str(), NULL, SW_SHOWNORMAL);
    JValue o = JValue::makeObj();
    o.set("ok", JValue::makeBool(true));
    Json(res, 200, o);
}

} // namespace ikaga
