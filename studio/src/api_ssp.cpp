// 伺かスタジオ - 動いている SSP との連携（見つける・起動する・SSTP で話す・ゴーストを入れる）
#include "api.h"
#include "api_util.h"
#include "exporter.h"
#include "fsutil.h"
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
    if (!ParseBody(req, body)) { JsonError(res, 400, "JSON が壊れています"); return; }
    WriteConfig(configPath_, "sspPath", Unquote(body["path"].asStr()));
    sspCacheTick_ = 0;                       // すぐ探しなおす
    Json(res, 200, SspToJson(Ssp()));
}

// POST /api/ssp/launch
void Api::LaunchSsp(const HttpRequest&, HttpResponse& res) {
    SspInfo ssp = Ssp();
    if (ssp.exePath.empty()) {
        JsonError(res, 404, "ssp.exe が見つかりません。SSP の場所を指定してください。");
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
    if (!ParseBody(req, body)) { JsonError(res, 400, "JSON が壊れています"); return; }
    std::string script = body["script"].asStr();
    if (script.empty()) { JsonError(res, 400, "スクリプトがありません"); return; }
    SstpResult r = SstpSend(script, "伺かスタジオ");
    if (!r.ok) { JsonError(res, 502, r.error); return; }
    JValue o = JValue::makeObj();
    o.set("ok", JValue::makeBool(true));
    o.set("status", JValue::makeNum(r.status));
    Json(res, 200, o);
}

// POST /api/ssp/notify … イベントを送る
void Api::NotifyEvent(const HttpRequest& req, HttpResponse& res) {
    JValue body;
    if (!ParseBody(req, body)) { JsonError(res, 400, "JSON が壊れています"); return; }
    std::string eventName = body["event"].asStr();
    if (eventName.empty()) { JsonError(res, 400, "イベント名がありません"); return; }
    std::vector<std::string> refs;
    const JValue& list = body["refs"];
    for (size_t i = 0; i < list.size(); i++) refs.push_back(list.at(i).asStr());
    SstpResult r = SstpNotify(eventName, refs, "伺かスタジオ");
    if (!r.ok) { JsonError(res, 502, r.error); return; }
    JValue o = JValue::makeObj();
    o.set("ok", JValue::makeBool(true));
    o.set("status", JValue::makeNum(r.status));
    Json(res, 200, o);
}

// POST /api/ssp/communicate … 他のゴーストのふりをして話しかける（OnCommunicate の確認）
void Api::Communicate(const HttpRequest& req, HttpResponse& res) {
    JValue body;
    if (!ParseBody(req, body)) { JsonError(res, 400, "JSON が壊れています"); return; }
    std::string sentence = body["sentence"].asStr();
    if (sentence.empty()) { JsonError(res, 400, "話しかける内容がありません"); return; }
    std::string sender = body["sender"].asStr();
    if (sender.empty()) sender = "伺かスタジオ";
    SstpResult r = SstpCommunicate(sentence, sender);
    if (!r.ok) { JsonError(res, 502, r.error); return; }
    JValue o = JValue::makeObj();
    o.set("ok", JValue::makeBool(true));
    o.set("status", JValue::makeNum(r.status));
    Json(res, 200, o);
}

// POST /api/ssp/install … SSP の ghost フォルダに書き出して、切りかえる（または読みなおさせる）
void Api::InstallToSsp(const HttpRequest& req, HttpResponse& res) {
    JValue body;
    if (!ParseBody(req, body)) { JsonError(res, 400, "JSON が壊れています"); return; }
    const JValue& project = body["project"];
    if (!project.isObj()) { JsonError(res, 400, "プロジェクトがありません"); return; }

    SspInfo ssp = Ssp();
    if (ssp.ghostDir.empty()) {
        JsonError(res, 404, "SSP が見つかりません。SSP の場所を指定してください。");
        return;
    }

    std::string dll = DllBytes();
    ExportResult r = ExportToDir(project, ssp.ghostDir, dll,
                                 body["includeShell"].asBool(true),
                                 body["overwriteShell"].asBool(false));
    if (!r.ok) { JsonError(res, 500, r.error.empty() ? "書き出しに失敗しました" : r.error); return; }

    std::string name = project["meta"]["name"].asStr();
    std::string action = "none";
    if (ssp.sstp && body["activate"].asBool(true) && !name.empty()) {
        bool already = !ssp.ghostName.empty() &&
                       (ssp.ghostName == name ||
                        ssp.ghostName == project["meta"]["sakuraName"].asStr());
        SstpResult sent = already
            ? SstpSend("\\![reload,shiori]", "伺かスタジオ")
            : SstpSend("\\![change,ghost," + name + "]", "伺かスタジオ");
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
