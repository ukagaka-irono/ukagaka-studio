// 伺かスタジオ - プロジェクトの前の版
//
// プロジェクト（projects\<名前>.json）を上書きする前に、いまの中身を
// projects\.history\<名前>\<日時>.json に残しておきます。「開く」の「前の版」から開けます。
//
//   ・手で保存したときは、いつも残す
//   ・自動保存（1 分ごと）のときは、いちばん新しい版から 10 分たっていれば残す（増えすぎないように）
//   ・中身が同じなら残さない。1 つのプロジェクトにつき、新しいほうから 30 こまで
#pragma once

#include <string>
#include <vector>

namespace ikaga {

struct ProjectVersion {
    std::wstring id;          // 20261022-171234 のような日時（ファイル名）
    std::string time;         // 2026-10-22T17:12:34（画面に出す）
    unsigned long long size = 0;
};

const int kHistoryMinGapSec = 600;   // 自動保存で版を残す間隔
const int kHistoryMaxKeep = 30;      // 1 つのプロジェクトにつき残す版の数

// file（projects\<名前>.json）を newText で上書きする前に呼ぶ。版を残したら true
bool KeepProjectVersion(const std::wstring& projectsDir, const std::wstring& name, const std::string& newText,
                        bool manual, int minGapSec = kHistoryMinGapSec, int maxKeep = kHistoryMaxKeep);

// 新しい順
std::vector<ProjectVersion> ListProjectVersions(const std::wstring& projectsDir, const std::wstring& name);

bool ReadProjectVersion(const std::wstring& projectsDir, const std::wstring& name, const std::wstring& id,
                        std::string& out);

// プロジェクトを消したときに、前の版もまとめて消す
void DeleteProjectVersions(const std::wstring& projectsDir, const std::wstring& name);

} // namespace ikaga
