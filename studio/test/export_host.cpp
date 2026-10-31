// 伺かスタジオ - 書き出しの中身を見るためのコンソール
//
//   export_host.exe <project.json> [ファイル名の一部] [--dic <studio_program.dic>]
//
// プロジェクトを読んで、書き出されるファイルの一覧と中身を出します。
// 第 2 引数を付けると、名前にそれをふくむファイルの中身だけを出します。
// surfaces.txt の中身（当たり判定・SERIKO のアニメーション）を確かめるのに使います。
//
// YAYA 一式（yaya.dll・yaya_base・studio_runtime.dic）は、リポジトリのものを入れます。
// ブロックを訳した辞書は画面（ui/js/model/yaya.js）が作るので、--dic で渡します（無ければ空）。
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <cstdio>
#include <string>
#include <io.h>
#include <fcntl.h>
#include <algorithm>

#include "exporter.h"
#include "json.h"
#include "util.h"
#include "fsutil.h"
#include "yaya_ghost.h"
#include "shell_import.h"
#include "project_history.h"

using namespace ikaga;

// リポジトリの YAYA 一式（exe なら埋めこんだものを使うところ）。この exe は studio\test\ にあります
static std::vector<OutFile> KitFromRepo() {
    std::vector<OutFile> kit;
    std::wstring repo = ParentDir(ParentDir(ExeDir()));
    struct One { std::wstring from; std::string name; };
    std::vector<One> list;
    list.push_back({ PathJoin(repo, L"third_party\\yaya\\yaya.dll"), "yaya.dll" });
    std::wstring base = PathJoin(repo, L"third_party\\yaya-dic\\yaya_base");
    std::vector<std::wstring> names = ListFilesDeep(base);
    std::sort(names.begin(), names.end());
    for (size_t i = 0; i < names.size(); i++) {
        list.push_back({ PathJoin(base, names[i]), "yaya_base/" + WideToUtf8(names[i]) });
    }
    list.push_back({ PathJoin(repo, L"studio\\res\\yaya\\studio_runtime.dic"), "studio_runtime.dic" });
    for (size_t i = 0; i < list.size(); i++) {
        OutFile f;
        f.shell = false;
        f.name = list[i].name;
        if (ReadBinaryFile(list[i].from, f.data)) kit.push_back(f);
    }
    return kit;
}

// --dic <ファイル> を取り出す（引数の並びからは外す）
static std::string TakeDic(int& argc, wchar_t** argv) {
    std::string dic;
    for (int i = 1; i + 1 < argc; i++) {
        if (std::wstring(argv[i]) != L"--dic") continue;
        ReadBinaryFile(argv[i + 1], dic);
        for (int k = i; k + 2 < argc; k++) argv[k] = argv[k + 2];
        argc -= 2;
        break;
    }
    return dic;
}

int wmain(int argc, wchar_t** argv) {
    SetConsoleOutputCP(CP_UTF8);
    // 書き出したものをそのまま出す（\n を \r\n に化けさせない）。
    // 答え合わせテストが中身をバイトで見くらべるので、ここは素通しにします。
    _setmode(_fileno(stdout), _O_BINARY);
    const std::string dic = TakeDic(argc, argv);
    if (argc < 2) {
        printf("usage: export_host <project.json> [name-filter] [--dic file]\n");
        return 1;
    }

    // export_host --dau <フォルダ>
    //   そのフォルダから updates2.dau を作って見せる（0x01 は <1> と書く）
    if (std::wstring(argv[1]) == L"--dau") {
        if (argc < 3) { printf("usage: export_host --dau <folder>\n"); return 1; }
        std::string dau = BuildUpdatesDau(argv[2]);
        for (size_t i = 0; i < dau.size(); i++) {
            if (dau[i] == '\x01') printf("<1>");
            else if (dau[i] == '\r') printf("<CR>");
            else if (dau[i] == '\n') printf("<LF>\n");
            else putchar(dau[i]);
        }
        return 0;
    }

    // export_host --foreign <フォルダ>…
    //   それぞれが、ほかの人のゴーストのフォルダか（1 / 0。IsForeignGhostFolder）
    if (std::wstring(argv[1]) == L"--foreign") {
        for (int i = 2; i < argc; i++) printf("%d\n", IsForeignGhostFolder(argv[i]) ? 1 : 0);
        return 0;
    }

    // export_host --shell <フォルダ>
    //   いまあるシェルのフォルダを読みこんだ結果を出す（番号・ファイル・大きさ、組み合わせだけの番号）
    if (std::wstring(argv[1]) == L"--shell") {
        if (argc < 3) { printf("usage: export_host --shell <folder>\n"); return 1; }
        ShellImport r = ImportShellFolder(argv[2]);
        if (!r.ok) { printf("error: %s\n", r.error.c_str()); return 7; }
        printf("folder: %s\n", WideToUtf8(FileNameOf(r.folder)).c_str());
        for (size_t i = 0; i < r.images.size(); i++) {
            printf("image: %d %s %dx%d\n", r.images[i].id, r.images[i].name.c_str(), r.images[i].width, r.images[i].height);
        }
        for (size_t i = 0; i < r.compositeOnly.size(); i++) printf("composite: %d\n", r.compositeOnly[i]);
        for (size_t i = 0; i < r.unreadable.size(); i++) printf("unreadable: %s\n", r.unreadable[i].c_str());
        printf("areas: %s\n", r.areas.dump().c_str());
        for (size_t i = 0; i < r.animations.size(); i++) printf("animation: %s\n", r.animations.at(i).dump().c_str());
        printf("skipped: %d\n", r.skipped);
        return 0;
    }

    // export_host --history <projects のフォルダ> <名前> <新しい中身のファイル> [auto] [間隔の秒] [残す数]
    //   プロジェクトを保存するのと同じに、前の版を残してから上書きし、残っている版の一覧を出す（project_history.h）
    if (std::wstring(argv[1]) == L"--history") {
        if (argc < 5) { printf("usage: export_host --history <projects> <name> <new.json> [auto] [gap] [keep]\n"); return 1; }
        std::string text;
        if (!ReadBinaryFile(argv[4], text)) { printf("error: read\n"); return 7; }
        bool manual = !(argc > 5 && std::wstring(argv[5]) == L"auto");
        int gap = argc > 6 ? _wtoi(argv[6]) : kHistoryMinGapSec;
        int keep = argc > 7 ? _wtoi(argv[7]) : kHistoryMaxKeep;
        bool kept = KeepProjectVersion(argv[2], argv[3], text, manual, gap, keep);
        WriteBinaryFile(PathJoin(argv[2], std::wstring(argv[3]) + L".json"), text);
        printf("kept: %d\n", kept ? 1 : 0);
        for (const ProjectVersion& v : ListProjectVersions(argv[2], argv[3])) {
            std::string body;
            ReadProjectVersion(argv[2], argv[3], v.id, body);
            printf("version: %s %s\n", v.time.c_str(), body.c_str());
        }
        return 0;
    }

    // export_host --inspect <ゴーストのフォルダ>
    //   手書きの YAYA ゴーストを調べた結果を出す（辞書・関数・足りないもの）
    if (std::wstring(argv[1]) == L"--inspect") {
        if (argc < 3) { printf("usage: export_host --inspect <folder>\n"); return 1; }
        YayaGhostInfo info = InspectYayaGhost(argv[2]);
        if (!info.ok) { printf("error: %s\n", info.error.c_str()); return 5; }
        printf("name: %s / %s / %s\n", info.name.c_str(), info.sakuraName.c_str(), info.keroName.c_str());
        printf("linked: %s\n", info.linked ? "yes" : "no");
        for (size_t i = 0; i < info.dics.size(); i++) printf("dic: %s\n", info.dics[i].c_str());
        for (size_t i = 0; i < info.functions.size(); i++) printf("function: %s\n", info.functions[i].c_str());
        for (size_t i = 0; i < info.problems.size(); i++) printf("problem: %s %s\n", info.problems[i].c_str(), info.problemDetail.c_str());
        return 0;
    }

    // export_host --dics <ゴーストのフォルダ>
    //   手書きの辞書の中身を、プロジェクトに読みこむのと同じに出す（段階 8-6）。"== 名前" の行のあとに中身
    if (std::wstring(argv[1]) == L"--dics") {
        if (argc < 3) { printf("usage: export_host --dics <folder>\n"); return 1; }
        std::vector<YayaDicFile> files;
        std::string error;
        if (!ReadYayaGhostDics(argv[2], files, error)) { printf("error: %s\n", error.c_str()); return 5; }
        for (size_t i = 0; i < files.size(); i++) {
            fwrite("== ", 1, 3, stdout);
            fwrite(files[i].name.data(), 1, files[i].name.size(), stdout);
            fwrite("\n", 1, 1, stdout);
            fwrite(files[i].text.data(), 1, files[i].text.size(), stdout);
        }
        return 0;
    }

    // export_host --linked <ゴーストのフォルダ> --dic <studio_program.dic>
    //   つないだ手書きのゴーストに書き出す（スタジオのファイルと yaya.txt の印の行だけ）
    if (std::wstring(argv[1]) == L"--linked") {
        if (argc < 3) { printf("usage: export_host --linked <folder> --dic <file>\n"); return 1; }
        std::vector<OutFile> kit = KitFromRepo();
        std::string runtime;
        for (size_t i = 0; i < kit.size(); i++) if (kit[i].name == "studio_runtime.dic") runtime = kit[i].data;
        ExportResult r = ExportLinked(argv[2], runtime, dic);
        if (!r.ok) { printf("error: %s %s\n", r.error.c_str(), r.detail.c_str()); return 6; }
        for (size_t i = 0; i < r.written.size(); i++) printf("written: %s\n", r.written[i].c_str());
        return 0;
    }

    // export_host <project.json> --write <フォルダ>
    //   書き出すファイルを、そのまま置く（PNG のように目で見たいとき用）
    if (argc >= 4 && std::wstring(argv[2]) == L"--write") {
        std::string src;
        if (!ReadBinaryFile(argv[1], src)) { printf("読めません: %ls\n", argv[1]); return 2; }
        JValue proj;
        std::string perr;
        if (!JsonParse(src, proj, perr)) { printf("JSON が壊れています: %s\n", perr.c_str()); return 3; }
        std::wstring dir = argv[3];
        std::vector<OutFile> out = BuildGhostFiles(proj, KitFromRepo(), dic, true, NULL);
        for (size_t i = 0; i < out.size(); i++) {
            std::wstring rel = Utf8ToWide(out[i].name);
            for (size_t k = 0; k < rel.size(); k++) if (rel[k] == L'/') rel[k] = L'\\';
            std::wstring dest = PathJoin(dir, rel);
            EnsureDir(ParentDir(dest));
            if (!WriteBinaryFile(dest, out[i].data)) { printf("書けません: %s\n", out[i].name.c_str()); return 4; }
            printf("%s (%u バイト)\n", out[i].name.c_str(), (unsigned)out[i].data.size());
        }
        return 0;
    }

    std::string text;
    if (!ReadBinaryFile(argv[1], text)) {
        printf("読めません: %ls\n", argv[1]);
        return 2;
    }

    JValue project;
    std::string err;
    if (!JsonParse(text, project, err)) {
        printf("JSON が壊れています: %s\n", err.c_str());
        return 3;
    }

    std::string want;
    if (argc >= 3) want = WideToUtf8(argv[2]);

    std::string folder;
    std::vector<OutFile> files = BuildGhostFiles(project, KitFromRepo(), dic, true, &folder);
    printf("== folder: %s / %u ファイル\n", folder.c_str(), (unsigned)files.size());

    for (size_t i = 0; i < files.size(); i++) {
        const OutFile& f = files[i];
        if (!want.empty() && f.name.find(want) == std::string::npos) continue;
        printf("---- %s (%u バイト)\n", f.name.c_str(), (unsigned)f.data.size());
        if (want.empty()) continue;                 // 一覧だけのときは中身を出さない
        printf("%s\n", f.data.c_str());
    }
    return 0;
}
