// 伺かスタジオ - YAYA を動かす手伝い（yaya_host.exe、32bit）
//
//   yaya_host.exe <ゴーストのフォルダ>
//
// 標準入力の SHIORI/3.0 の要求を、そのフォルダの yaya.dll に 1 回だけ渡して、
// 答えをそのまま標準出力に書きます。
//
// 伺かスタジオは 64bit ですが、SSP に入る yaya.dll は 32bit なので、exe から直には読めません。
// 「ためす」でも SSP と同じ yaya.dll を動かすために、この小さな 32bit の exe に頼みます
// （exe に埋めこんであり、ためすときに作業用のフォルダへ書き出して使います）。
//
// 終わりの数: 0 = 答えを書いた / 1 = 使いかたがちがう / 2 = yaya.dll を読めない
//             3 = 入り口が無い / 4 = load が失敗した
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <fcntl.h>
#include <io.h>
#include <cstdio>
#include <string>

typedef BOOL(__cdecl* LoadFn)(HGLOBAL, long);
typedef BOOL(__cdecl* UnloadFn)();
typedef HGLOBAL(__cdecl* RequestFn)(HGLOBAL, long*);

static HGLOBAL Dup(const std::string& s, long* len) {
    HGLOBAL h = GlobalAlloc(GMEM_FIXED, s.size() ? s.size() : 1);
    if (h && s.size()) memcpy(h, s.data(), s.size());
    if (len) *len = (long)s.size();
    return h;
}

int wmain(int argc, wchar_t** argv) {
    if (argc < 2) return 1;
    _setmode(_fileno(stdin), _O_BINARY);
    _setmode(_fileno(stdout), _O_BINARY);

    std::string request;
    char buf[4096];
    size_t n;
    while ((n = fread(buf, 1, sizeof(buf), stdin)) > 0) request.append(buf, n);

    std::wstring dir = argv[1];
    if (!dir.empty() && dir[dir.size() - 1] != L'\\') dir += L'\\';

    // YAYA は、自分と同じフォルダの yaya.txt と辞書を読みます
    HMODULE dll = LoadLibraryW((dir + L"yaya.dll").c_str());
    if (!dll) return 2;
    LoadFn fnLoad = (LoadFn)GetProcAddress(dll, "load");
    UnloadFn fnUnload = (UnloadFn)GetProcAddress(dll, "unload");
    RequestFn fnRequest = (RequestFn)GetProcAddress(dll, "request");
    if (!fnLoad || !fnUnload || !fnRequest) return 3;

    // SSP と同じく、フォルダは OS の ANSI コードページで渡します
    int an = WideCharToMultiByte(CP_ACP, 0, dir.c_str(), -1, NULL, 0, NULL, NULL);
    std::string adir(an > 1 ? (size_t)an - 1 : 0, '\0');
    if (an > 1) WideCharToMultiByte(CP_ACP, 0, dir.c_str(), -1, &adir[0], an, NULL, NULL);
    long len = 0;
    if (!fnLoad(Dup(adir, &len), len)) return 4;

    long rlen = 0;
    HGLOBAL resp = fnRequest(Dup(request, &rlen), &rlen);
    if (resp && rlen > 0) fwrite(resp, 1, (size_t)rlen, stdout);
    if (resp) GlobalFree(resp);
    fflush(stdout);

    fnUnload();
    FreeLibrary(dll);
    return 0;
}
