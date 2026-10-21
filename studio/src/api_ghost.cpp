// 伺かスタジオ - ためす・書き出したゴーストの記憶（ikaga_save.json）と記録（ikaga_debug.txt）
#include "api.h"
#include "api_util.h"
#include "exporter.h"
#include "fsutil.h"
#include "yaya_preview.h"
#include "util.h"

namespace ikaga {

// POST /api/preview … ブロックを動かして、さくらスクリプトを返す
// ブロックを動かすのは、SSP に入るのと同じ YAYA（yaya_preview.cpp）です。
// 画面は、ブロックを YAYA に訳した辞書（dic）を送ってきます（ui/js/model/yaya.js）。
void Api::Preview(const HttpRequest& req, HttpResponse& res) {
    JValue body;
    if (!ParseBody(req, body)) { JsonError(res, 400, "bad_json"); return; }

    std::string dic = body["dic"].asStr();
    if (dic.empty()) { JsonError(res, 400, "no_dic"); return; }
    std::string scriptId = body["scriptId"].asStr();

    // YAYA に渡す材料（{"vars":…, "sys":…, "refs":…}）
    JValue input = JValue::makeObj();
    input.set("vars", body["vars"].isObj() ? body["vars"] : JValue::makeObj());
    const JValue& from = body["sys"];
    JValue sys = JValue::makeObj();
    sys.set("uptime", JValue::makeNum(from["uptime"].asInt(0)));
    sys.set("boots", JValue::makeNum(from["boots"].asInt(1)));
    sys.set("talks", JValue::makeNum(from["talks"].asInt(0)));
    sys.set("lastTalk", JValue::makeStr(from["lastTalk"].asStr()));
    sys.set("ghostName", JValue::makeStr(from["ghostName"].asStr()));
    sys.set("shellName", JValue::makeStr(from.has("shellName") ? from["shellName"].asStr() : "master"));
    input.set("sys", sys);
    JValue refs = JValue::makeArr();
    const JValue& rin = body["refs"];
    for (size_t i = 0; i < rin.size(); i++) refs.arr.push_back(JValue::makeStr(rin.at(i).asStr()));
    input.set("refs", refs);

    PreviewResult r = RunYayaPreview(dic, scriptId, input.dump());
    if (!r.ok) { JsonError(res, 400, r.error, r.detail); return; }

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
    if (!ParseBody(req, body)) { JsonError(res, 400, "bad_json"); return; }
    const JValue& project = body["project"];
    if (!project.isObj()) { JsonError(res, 400, "no_project"); return; }

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
    if (!ParseBody(req, body)) { JsonError(res, 400, "bad_json"); return; }
    const JValue& project = body["project"];
    if (!project.isObj()) { JsonError(res, 400, "no_project"); return; }

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
    bool truncated = false;
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
                // 長くなるので、うしろの方だけ見せる（省いたことは画面が書き添えます）
                const size_t kMax = 24000;
                if (raw.size() > kMax) {
                    raw = raw.substr(raw.size() - kMax);
                    truncated = true;
                }
                text = raw;
            }
        }
    }

    o.set("ok", JValue::makeBool(true));
    o.set("recording", JValue::makeBool(recording));
    o.set("text", JValue::makeStr(text));
    o.set("truncated", JValue::makeBool(truncated));
    o.set("path", JValue::makeStr(WideToUtf8(shown)));
    o.set("places", places);
    Json(res, 200, o);
}

} // namespace ikaga
