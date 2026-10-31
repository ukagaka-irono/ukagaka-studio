#include "api.h"
#include "api_util.h"
#include "assets.h"
#include "fsutil.h"
#include "json.h"
#include "lang.h"
#include "sstp.h"
#include "util.h"

namespace ikaga {

// ------------------------------------------------------------------ 補助

void Json(HttpResponse& res, int status, const JValue& v) {
    res.status = status;
    res.contentType = "application/json; charset=utf-8";
    res.body = v.dump(0);
}

void JsonError(HttpResponse& res, int status, const std::string& code, const std::string& detail) {
    JValue o = JValue::makeObj();
    o.set("error", JValue::makeStr(code));
    if (!detail.empty()) o.set("detail", JValue::makeStr(detail));
    Json(res, status, o);
}

bool ParseBody(const HttpRequest& req, JValue& out) {
    std::string err;
    if (req.body.empty()) { out = JValue::makeObj(); return true; }
    return JsonParse(ToUtf8(req.body), out, err);
}

JValue SspToJson(const SspInfo& ssp) {
    JValue o = JValue::makeObj();
    o.set("running", JValue::makeBool(ssp.running));
    o.set("sstp", JValue::makeBool(ssp.sstp));
    o.set("exe", JValue::makeStr(WideToUtf8(ssp.exePath)));
    o.set("ghostDir", JValue::makeStr(WideToUtf8(ssp.ghostDir)));
    o.set("ghost", JValue::makeStr(ssp.ghostName));
    return o;
}

JValue ReadConfig(const std::wstring& path) {
    std::string text;
    JValue cfg = JValue::makeObj();
    std::string err;
    if (ReadBinaryFile(path, text)) {
        JValue parsed;
        if (JsonParse(ToUtf8(text), parsed, err) && parsed.isObj()) cfg = parsed;
    }
    return cfg;
}

void WriteConfig(const std::wstring& path, const std::string& key, const std::string& value) {
    JValue cfg = ReadConfig(path);
    cfg.set(key, JValue::makeStr(value));
    WriteFileReplacing(path, cfg.dump(2));
}

std::string Unquote(const std::string& raw) {
    std::string s = Trim(raw);
    if (s.size() >= 2 && s[0] == '"' && s[s.size() - 1] == '"') s = s.substr(1, s.size() - 2);
    return s;
}

// ------------------------------------------------------------------ init

void Api::Init() {
    exeDir_ = ExeDir();
    projectsDir_ = PathJoin(exeDir_, L"projects");
    outputDir_ = PathJoin(exeDir_, L"output");
    configPath_ = PathJoin(exeDir_, L"ukagaka-studio.json");
    partsPath_ = PathJoin(exeDir_, L"parts.json");

    EnsureDir(projectsDir_);
}

void Api::PlaceFirstRunSample() {
    if (!ListFiles(projectsDir_, L"*.json").empty()) return;
    const bool en = CurrentLang() == Lang::En;
    std::string sample;
    if (LoadEmbedded(en ? IDR_SAMPLE_PROJECT_EN : IDR_SAMPLE_PROJECT, sample)) {
        WriteBinaryFile(PathJoin(projectsDir_, en ? L"Ikaga.json" : L"いかがちゃん.json"), sample);
    }
}

std::string Api::RuntimeDic(const std::vector<OutFile>& kit) {
    for (size_t i = 0; i < kit.size(); i++) if (kit[i].name == "studio_runtime.dic") return kit[i].data;
    return std::string();
}

std::vector<OutFile> Api::YayaKitFiles() const {
    // 埋めこんだ YAYA 一式のうち、ゴーストに入れるもの（yaya.dll・yaya_base・しくみの辞書）。
    // 「ためす」だけが使う yaya_host.exe と studio_preview.dic は入れません
    std::vector<OutFile> out;
    for (int i = 0; i < YayaKitCount(); i++) {
        std::wstring name = YayaKitName(i);
        if (name == L"yaya_host.exe" || name == L"studio_preview.dic") continue;
        OutFile f;
        f.shell = false;
        for (size_t k = 0; k < name.size(); k++) if (name[k] == L'\\') name[k] = L'/';
        f.name = WideToUtf8(name);
        if (!LoadEmbedded(YayaKitId(i), f.data)) continue;
        out.push_back(f);
    }
    return out;
}

std::wstring Api::DefaultOutDir() const {
    std::string last = ReadConfig(configPath_)["lastOutDir"].asStr();
    if (!last.empty()) return Utf8ToWide(last);
    SspInfo ssp = Ssp();
    return ssp.ghostDir.empty() ? outputDir_ : ssp.ghostDir;
}

SspInfo Api::Ssp() const {
    unsigned long now = GetTickCount();
    if (sspCacheTick_ != 0 && now - sspCacheTick_ < 2000) return sspCache_;

    std::wstring hint = Utf8ToWide(ReadConfig(configPath_)["sspPath"].asStr());
    sspCache_ = DetectSsp(hint);
    sspCacheTick_ = now;
    return sspCache_;
}

JValue Api::LoadConfig() const { return ReadConfig(configPath_); }

void Api::SaveConfig(const std::string& key, const JValue& value) {
    JValue cfg = ReadConfig(configPath_);
    cfg.set(key, value);
    WriteFileReplacing(configPath_, cfg.dump(2));
}

// ------------------------------------------------------------------ 配信

void Api::Handle(const HttpRequest& req, HttpResponse& res) {
    if (req.path.compare(0, 5, "/api/") == 0) {
        HandleApi(req, res);
        return;
    }
    std::string data, mime;
    if (FindWebAsset(req.path, data, mime)) {
        res.status = 200;
        res.contentType = mime;
        res.body = data;
        return;
    }
    res.status = 404;
    res.contentType = "text/plain; charset=utf-8";
    res.body = "not found";
}

// 受け口の一覧。足すときは api.h に関数を書き、ここに 1 行足します。
const Api::Route Api::kRoutes[] = {
    // api_project.cpp
    { "GET",  "/api/state",          &Api::GetState },
    { "GET",  "/api/project",        &Api::GetProject },
    { "POST", "/api/project",        &Api::SaveProject },
    { "POST", "/api/project/delete", &Api::DeleteProject },
    { "GET",  "/api/project/history", &Api::GetProjectHistory },
    { "GET",  "/api/project/version", &Api::GetProjectVersion },
    { "GET",  "/api/parts",          &Api::GetParts },
    { "POST", "/api/parts",          &Api::SaveParts },
    { "POST", "/api/import",         &Api::ImportProject },
    // api_shell.cpp
    { "GET",  "/api/shell",          &Api::RenderShell },
    { "GET",  "/api/shell/areas",    &Api::ShellAreas },
    { "POST", "/api/shell/pick",     &Api::PickShellImages },
    { "GET",  "/api/shell/file",     &Api::GetShellFile },
    // api_ghost.cpp
    { "POST", "/api/preview",        &Api::Preview },
    { "POST", "/api/save/reset",     &Api::ResetGhostSave },
    { "POST", "/api/ghost/log",      &Api::GhostLog },
    // api_export.cpp
    { "POST", "/api/export",         &Api::Export },
    { "POST", "/api/yaya/inspect",   &Api::InspectYaya },
    { "POST", "/api/yaya/dics",      &Api::ReadYayaDics },
    { "POST", "/api/shell/import",   &Api::ImportShell },
    { "POST", "/api/reveal",         &Api::Reveal },
    // api_ssp.cpp
    { "GET",  "/api/ssp",            &Api::GetSsp },
    { "POST", "/api/ssp/path",       &Api::SetSspPath },
    { "POST", "/api/ssp/launch",     &Api::LaunchSsp },
    { "POST", "/api/ssp/script",     &Api::SendScript },
    { "POST", "/api/ssp/notify",     &Api::NotifyEvent },
    { "POST", "/api/ssp/communicate", &Api::Communicate },
    { "POST", "/api/ssp/install",    &Api::InstallToSsp },
};

void Api::HandleApi(const HttpRequest& req, HttpResponse& res) {
    // 他のページから勝手に叩かれないようにする。通すのは
    //   ・画面の JS が付ける独自ヘッダ（外のページからは付けられません）
    //   ・自分の画面から出た要求（画像の <img src> はヘッダを付けられないので、こちら）
    // のどちらかだけ。GET も同じ扱いにします（読めなくても、送れること自体を許さない）。
    std::map<std::string, std::string>::const_iterator it = req.headers.find("x-ikaga");
    bool marked = (it != req.headers.end() && it->second == "1");
    if (!marked && !req.sameOrigin) {
        JsonError(res, 403, "bad_origin");
        return;
    }

    for (size_t i = 0; i < sizeof(kRoutes) / sizeof(kRoutes[0]); i++) {
        if (req.path == kRoutes[i].path && req.method == kRoutes[i].method) {
            (this->*kRoutes[i].handler)(req, res);
            return;
        }
    }
    JsonError(res, 404, "unknown_endpoint", req.path);
}

} // namespace ikaga
