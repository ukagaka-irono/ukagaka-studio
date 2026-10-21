// 伺かスタジオ - 立ち絵（仮シェルのリアルタイム描画・用意した画像）
#include "api.h"
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
