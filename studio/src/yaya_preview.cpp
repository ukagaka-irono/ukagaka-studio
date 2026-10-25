// 伺かスタジオ - 「ためす」を YAYA で動かす（yaya_preview.h を見てください）
#include "yaya_preview.h"

#include "assets.h"
#include "exporter.h"
#include "fsutil.h"
#include "json.h"
#include "util.h"

#include <algorithm>
#include <cctype>

namespace ikaga {

static const DWORD kTimeoutMs = 20000;   // これより長くかかったら止める（ブロックが止まらないとき）

static std::wstring WorkDir() {
    wchar_t tmp[MAX_PATH];
    DWORD n = GetTempPathW(MAX_PATH, tmp);
    std::wstring base = (n > 0 && n < MAX_PATH) ? std::wstring(tmp, n) : ExeDir();
    return PathJoin(base, L"ukagaka-studio-preview-" + std::to_wstring(GetCurrentProcessId()));
}

// YAYA 一式を書き出す（起動してから 1 回だけ。消されていたら、もう一度）
static bool PlaceKit(const std::wstring& dir, std::string& detail) {
    static bool placed = false;
    if (placed && PathExists(PathJoin(dir, L"yaya_host.exe"))) return true;
    if (!EnsureDir(PathJoin(dir, L"yaya_base"))) { detail = "mkdir"; return false; }
    if (YayaKitCount() == 0) { detail = "no_kit"; return false; }
    for (int i = 0; i < YayaKitCount(); i++) {
        std::string data;
        if (!LoadEmbedded(YayaKitId(i), data) ||
            !WriteBinaryFile(PathJoin(dir, YayaKitName(i)), data)) {
            detail = WideToUtf8(YayaKitName(i));
            return false;
        }
    }
    placed = true;
    return true;
}

// 手伝いを動かして、要求を渡し、答えを受けとる
static bool RunHost(const std::wstring& dir, const std::string& request, std::string& response,
                    std::string& detail) {
    SECURITY_ATTRIBUTES sa = { sizeof(sa), NULL, TRUE };
    HANDLE inRead = NULL, inWrite = NULL, outRead = NULL, outWrite = NULL;
    if (!CreatePipe(&inRead, &inWrite, &sa, 0)) { detail = "pipe"; return false; }
    if (!CreatePipe(&outRead, &outWrite, &sa, 0)) {
        CloseHandle(inRead); CloseHandle(inWrite);
        detail = "pipe";
        return false;
    }
    // こちら側の端は、手伝いに引きつがせない
    SetHandleInformation(inWrite, HANDLE_FLAG_INHERIT, 0);
    SetHandleInformation(outRead, HANDLE_FLAG_INHERIT, 0);

    STARTUPINFOW si = {};
    si.cb = sizeof(si);
    si.dwFlags = STARTF_USESTDHANDLES;
    si.hStdInput = inRead;
    si.hStdOutput = outWrite;
    si.hStdError = outWrite;
    PROCESS_INFORMATION pi = {};
    std::wstring exe = PathJoin(dir, L"yaya_host.exe");
    std::wstring cmd = L"\"" + exe + L"\" \"" + dir + L"\"";
    BOOL ok = CreateProcessW(exe.c_str(), &cmd[0], NULL, NULL, TRUE, CREATE_NO_WINDOW,
                             NULL, dir.c_str(), &si, &pi);
    CloseHandle(inRead);
    CloseHandle(outWrite);
    if (!ok) {
        CloseHandle(inWrite); CloseHandle(outRead);
        detail = "start " + std::to_string(GetLastError());
        return false;
    }

    // 要求は小さいので、先に全部わたしてから答えを読む（手伝いは読み終えてから書きます）
    DWORD written = 0;
    WriteFile(inWrite, request.data(), (DWORD)request.size(), &written, NULL);
    CloseHandle(inWrite);

    DWORD start = GetTickCount();
    bool timedOut = false;
    char buf[8192];
    for (;;) {
        DWORD avail = 0;
        if (!PeekNamedPipe(outRead, NULL, 0, NULL, &avail, NULL)) break;   // 手伝いが閉じた
        if (avail > 0) {
            DWORD got = 0;
            if (!ReadFile(outRead, buf, sizeof(buf), &got, NULL) || got == 0) break;
            response.append(buf, got);
            continue;
        }
        if (GetTickCount() - start > kTimeoutMs) { timedOut = true; break; }
        Sleep(5);
    }
    if (timedOut) TerminateProcess(pi.hProcess, 1);
    WaitForSingleObject(pi.hProcess, 2000);
    DWORD code = 0;
    GetExitCodeProcess(pi.hProcess, &code);
    CloseHandle(pi.hProcess);
    CloseHandle(pi.hThread);
    CloseHandle(outRead);
    if (timedOut) { detail = "timeout"; return false; }
    if (code != 0) { detail = "exit " + std::to_string(code); return false; }
    return true;
}

PreviewResult RunYayaPreview(const std::string& dic, const std::string& scriptId, const std::string& input,
                             const std::vector<std::pair<std::string, std::string> >& dics) {
    PreviewResult out;
    out.error = "yaya_failed";
    const std::wstring dir = WorkDir();
    if (!PlaceKit(dir, out.detail)) return out;
    if (!WriteBinaryFile(PathJoin(dir, L"studio_program.dic"), dic)) { out.detail = "studio_program.dic"; return out; }

    // yaya.txt は毎回書く（プロジェクトの辞書が変わるので。前の回の辞書のファイルは、yaya.txt に無ければ読まれません）
    std::string txt =
        "charset, UTF-8\r\n"
        "dicdir, yaya_base\r\n"
        "dic, studio_runtime.dic\r\n"
        "dic, studio_program.dic\r\n"
        "dic, studio_preview.dic\r\n";
    std::vector<std::string> seen;
    for (size_t i = 0; i < dics.size(); i++) {
        const std::string& name = dics[i].first;
        if (!DicNameOk(name)) continue;
        std::string lower = name;
        for (size_t k = 0; k < lower.size(); k++) lower[k] = (char)tolower((unsigned char)lower[k]);
        if (std::find(seen.begin(), seen.end(), lower) != seen.end()) continue;
        seen.push_back(lower);
        if (!WriteBinaryFile(PathJoin(dir, Utf8ToWide(name)), dics[i].second)) { out.detail = name; return out; }
        txt += "dic, " + name + "\r\n";
    }
    if (!WriteBinaryFile(PathJoin(dir, L"yaya.txt"), txt)) { out.detail = "yaya.txt"; return out; }
    // 「ためす」は毎回、プロジェクトの初期値から（続きの変数は input で渡す）
    DeleteFileIfExists(PathJoin(dir, L"yaya_variable.cfg"));

    // Reference に置く文字は 1 行に（JSON は改行を \n にしてあるので、そのままで 1 行です）
    std::string id = scriptId;
    for (size_t i = 0; i < id.size(); i++) if (id[i] == '\r' || id[i] == '\n') id[i] = ' ';
    std::string req = "GET SHIORI/3.0\r\nCharset: UTF-8\r\nSender: UkagakaStudio\r\nSecurityLevel: local\r\n"
                      "ID: OnStudioPreview\r\nReference0: " + id + "\r\nReference1: " + input + "\r\n\r\n";

    std::string res;
    if (!RunHost(dir, req, res, out.detail)) return out;

    size_t v = res.find("\r\nValue: ");
    if (v == std::string::npos) {
        // 入り口が答えなかった（辞書が読めなかったなど）。1 行目を手がかりに出す
        out.detail = res.substr(0, res.find("\r\n"));
        if (out.detail.empty()) out.detail = "no answer";
        return out;
    }
    v += 9;
    size_t e = res.find("\r\n", v);
    JValue answer;
    std::string err;
    if (!JsonParse(res.substr(v, e == std::string::npos ? std::string::npos : e - v), answer, err)) {
        out.detail = "json: " + err;
        return out;
    }
    if (answer.has("error")) {
        out.error = answer["error"].asStr();
        out.detail = scriptId;
        return out;
    }
    out.ok = true;
    out.error.clear();
    out.script = answer["script"].asStr();
    out.commTo = answer["commTo"].asStr();
    out.vars = answer["vars"].isObj() ? answer["vars"] : JValue::makeObj();
    out.draws = answer["draws"].isObj() ? answer["draws"] : JValue::makeObj();
    out.none = answer["none"].asInt(0);
    return out;
}

static void RemoveWorkDir(const std::wstring& dir) {
    if (!IsDirectory(dir)) return;
    std::vector<std::wstring> files = ListFilesDeep(dir);
    for (size_t i = 0; i < files.size(); i++) DeleteFileW(PathJoin(dir, files[i]).c_str());
    RemoveDirectoryW(PathJoin(dir, L"yaya_base").c_str());
    RemoveDirectoryW(dir.c_str());
}

void CleanupYayaPreview() {
    RemoveWorkDir(WorkDir());
}

void CleanupStaleYayaPreviews() {
    // 強制終了などで消しそびれた、もう動いていない伺かスタジオの作業用フォルダ
    const std::wstring mine = WorkDir();
    const std::wstring base = ParentDir(mine);
    const std::wstring prefix = L"ukagaka-studio-preview-";
    WIN32_FIND_DATAW fd;
    HANDLE h = FindFirstFileW(PathJoin(base, prefix + L"*").c_str(), &fd);
    if (h == INVALID_HANDLE_VALUE) return;
    do {
        if (!(fd.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY)) continue;
        std::wstring name = fd.cFileName;
        DWORD pid = (DWORD)_wtoi(name.c_str() + prefix.size());
        if (pid == 0 || pid == GetCurrentProcessId()) continue;
        HANDLE p = OpenProcess(SYNCHRONIZE, FALSE, pid);
        if (p) { CloseHandle(p); continue; }      // まだ動いている（番号が使いまわされていても、触らない）
        RemoveWorkDir(PathJoin(base, name));
    } while (FindNextFileW(h, &fd));
    FindClose(h);
}

} // namespace ikaga
