// 伺かスタジオ - 状態・プロジェクトの保存と読みこみ
#include "api.h"
#include "api_util.h"
#include "exporter.h"
#include "fsutil.h"
#include "project_history.h"
#include "util.h"
#include "version_gen.h"

#include <algorithm>

namespace ikaga {

static const char* kStudioVersion = STUDIO_VERSION;   // VERSION の中身（embed.ps1 が version_gen.h に書く）

// GET /api/state … 起動したときに画面が読む（栞の有無・プロジェクトの一覧・SSP）
void Api::GetState(const HttpRequest&, HttpResponse& res) {
    JValue o = JValue::makeObj();
    bool kit = !YayaKitFiles().empty();
    o.set("dllFound", JValue::makeBool(kit));
    o.set("dll", JValue::makeStr(kit ? "yaya.dll" : ""));
    o.set("version", JValue::makeStr(kStudioVersion));

    JValue list = JValue::makeArr();
    std::vector<FileInfo> files = ListFiles(projectsDir_, L"*.json");
    std::sort(files.begin(), files.end(), [](const FileInfo& a, const FileInfo& b) {
        return CompareFileTime(&a.modified, &b.modified) > 0;
    });
    for (size_t i = 0; i < files.size(); i++) {
        std::wstring stem = files[i].name.substr(0, files[i].name.size() - 5);
        std::string title = WideToUtf8(stem);
        std::string text;
        if (ReadBinaryFile(PathJoin(projectsDir_, files[i].name), text)) {
            JValue p;
            std::string err;
            if (JsonParse(ToUtf8(text), p, err)) {
                std::string name = p["meta"]["name"].asStr();
                if (!name.empty()) title = name;
            }
        }
        JValue one = JValue::makeObj();
        one.set("file", JValue::makeStr(WideToUtf8(stem)));
        one.set("title", JValue::makeStr(title));
        one.set("updated", JValue::makeStr(FileTimeToIso(files[i].modified)));
        list.arr.push_back(one);
    }
    o.set("projects", list);
    o.set("defaultOutDir", JValue::makeStr(WideToUtf8(DefaultOutDir())));
    SspInfo ssp = Ssp();
    o.set("ssp", SspToJson(ssp));
    o.set("sspGhostDir", ssp.ghostDir.empty() ? JValue() : JValue::makeStr(WideToUtf8(ssp.ghostDir)));
    JValue cfg = ReadConfig(configPath_);
    o.set("lastProject", cfg["lastProject"]);
    Json(res, 200, o);
}

// GET /api/project?name=… … 保存したプロジェクトをそのまま返す
void Api::GetProject(const HttpRequest& req, HttpResponse& res) {
    std::map<std::string, std::string>::const_iterator it = req.query.find("name");
    std::string name = it == req.query.end() ? "" : SafeFolderName(it->second, "");
    std::wstring file = PathJoin(projectsDir_, Utf8ToWide(name) + L".json");
    std::string text;
    if (name.empty() || !ReadBinaryFile(file, text)) {
        JsonError(res, 404, "project_not_found");
        return;
    }
    res.status = 200;
    res.contentType = "application/json; charset=utf-8";
    res.body = ToUtf8(text);
}

// POST /api/project … projects\<名前>.json に保存する
void Api::SaveProject(const HttpRequest& req, HttpResponse& res) {
    JValue body;
    if (!ParseBody(req, body)) { JsonError(res, 400, "bad_json"); return; }
    std::string name = body["name"].asStr();
    if (name.empty()) name = body["project"]["meta"]["name"].asStr();
    name = SafeFolderName(name, "");
    if (name.empty()) { JsonError(res, 400, "no_name"); return; }
    EnsureDir(projectsDir_);
    std::wstring file = PathJoin(projectsDir_, Utf8ToWide(name) + L".json");
    std::string text = body["project"].dump(2);
    // 上書きする前のものを、前の版として残す（自動保存のときは 10 分おき。project_history.h）
    KeepProjectVersion(projectsDir_, Utf8ToWide(name), text, !body["auto"].asBool(false));
    if (!WriteBinaryFile(file, text)) {
        JsonError(res, 500, "save_failed");
        return;
    }
    WriteConfig(configPath_, "lastProject", name);
    JValue o = JValue::makeObj();
    o.set("saved", JValue::makeStr(name));
    o.set("path", JValue::makeStr(WideToUtf8(file)));
    Json(res, 200, o);
}

// POST /api/project/delete
void Api::DeleteProject(const HttpRequest& req, HttpResponse& res) {
    JValue body;
    if (!ParseBody(req, body)) { JsonError(res, 400, "bad_json"); return; }
    std::string name = SafeFolderName(body["name"].asStr(), "");
    std::wstring file = PathJoin(projectsDir_, Utf8ToWide(name) + L".json");
    if (name.empty() || !DeleteFileIfExists(file)) {
        JsonError(res, 404, "project_not_found");
        return;
    }
    DeleteProjectVersions(projectsDir_, Utf8ToWide(name));
    JValue o = JValue::makeObj();
    o.set("deleted", JValue::makeStr(name));
    Json(res, 200, o);
}

static std::string QueryOf(const HttpRequest& req, const char* key) {
    std::map<std::string, std::string>::const_iterator it = req.query.find(key);
    return it == req.query.end() ? "" : it->second;
}

// GET /api/project/history?name=… … 前の版の一覧（新しい順）。かたまりの数も添える
void Api::GetProjectHistory(const HttpRequest& req, HttpResponse& res) {
    std::string name = SafeFolderName(QueryOf(req, "name"), "");
    if (name.empty()) { JsonError(res, 404, "project_not_found"); return; }
    JValue list = JValue::makeArr();
    for (const ProjectVersion& v : ListProjectVersions(projectsDir_, Utf8ToWide(name))) {
        JValue one = JValue::makeObj();
        one.set("id", JValue::makeStr(WideToUtf8(v.id)));
        one.set("time", JValue::makeStr(v.time));
        one.set("size", JValue::makeNum((double)v.size));
        std::string text;
        JValue p;
        std::string err;
        if (ReadProjectVersion(projectsDir_, Utf8ToWide(name), v.id, text) && JsonParse(ToUtf8(text), p, err)) {
            one.set("scripts", JValue::makeNum(p["scripts"].isArr() ? (double)p["scripts"].arr.size() : 0));
        }
        list.arr.push_back(one);
    }
    JValue o = JValue::makeObj();
    o.set("versions", list);
    Json(res, 200, o);
}

// GET /api/project/version?name=…&id=… … 前の版の中身をそのまま返す
void Api::GetProjectVersion(const HttpRequest& req, HttpResponse& res) {
    std::string name = SafeFolderName(QueryOf(req, "name"), "");
    std::string text;
    if (name.empty() || !ReadProjectVersion(projectsDir_, Utf8ToWide(name), Utf8ToWide(QueryOf(req, "id")), text)) {
        JsonError(res, 404, "version_not_found");
        return;
    }
    res.status = 200;
    res.contentType = "application/json; charset=utf-8";
    res.body = ToUtf8(text);
}

// POST /api/import … ghost.json のファイルか、書き出したゴーストのフォルダから読みこむ
void Api::ImportProject(const HttpRequest& req, HttpResponse& res) {
    JValue body;
    if (!ParseBody(req, body)) { JsonError(res, 400, "bad_json"); return; }
    std::string raw = Unquote(body["path"].asStr());
    if (raw.empty()) { JsonError(res, 400, "no_path"); return; }
    std::wstring target = Utf8ToWide(raw);
    if (IsDirectory(target)) {
        const wchar_t* rel[] = { L"ghost.json", L"ghost\\master\\ghost.json", L"master\\ghost.json" };
        for (int i = 0; i < 3; i++) {
            std::wstring c = PathJoin(target, rel[i]);
            if (PathExists(c)) { target = c; break; }
        }
    }
    std::string text;
    if (!ReadBinaryFile(target, text)) { JsonError(res, 400, "read_failed", raw); return; }
    JValue project;
    std::string err;
    if (!JsonParse(ToUtf8(text), project, err)) {
        JsonError(res, 400, "json_unreadable", err);
        return;
    }
    JValue o = JValue::makeObj();
    o.set("project", project);
    o.set("path", JValue::makeStr(WideToUtf8(target)));
    Json(res, 200, o);
}

// GET /api/parts … 部品の一覧（exe のとなりの parts.json。無ければ空）
void Api::GetParts(const HttpRequest&, HttpResponse& res) {
    JValue o = JValue::makeObj();
    std::string text;
    JValue saved;
    std::string err;
    if (ReadBinaryFile(partsPath_, text) && JsonParse(ToUtf8(text), saved, err) && saved["parts"].isArr()) {
        o.set("parts", saved["parts"]);
    } else {
        o.set("parts", JValue::makeArr());
    }
    Json(res, 200, o);
}

// POST /api/parts … 部品の一覧をまるごと書く（{"parts":[…]}）
void Api::SaveParts(const HttpRequest& req, HttpResponse& res) {
    JValue body;
    if (!ParseBody(req, body) || !body["parts"].isArr()) { JsonError(res, 400, "bad_json"); return; }
    JValue o = JValue::makeObj();
    o.set("parts", body["parts"]);
    if (!WriteBinaryFile(partsPath_, o.dump(2))) { JsonError(res, 500, "save_failed"); return; }
    Json(res, 200, o);
}

} // namespace ikaga
