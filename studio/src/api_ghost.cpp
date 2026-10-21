// 伺かスタジオ - ためす・書き出したゴーストの記憶（ikaga_save.json）と記録（ikaga_debug.txt）
#include "api.h"
#include "api_util.h"
#include "exporter.h"
#include "fsutil.h"
#include "preview.h"
#include "util.h"

namespace ikaga {

// POST /api/preview … ブロックを動かして、さくらスクリプトを返す
// ブロックを動かすのは、栞そのもの（shiori/src/interp.cpp）です。
// 同じ規則を画面側にもう一度書くと、片方だけ直したときに静かにズレます。
void Api::Preview(const HttpRequest& req, HttpResponse& res) {
    JValue body;
    if (!ParseBody(req, body)) { JsonError(res, 400, "JSON が壊れています"); return; }

    PreviewRequest pr;
    pr.project = body["project"];
    if (!pr.project.isObj()) { JsonError(res, 400, "プロジェクトがありません"); return; }
    pr.scriptId = body["scriptId"].asStr();
    pr.vars = body["vars"];

    const JValue& refs = body["refs"];
    for (size_t i = 0; i < refs.size(); i++) pr.refs.push_back(refs.at(i).asStr());

    const JValue& sys = body["sys"];
    pr.uptime = sys["uptime"].asInt(0);
    pr.boots = sys["boots"].asInt(1);
    pr.talks = sys["talks"].asInt(0);
    pr.lastTalk = sys["lastTalk"].asStr();
    // 名前は画面から来たものを使い、無ければゴーストの設定から取る
    pr.ghostName = sys.has("ghostName") ? sys["ghostName"].asStr()
                                        : pr.project["meta"]["name"].asStr();
    pr.shellName = sys.has("shellName") ? sys["shellName"].asStr() : "master";

    PreviewResult r = RunPreview(pr);
    if (!r.ok) { JsonError(res, 400, r.error); return; }

    JValue o = JValue::makeObj();
    o.set("script", JValue::makeStr(r.script));
    o.set("commTo", JValue::makeStr(r.commTo));
    o.set("vars", r.vars);
    Json(res, 200, o);
}

// POST /api/save/reset … 書き出したゴーストが覚えている変数（ikaga_save.json）を消す。
// 好感度などが変な値で固まったとき、手でファイルを消さずにやり直せるように。
void Api::ResetGhostSave(const HttpRequest& req, HttpResponse& res) {
    JValue body;
    if (!ParseBody(req, body)) { JsonError(res, 400, "JSON が壊れています"); return; }
    const JValue& project = body["project"];
    if (!project.isObj()) { JsonError(res, 400, "プロジェクトがありません"); return; }

    std::wstring wfolder = Utf8ToWide(GhostFolderName(project));

    // 書き出し先と、SSP の ghost フォルダの両方を見る
    std::vector<std::wstring> roots;
    roots.push_back(DefaultOutDir());
    std::string outUtf8 = body["outDir"].asStr();
    if (!outUtf8.empty()) roots.push_back(Utf8ToWide(outUtf8));
    SspInfo ssp = Ssp();
    if (!ssp.ghostDir.empty()) roots.push_back(ssp.ghostDir);

    JValue deleted = JValue::makeArr();
    for (size_t i = 0; i < roots.size(); i++) {
        std::wstring p = PathJoin(PathJoin(PathJoin(PathJoin(roots[i], wfolder),
                                                   L"ghost"), L"master"), L"ikaga_save.json");
        bool dup = false;
        for (size_t k = 0; k < deleted.size(); k++) {
            if (deleted.at(k).asStr() == WideToUtf8(p)) { dup = true; break; }
        }
        if (dup) continue;
        if (DeleteFileIfExists(p)) deleted.arr.push_back(JValue::makeStr(WideToUtf8(p)));
    }

    JValue o = JValue::makeObj();
    o.set("ok", JValue::makeBool(true));
    o.set("deleted", deleted);
    Json(res, 200, o);
}

// POST /api/ghost/log … 栞の記録（ikaga_debug.txt）。栞は「そのファイルがあるときだけ」書きます。
//   action 無し … 読む   "start" … 空のファイルを作って記録を始める   "clear" … 消す
void Api::GhostLog(const HttpRequest& req, HttpResponse& res) {
    JValue body;
    if (!ParseBody(req, body)) { JsonError(res, 400, "JSON が壊れています"); return; }
    const JValue& project = body["project"];
    if (!project.isObj()) { JsonError(res, 400, "プロジェクトがありません"); return; }

    std::wstring wfolder = Utf8ToWide(GhostFolderName(project));

    // 「いま動いているゴースト」を先に見たいので、SSP の ghost フォルダから探す
    std::vector<std::wstring> roots;
    SspInfo ssp = Ssp();
    if (!ssp.ghostDir.empty()) roots.push_back(ssp.ghostDir);
    std::string outUtf8 = body["outDir"].asStr();
    if (!outUtf8.empty()) roots.push_back(Utf8ToWide(outUtf8));
    roots.push_back(DefaultOutDir());

    std::string action = body["action"].asStr();
    JValue o = JValue::makeObj();
    JValue places = JValue::makeArr();
    std::string text;
    bool recording = false;
    std::wstring shown;

    for (size_t i = 0; i < roots.size(); i++) {
        std::wstring dir = PathJoin(PathJoin(PathJoin(roots[i], wfolder), L"ghost"), L"master");
        if (!PathExists(PathJoin(dir, L"ikaga.dll"))) continue;   // 書き出していない場所
        std::wstring p = PathJoin(dir, L"ikaga_debug.txt");
        places.arr.push_back(JValue::makeStr(WideToUtf8(p)));

        if (action == "start") {
            if (!PathExists(p)) WriteBinaryFile(p, std::string());
        } else if (action == "clear") {
            DeleteFileIfExists(p);
        }
        if (shown.empty() && PathExists(p)) {
            shown = p;
            recording = true;
            std::string raw;
            if (ReadBinaryFile(p, raw)) {
                // 長くなるので、うしろの方だけ見せる
                const size_t kMax = 24000;
                if (raw.size() > kMax) raw = "（古いところは省いています）\r\n" + raw.substr(raw.size() - kMax);
                text = raw;
            }
        }
    }

    o.set("ok", JValue::makeBool(true));
    o.set("recording", JValue::makeBool(recording));
    o.set("text", JValue::makeStr(text));
    o.set("path", JValue::makeStr(WideToUtf8(shown)));
    o.set("places", places);
    Json(res, 200, o);
}

} // namespace ikaga
