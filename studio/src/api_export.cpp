// 伺かスタジオ - 書き出し・エクスプローラで開く
#include "api.h"
#include "api_util.h"
#include "exporter.h"
#include "fsutil.h"
#include "util.h"
#include "yaya_ghost.h"

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
    // 画面がブロックを YAYA に訳した辞書（ui/js/model/yaya.js）
    std::string dic = body["dic"].asStr();
    if (dic.empty()) { JsonError(res, 400, "no_dic"); return; }
    std::vector<OutFile> kit = YayaKitFiles();
    bool includeShell = body["includeShell"].asBool(true);
    bool overwriteShell = body["overwriteShell"].asBool(false);
    bool nar = body["mode"].asStr() == "nar";

    // 手書きの YAYA ゴーストにつないだプロジェクトは、そのゴーストに、スタジオのファイルだけを書く
    std::string linked = Unquote(body["linked"].asStr());
    ExportResult r;
    if (!linked.empty()) {
        nar = false;
        if (!IsLocalPath(Utf8ToWide(linked))) { JsonError(res, 400, "network_path", linked); return; }
        r = ExportLinked(Utf8ToWide(linked), RuntimeDic(kit), dic);
        if (!r.ok) { JsonError(res, 400, r.error.empty() ? "export_failed" : r.error, r.detail); return; }
    } else {
        r = nar ? ExportToNar(project, outDir, kit, dic, includeShell)
                : ExportToDir(project, outDir, kit, dic, includeShell, overwriteShell);
        if (!r.ok) { JsonError(res, 500, r.error.empty() ? "export_failed" : r.error, r.detail); return; }
        WriteConfig(configPath_, "lastOutDir", WideToUtf8(outDir));
    }

    JValue o = JValue::makeObj();
    o.set("mode", JValue::makeStr(!linked.empty() ? "linked" : nar ? "nar" : "dir"));
    o.set("folder", JValue::makeStr(r.folder));
    o.set("dll", JValue::makeBool(!kit.empty()));
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

// POST /api/yaya/inspect … 手書きの YAYA ゴーストを調べる（つなぐ前と、つないだプロジェクトを開いたとき）
void Api::InspectYaya(const HttpRequest& req, HttpResponse& res) {
    JValue body;
    if (!ParseBody(req, body)) { JsonError(res, 400, "bad_json"); return; }
    std::string raw = Unquote(body["path"].asStr());
    if (raw.empty()) { JsonError(res, 400, "no_path"); return; }
    // つないだゴーストは、プロジェクトを開いただけで調べるので、このパソコンの場所だけ
    if (!IsLocalPath(Utf8ToWide(raw))) { JsonError(res, 400, "network_path", raw); return; }
    YayaGhostInfo info = InspectYayaGhost(Utf8ToWide(raw));
    if (!info.ok) { JsonError(res, 404, info.error, raw); return; }
    JValue o = JValue::makeObj();
    o.set("path", JValue::makeStr(raw));
    o.set("master", JValue::makeStr(WideToUtf8(info.master)));
    o.set("name", JValue::makeStr(info.name));
    o.set("sakuraName", JValue::makeStr(info.sakuraName));
    o.set("keroName", JValue::makeStr(info.keroName));
    o.set("linked", JValue::makeBool(info.linked));
    JValue dics = JValue::makeArr();
    for (size_t i = 0; i < info.dics.size(); i++) dics.arr.push_back(JValue::makeStr(info.dics[i]));
    o.set("dics", dics);
    JValue fns = JValue::makeArr();
    for (size_t i = 0; i < info.functions.size(); i++) fns.arr.push_back(JValue::makeStr(info.functions[i]));
    o.set("functions", fns);
    JValue probs = JValue::makeArr();
    for (size_t i = 0; i < info.problems.size(); i++) probs.arr.push_back(JValue::makeStr(info.problems[i]));
    o.set("problems", probs);
    o.set("problemDetail", JValue::makeStr(info.problemDetail));
    Json(res, 200, o);
}

// POST /api/yaya/dics … YAYA ゴーストの手書きの辞書を読む（辞書の画面の「ゴーストから読みこむ」。段階 8-6）
//   { path } → { dics: [{ name: "master からの相対パス", text: "UTF-8" }] }
void Api::ReadYayaDics(const HttpRequest& req, HttpResponse& res) {
    JValue body;
    if (!ParseBody(req, body)) { JsonError(res, 400, "bad_json"); return; }
    std::string raw = Unquote(body["path"].asStr());
    if (raw.empty()) { JsonError(res, 400, "no_path"); return; }
    // 欄の最初の値は、プロジェクトのつないだゴースト（meta.ghostDir）なので、このパソコンの場所だけ
    if (!IsLocalPath(Utf8ToWide(raw))) { JsonError(res, 400, "network_path", raw); return; }
    std::vector<YayaDicFile> files;
    std::string error;
    if (!ReadYayaGhostDics(Utf8ToWide(raw), files, error)) { JsonError(res, 404, error, raw); return; }
    JValue dics = JValue::makeArr();
    for (size_t i = 0; i < files.size(); i++) {
        JValue d = JValue::makeObj();
        d.set("name", JValue::makeStr(files[i].name));
        d.set("text", JValue::makeStr(files[i].text));
        dics.arr.push_back(d);
    }
    JValue o = JValue::makeObj();
    o.set("dics", dics);
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
