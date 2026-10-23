// 伺かスタジオ - 立ち絵（仮シェルのリアルタイム描画・用意した画像）
#include "api.h"
#include "shell_import.h"
#include "api_util.h"
#include "exporter.h"
#include "fsutil.h"
#include "image.h"
#include "util.h"

#include <cstdlib>

namespace ikaga {

// GET /api/shell?id=…&hair=…&cloth=… … 仮シェルの立ち絵を 1 枚描いて返す
void Api::RenderShell(const HttpRequest& req, HttpResponse& res) {
    std::map<std::string, std::string>::const_iterator it;
    int id = 0;
    it = req.query.find("id");
    if (it != req.query.end()) id = atoi(it->second.c_str());
    it = req.query.find("hair");
    std::string hair = it == req.query.end() ? "" : it->second;
    it = req.query.find("cloth");
    std::string cloth = it == req.query.end() ? "" : it->second;
    res.status = 200;
    res.contentType = "image/png";
    res.cacheable = true;  // 色が変われば URL も変わるので、そのままキャッシュしてよい
    res.body = RenderSurfacePng(id, hair, cloth);
}

// GET /api/shell/areas?w=…&h=… … その大きさの絵の、自動の当たり判定（書き出しと同じ DefaultHitAreas）
void Api::ShellAreas(const HttpRequest& req, HttpResponse& res) {
    std::map<std::string, std::string>::const_iterator it;
    int w = 0, h = 0;
    if ((it = req.query.find("w")) != req.query.end()) w = atoi(it->second.c_str());
    if ((it = req.query.find("h")) != req.query.end()) h = atoi(it->second.c_str());
    if (w < 1 || h < 1 || w > 10000 || h > 10000) { JsonError(res, 400, "bad_size"); return; }
    JValue list = JValue::makeArr();
    for (const HitArea& a : DefaultHitAreas(w, h)) {
        JValue one = JValue::makeObj();
        one.set("name", JValue::makeStr(a.name));
        one.set("x1", JValue::makeNum(a.x1)); one.set("y1", JValue::makeNum(a.y1));
        one.set("x2", JValue::makeNum(a.x2)); one.set("y2", JValue::makeNum(a.y2));
        list.arr.push_back(one);
    }
    JValue o = JValue::makeObj();
    o.set("areas", list);
    Json(res, 200, o);
}

// POST /api/shell/pick … 用意した PNG を選ぶ（Windows のいつものダイアログを出す）
void Api::PickShellImages(const HttpRequest&, HttpResponse& res) {
    std::vector<std::wstring> picked = PickPngFiles();
    JValue o = JValue::makeObj();
    JValue arr = JValue::makeArr();
    for (size_t i = 0; i < picked.size(); i++) {
        std::string data;
        int w = 0, h = 0;
        if (!ReadBinaryFile(picked[i], data) || !PngSize(data, &w, &h)) continue;
        JValue one = JValue::makeObj();
        one.set("path", JValue::makeStr(WideToUtf8(picked[i])));
        one.set("name", JValue::makeStr(WideToUtf8(FileNameOf(picked[i]))));
        one.set("width", JValue::makeNum(w));
        one.set("height", JValue::makeNum(h));
        arr.arr.push_back(one);
    }
    o.set("files", arr);
    Json(res, 200, o);
}

// POST /api/shell/import … いまあるシェルのフォルダから、番号ごとの立ち絵を集める（shell_import.h）
void Api::ImportShell(const HttpRequest& req, HttpResponse& res) {
    JValue body;
    if (!ParseBody(req, body)) { JsonError(res, 400, "bad_json"); return; }
    std::string raw = Unquote(body["path"].asStr());
    if (raw.empty()) { JsonError(res, 400, "no_path"); return; }
    ShellImport r = ImportShellFolder(Utf8ToWide(raw));
    if (!r.ok) { JsonError(res, 404, r.error, raw); return; }
    JValue o = JValue::makeObj();
    o.set("folder", JValue::makeStr(WideToUtf8(r.folder)));
    JValue arr = JValue::makeArr();
    for (size_t i = 0; i < r.images.size(); i++) {
        JValue one = JValue::makeObj();
        one.set("id", JValue::makeNum(r.images[i].id));
        one.set("path", JValue::makeStr(WideToUtf8(r.images[i].path)));
        one.set("name", JValue::makeStr(r.images[i].name));
        one.set("width", JValue::makeNum(r.images[i].width));
        one.set("height", JValue::makeNum(r.images[i].height));
        arr.arr.push_back(one);
    }
    o.set("images", arr);
    JValue comp = JValue::makeArr();
    for (size_t i = 0; i < r.compositeOnly.size(); i++) comp.arr.push_back(JValue::makeNum(r.compositeOnly[i]));
    o.set("compositeOnly", comp);
    JValue bad = JValue::makeArr();
    for (size_t i = 0; i < r.unreadable.size(); i++) bad.arr.push_back(JValue::makeStr(r.unreadable[i]));
    o.set("unreadable", bad);
    o.set("areas", r.areas);              // 四角い当たり判定（shell.areas の形）
    o.set("animations", r.animations);    // うごき（animations の形）
    o.set("skipped", JValue::makeNum(r.skipped));
    Json(res, 200, o);
}

// GET /api/shell/file?path=… … 選んだ画像を画面に出すため、そのまま返す
void Api::GetShellFile(const HttpRequest& req, HttpResponse& res) {
    std::map<std::string, std::string>::const_iterator it = req.query.find("path");
    std::wstring path = it == req.query.end() ? std::wstring() : Utf8ToWide(it->second);
    std::string data;
    int w = 0, h = 0;
    if (path.empty() || !ReadBinaryFile(path, data) || !PngSize(data, &w, &h)) {
        JsonError(res, 404, "image_unreadable");
        return;
    }
    res.status = 200;
    res.contentType = "image/png";
    res.body = data;
}

} // namespace ikaga
