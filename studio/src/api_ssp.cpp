// 伺かスタジオ - 動いている SSP との連携（見つける・起動する・SSTP で話す・ゴーストを入れる）
#include "api.h"
#include "yaya_ghost.h"
#include "api_util.h"
#include "exporter.h"
#include "fsutil.h"
#include "lang.h"
#include "sstp.h"
#include "util.h"

#include <shellapi.h>

namespace ikaga {

// GET /api/ssp … SSP のようす
void Api::GetSsp(const HttpRequest&, HttpResponse& res) {
    Json(res, 200, SspToJson(Ssp()));
}

// POST /api/ssp/path … ssp.exe の場所を覚える
void Api::SetSspPath(const HttpRequest& req, HttpResponse& res) {
    JValue body;
    if (!ParseBody(req, body)) { JsonError(res, 400, "bad_json"); return; }
    WriteConfig(configPath_, "sspPath", Unquote(body["path"].asStr()));
    sspCacheTick_ = 0;                       // すぐ探しなおす
    Json(res, 200, SspToJson(Ssp()));
}

// POST /api/ssp/launch
void Api::LaunchSsp(const HttpRequest&, HttpResponse& res) {
    SspInfo ssp = Ssp();
    if (ssp.exePath.empty()) {
        JsonError(res, 404, "ssp_exe_not_found");
        return;
    }
    if (!ssp.running) {
        ShellExecuteW(NULL, L"open", ssp.exePath.c_str(), NULL,
                      ParentDir(ssp.exePath).c_str(), SW_SHOWNORMAL);
        Sleep(1500);
    }
    sspCacheTick_ = 0;
    Json(res, 200, SspToJson(Ssp()));
}

// POST /api/ssp/script … いま動いているゴーストに、さくらスクリプトをしゃべらせる
void Api::SendScript(const HttpRequest& req, HttpResponse& res) {
    JValue body;
    if (!ParseBody(req, body)) { JsonError(res, 400, "bad_json"); return; }
    std::string script = body["script"].asStr();
    if (script.empty()) { JsonError(res, 400, "no_script"); return; }
    SstpResult r = SstpSend(script, AppName());
    if (!r.ok) { JsonError(res, 502, r.error, r.detail); return; }
    JValue o = JValue::makeObj();
    o.set("ok", JValue::makeBool(true));
    o.set("status", JValue::makeNum(r.status));
    Json(res, 200, o);
}

// POST /api/ssp/notify … イベントを送る
void Api::NotifyEvent(const HttpRequest& req, HttpResponse& res) {
    JValue body;
    if (!ParseBody(req, body)) { JsonError(res, 400, "bad_json"); return; }
    std::string eventName = body["event"].asStr();
    if (eventName.empty()) { JsonError(res, 400, "no_event"); return; }
    std::vector<std::string> refs;
    const JValue& list = body["refs"];
    for (size_t i = 0; i < list.size(); i++) refs.push_back(list.at(i).asStr());
    SstpResult r = SstpNotify(eventName, refs, AppName());
    if (!r.ok) { JsonError(res, 502, r.error, r.detail); return; }
    JValue o = JValue::makeObj();
    o.set("ok", JValue::makeBool(true));
    o.set("status", JValue::makeNum(r.status));
    Json(res, 200, o);
}

// POST /api/ssp/communicate … 他のゴーストのふりをして話しかける（OnCommunicate の確認）
void Api::Communicate(const HttpRequest& req, HttpResponse& res) {
    JValue body;
    if (!ParseBody(req, body)) { JsonError(res, 400, "bad_json"); return; }
    std::string sentence = body["sentence"].asStr();
    if (sentence.empty()) { JsonError(res, 400, "no_sentence"); return; }
    std::string sender = body["sender"].asStr();
    if (sender.empty()) sender = AppName();
    SstpResult r = SstpCommunicate(sentence, sender);
    if (!r.ok) { JsonError(res, 502, r.error, r.detail); return; }
    JValue o = JValue::makeObj();
    o.set("ok", JValue::makeBool(true));
    o.set("status", JValue::makeNum(r.status));
    Json(res, 200, o);
}

// POST /api/ssp/install … SSP の ghost フォルダに書き出して、切りかえる（または読みなおさせる）
void Api::InstallToSsp(const HttpRequest& req, HttpResponse& res) {
    JValue body;
    if (!ParseBody(req, body)) { JsonError(res, 400, "bad_json"); return; }
    const JValue& project = body["project"];
    if (!project.isObj()) { JsonError(res, 400, "no_project"); return; }

    SspInfo ssp = Ssp();
    if (ssp.ghostDir.empty()) {
        JsonError(res, 404, "ssp_not_found");
        return;
    }

    std::string dic = body["dic"].asStr();
    if (dic.empty()) { JsonError(res, 400, "no_dic"); return; }
    // 手書きの YAYA ゴーストにつないだプロジェクトは、そのゴーストに書いて、そのゴーストを読みなおさせる
    std::string linked = Unquote(body["linked"].asStr());
    std::string name = project["meta"]["name"].asStr();
    ExportResult r;
    if (!linked.empty()) {
        std::vector<OutFile> kit = YayaKitFiles();
        r = ExportLinked(Utf8ToWide(linked), RuntimeDic(kit), dic);
        if (!r.ok) { JsonError(res, 400, r.error.empty() ? "export_failed" : r.error, r.detail); return; }
        YayaGhostInfo info = InspectYayaGhost(Utf8ToWide(linked));
        if (!info.name.empty()) name = info.name;
    } else {
        r = ExportToDir(project, ssp.ghostDir, YayaKitFiles(), dic,
                        body["includeShell"].asBool(true),
                        body["overwriteShell"].asBool(false));
        if (!r.ok) { JsonError(res, 500, r.error.empty() ? "export_failed" : r.error, r.detail); return; }
    }

    std::string action = "none";
    if (ssp.sstp && body["activate"].asBool(true) && !name.empty()) {
        bool already = !ssp.ghostName.empty() &&
                       (ssp.ghostName == name ||
                        ssp.ghostName == project["meta"]["sakuraName"].asStr());
        SstpResult sent = already
            ? SstpSend("\\![reload,shiori]", AppName())
            : SstpSend("\\![change,ghost," + name + "]", AppName());
        if (sent.ok) action = already ? "reload" : "change";
        else action = "failed";
    }

    JValue o = JValue::makeObj();
    o.set("root", JValue::makeStr(WideToUtf8(r.root)));
    o.set("folder", JValue::makeStr(r.folder));
    o.set("files", JValue::makeNum((double)r.written.size()));
    o.set("skipped", JValue::makeNum((double)r.skipped.size()));
    o.set("action", JValue::makeStr(action));
    o.set("ssp", SspToJson(ssp));
    Json(res, 200, o);
}

} // namespace ikaga
