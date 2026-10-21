// 伺かスタジオ - /api/* と UI ファイルの配信
//
// 受け口（パスと関数の対応表）は api.cpp の kRoutes にあります。
// 中身は用事ごとにファイルを分けています。
//
//   api_project.cpp … 状態・プロジェクトの保存と読みこみ
//   api_shell.cpp   … 立ち絵（仮シェルの描画・用意した画像）
//   api_ghost.cpp   … ためす・書き出したゴーストの記憶と記録
//   api_export.cpp  … 書き出し・エクスプローラで開く
//   api_ssp.cpp     … 動いている SSP との連携
#pragma once

#include "webreq.h"
#include "json.h"
#include "sstp.h"

#include <string>

namespace ikaga {

class Api {
public:
    void Init();
    void Handle(const HttpRequest& req, HttpResponse& res);

    const std::wstring& projectsDir() const { return projectsDir_; }
    const std::wstring& outputDir() const { return outputDir_; }

    // ウィンドウの大きさなどの記憶用
    JValue LoadConfig() const;
    void SaveConfig(const std::string& key, const JValue& value);

private:
    typedef void (Api::*Handler)(const HttpRequest& req, HttpResponse& res);
    struct Route { const char* method; const char* path; Handler handler; };
    static const Route kRoutes[];

    void HandleApi(const HttpRequest& req, HttpResponse& res);
    std::string DllBytes() const;
    std::wstring DefaultOutDir() const;
    SspInfo Ssp() const;

    // api_project.cpp
    void GetState(const HttpRequest& req, HttpResponse& res);
    void GetProject(const HttpRequest& req, HttpResponse& res);
    void SaveProject(const HttpRequest& req, HttpResponse& res);
    void DeleteProject(const HttpRequest& req, HttpResponse& res);
    void ImportProject(const HttpRequest& req, HttpResponse& res);

    // api_shell.cpp
    void RenderShell(const HttpRequest& req, HttpResponse& res);
    void PickShellImages(const HttpRequest& req, HttpResponse& res);
    void GetShellFile(const HttpRequest& req, HttpResponse& res);

    // api_ghost.cpp
    void Preview(const HttpRequest& req, HttpResponse& res);
    void ResetGhostSave(const HttpRequest& req, HttpResponse& res);
    void GhostLog(const HttpRequest& req, HttpResponse& res);

    // api_export.cpp
    void Export(const HttpRequest& req, HttpResponse& res);
    void Reveal(const HttpRequest& req, HttpResponse& res);

    // api_ssp.cpp
    void GetSsp(const HttpRequest& req, HttpResponse& res);
    void SetSspPath(const HttpRequest& req, HttpResponse& res);
    void LaunchSsp(const HttpRequest& req, HttpResponse& res);
    void SendScript(const HttpRequest& req, HttpResponse& res);
    void NotifyEvent(const HttpRequest& req, HttpResponse& res);
    void Communicate(const HttpRequest& req, HttpResponse& res);
    void InstallToSsp(const HttpRequest& req, HttpResponse& res);

    std::wstring exeDir_;
    std::wstring projectsDir_;
    std::wstring outputDir_;
    std::wstring configPath_;

    // 短時間に何度も探しにいかないための控え
    mutable SspInfo sspCache_;
    mutable unsigned long sspCacheTick_ = 0;
};

} // namespace ikaga
