// 伺かスタジオ - いまあるシェルのフォルダを読みこむ（shell_import.h を見てください）
#include "shell_import.h"

#include "fsutil.h"
#include "image.h"
#include "util.h"

#include <algorithm>

namespace ikaga {

static const int kMaxSurface = 99999;   // これより大きい番号は、数えまちがいとみなす
static const int kMaxRange = 2000;      // surfaces.txt の「100-200」のような範囲の、広げてよい数

static bool HasShellFiles(const std::wstring& dir) {
    if (PathExists(PathJoin(dir, L"surfaces.txt"))) return true;
    return !ListFiles(dir, L"surface*.png").empty();
}

static std::wstring FindShellDir(const std::wstring& path) {
    if (HasShellFiles(path)) return path;
    std::wstring shell = PathJoin(path, L"shell");
    std::wstring master = PathJoin(shell, L"master");
    if (HasShellFiles(master)) return master;
    // master が無ければ、shell の中で最初に見つかったもの
    WIN32_FIND_DATAW fd;
    HANDLE h = FindFirstFileW(PathJoin(shell, L"*").c_str(), &fd);
    std::wstring found;
    if (h != INVALID_HANDLE_VALUE) {
        do {
            if (!(fd.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) || fd.cFileName[0] == L'.') continue;
            std::wstring d = PathJoin(shell, fd.cFileName);
            if (HasShellFiles(d)) { found = d; break; }
        } while (FindNextFileW(h, &fd));
        FindClose(h);
    }
    return found;
}

// "surface0010.png" → 10。番号の絵でなければ -1
static int SurfaceNumber(const std::wstring& name) {
    std::wstring low = name;
    for (size_t i = 0; i < low.size(); i++) low[i] = (wchar_t)towlower(low[i]);
    if (low.size() < 12 || low.compare(0, 7, L"surface") != 0 || low.compare(low.size() - 4, 4, L".png") != 0) return -1;
    std::wstring num = low.substr(7, low.size() - 11);
    if (num.empty() || num.size() > 9) return -1;
    for (size_t i = 0; i < num.size(); i++) if (num[i] < L'0' || num[i] > L'9') return -1;
    int n = _wtoi(num.c_str());
    return n <= kMaxSurface ? n : -1;
}

// surfaces.txt の「surface0」「surface10,11,12」「surface100-110」「surface.append0」の番号を集める
static void SurfacesTxtNumbers(const std::string& text, std::vector<int>& out) {
    size_t pos = 0;
    while (pos <= text.size()) {
        size_t e = text.find('\n', pos);
        std::string line = Trim(text.substr(pos, e == std::string::npos ? std::string::npos : e - pos));
        pos = (e == std::string::npos) ? text.size() + 1 : e + 1;
        std::string low = line;
        for (size_t i = 0; i < low.size(); i++) if (low[i] >= 'A' && low[i] <= 'Z') low[i] = (char)(low[i] - 'A' + 'a');
        if (low.compare(0, 7, "surface") != 0) continue;
        std::string rest = low.substr(7);
        if (rest.compare(0, 7, ".append") == 0) rest = rest.substr(7);
        if (rest.empty() || rest.find_first_not_of("0123456789,- \t") != std::string::npos) continue;
        // カンマで分けて、a-b は広げる
        size_t p = 0;
        while (p <= rest.size()) {
            size_t c = rest.find(',', p);
            std::string part = Trim(rest.substr(p, c == std::string::npos ? std::string::npos : c - p));
            p = (c == std::string::npos) ? rest.size() + 1 : c + 1;
            if (part.empty()) continue;
            size_t dash = part.find('-');
            int a = atoi(part.c_str());
            int b = dash == std::string::npos ? a : atoi(part.c_str() + dash + 1);
            if (b < a || b - a > kMaxRange || b > kMaxSurface) continue;
            for (int n = a; n <= b; n++) {
                if (std::find(out.begin(), out.end(), n) == out.end()) out.push_back(n);
            }
        }
    }
}

ShellImport ImportShellFolder(const std::wstring& path) {
    ShellImport r;
    r.folder = FindShellDir(path);
    if (r.folder.empty()) { r.error = "not_shell_folder"; return r; }

    std::vector<FileInfo> files = ListFiles(r.folder, L"surface*.png");
    for (size_t i = 0; i < files.size(); i++) {
        int id = SurfaceNumber(files[i].name);
        if (id < 0) continue;
        std::wstring p = PathJoin(r.folder, files[i].name);
        std::string data;
        ShellImageFile one;
        if (!ReadBinaryFile(p, data) || !PngSize(data, &one.width, &one.height)) {
            r.unreadable.push_back(WideToUtf8(files[i].name));
            continue;
        }
        // 同じ番号の絵が 2 つあれば（surface1.png と surface0001.png）、名前の短いほう
        bool dup = false;
        for (size_t k = 0; k < r.images.size(); k++) {
            if (r.images[k].id != id) continue;
            dup = true;
            if (files[i].name.size() < Utf8ToWide(r.images[k].name).size()) {
                r.images[k].path = p;
                r.images[k].name = WideToUtf8(files[i].name);
                r.images[k].width = one.width;
                r.images[k].height = one.height;
            }
        }
        if (dup) continue;
        one.id = id;
        one.path = p;
        one.name = WideToUtf8(files[i].name);
        r.images.push_back(one);
    }
    std::sort(r.images.begin(), r.images.end(),
              [](const ShellImageFile& a, const ShellImageFile& b) { return a.id < b.id; });

    std::string txt;
    if (ReadBinaryFile(PathJoin(r.folder, L"surfaces.txt"), txt)) {
        std::vector<int> nums;
        SurfacesTxtNumbers(ToUtf8(txt), nums);
        std::sort(nums.begin(), nums.end());
        for (size_t i = 0; i < nums.size(); i++) {
            bool has = false;
            for (size_t k = 0; k < r.images.size(); k++) if (r.images[k].id == nums[i]) { has = true; break; }
            if (!has) r.compositeOnly.push_back(nums[i]);
        }
    }
    r.ok = true;
    return r;
}

} // namespace ikaga
