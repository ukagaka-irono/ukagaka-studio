// 伺かスタジオ - プロジェクトの前の版（くわしくは project_history.h）
#include "project_history.h"
#include "fsutil.h"

#include <algorithm>
#include <cstdio>

namespace ikaga {

static std::wstring HistoryDir(const std::wstring& projectsDir, const std::wstring& name) {
    return PathJoin(PathJoin(projectsDir, L".history"), name);
}

// 版の id はファイル名の日時。数字と - だけ（画面から来た id で、フォルダの外を指させないため）
static bool IdOk(const std::wstring& id) {
    if (id.empty() || id.size() > 40) return false;
    for (wchar_t c : id) {
        if (!((c >= L'0' && c <= L'9') || c == L'-')) return false;
    }
    return true;
}

static std::wstring NowId() {
    SYSTEMTIME st;
    GetLocalTime(&st);
    wchar_t buf[32];
    swprintf_s(buf, L"%04d%02d%02d-%02d%02d%02d", st.wYear, st.wMonth, st.wDay, st.wHour, st.wMinute, st.wSecond);
    return buf;
}

// 20261022-171234 → 2026-10-22T17:12:34（同じ秒の 2 つめに付く -2 などは外す）
static std::string IdToTime(const std::wstring& id) {
    if (id.size() < 15) return "";
    std::string s;
    for (size_t i = 0; i < 15; i++) s += (char)id[i];   // IdOk を通った id は数字と - だけ
    return s.substr(0, 4) + "-" + s.substr(4, 2) + "-" + s.substr(6, 2) + "T" +
           s.substr(9, 2) + ":" + s.substr(11, 2) + ":" + s.substr(13, 2);
}

// FILETIME の差（秒）
static long long SecondsBetween(const FILETIME& older, const FILETIME& newer) {
    ULARGE_INTEGER a, b;
    a.LowPart = older.dwLowDateTime; a.HighPart = older.dwHighDateTime;
    b.LowPart = newer.dwLowDateTime; b.HighPart = newer.dwHighDateTime;
    return (long long)(b.QuadPart - a.QuadPart) / 10000000LL;
}

std::vector<ProjectVersion> ListProjectVersions(const std::wstring& projectsDir, const std::wstring& name) {
    std::vector<ProjectVersion> out;
    for (const FileInfo& f : ListFiles(HistoryDir(projectsDir, name), L"*.json")) {
        std::wstring id = f.name.substr(0, f.name.size() - 5);
        if (!IdOk(id)) continue;
        ProjectVersion v;
        v.id = id;
        v.time = IdToTime(id);
        v.size = f.size;
        out.push_back(v);
    }
    // id は日時なので、文字の順がそのまま時の順（同じ秒の -2 は、その秒のあと）
    std::sort(out.begin(), out.end(), [](const ProjectVersion& a, const ProjectVersion& b) { return a.id > b.id; });
    return out;
}

bool KeepProjectVersion(const std::wstring& projectsDir, const std::wstring& name, const std::string& newText,
                        bool manual, int minGapSec, int maxKeep) {
    std::string current;
    if (!ReadBinaryFile(PathJoin(projectsDir, name + L".json"), current)) return false;   // はじめての保存
    if (current == newText) return false;                                                // 変わっていない

    std::wstring dir = HistoryDir(projectsDir, name);
    std::vector<FileInfo> files = ListFiles(dir, L"*.json");
    if (!manual && !files.empty()) {
        FILETIME now;
        GetSystemTimeAsFileTime(&now);
        FILETIME newest = files[0].modified;
        for (const FileInfo& f : files) {
            if (CompareFileTime(&f.modified, &newest) > 0) newest = f.modified;
        }
        if (SecondsBetween(newest, now) < minGapSec) return false;
    }

    if (!EnsureDir(dir)) return false;
    std::wstring id = NowId();
    for (int n = 2; PathExists(PathJoin(dir, id + L".json")) && n < 100; n++) {
        id = NowId() + L"-" + std::to_wstring(n);
    }
    if (!WriteBinaryFile(PathJoin(dir, id + L".json"), current)) return false;

    // 古いものから消して、maxKeep こまでにする
    std::vector<ProjectVersion> all = ListProjectVersions(projectsDir, name);
    for (size_t i = (size_t)(maxKeep > 1 ? maxKeep : 1); i < all.size(); i++) {
        DeleteFileIfExists(PathJoin(dir, all[i].id + L".json"));
    }
    return true;
}

bool ReadProjectVersion(const std::wstring& projectsDir, const std::wstring& name, const std::wstring& id,
                        std::string& out) {
    if (!IdOk(id)) return false;
    return ReadBinaryFile(PathJoin(HistoryDir(projectsDir, name), id + L".json"), out);
}

void DeleteProjectVersions(const std::wstring& projectsDir, const std::wstring& name) {
    std::wstring dir = HistoryDir(projectsDir, name);
    for (const FileInfo& f : ListFiles(dir, L"*.json")) DeleteFileIfExists(PathJoin(dir, f.name));
    RemoveDirectoryW(dir.c_str());   // 空になっていれば消える
}

} // namespace ikaga
