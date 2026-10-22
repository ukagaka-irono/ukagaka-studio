// 伺かスタジオ - 書き出し: ファイル一覧の組み立てと、フォルダ / .nar への書きこみ
//
// ファイルごとの中身は、それぞれのファイルにあります。
//   export_program.cpp … ghost/master/ghost.json
//   export_shell.cpp   … shell/master/（仮の立ち絵・descript.txt・surfaces.txt）
//   export_seriko.cpp  … surfaces.txt の SERIKO のうごき
//   export_balloon.cpp … balloon/
//   export_dau.cpp     … updates2.dau
#include "exporter.h"
#include "export_parts.h"
#include "zip.h"
#include "fsutil.h"
#include "util.h"

namespace ikaga {

// ------------------------------------------------------------------ 名前

std::string SafeFolderName(const std::string& name, const char* fallback) {
    std::string out;
    for (size_t i = 0; i < name.size(); i++) {
        unsigned char c = (unsigned char)name[i];
        if (c < 0x20) continue;
        if (c == '\\' || c == '/' || c == ':' || c == '*' || c == '?' ||
            c == '"' || c == '<' || c == '>' || c == '|') continue;
        out += (char)c;
    }
    while (!out.empty() && (out[0] == '.' || out[0] == ' ')) out.erase(0, 1);
    while (!out.empty() && (out[out.size() - 1] == '.' || out[out.size() - 1] == ' ')) out.erase(out.size() - 1);
    return out.empty() ? std::string(fallback) : out;
}

std::string GhostFolderName(const JValue& project) {
    const JValue& meta = project["meta"];
    std::string folder = meta["folder"].asStr();
    if (folder.empty()) folder = meta["name"].asStr("ikaga-ghost");
    return SafeFolderName(folder, "ikaga-ghost");
}

bool EnglishGhost(const JValue& project) {
    return project["meta"]["lang"].asStr() == "en";
}

const char* ByGhostLang(const JValue& project, const char* ja, const char* en) {
    return EnglishGhost(project) ? en : ja;
}

std::string GhostName(const JValue& project) {
    std::string name = project["meta"]["name"].asStr();
    return Trim(name).empty() ? std::string(ByGhostLang(project, "あたらしいゴースト", "New Ghost")) : name;
}

const char* DefaultSakuraName(const JValue& project) { return ByGhostLang(project, "さくら", "Sakura"); }
const char* DefaultKeroName(const JValue& project) { return ByGhostLang(project, "うにゅう", "Kero"); }

std::string DescriptLine(const char* key, const std::string& value) {
    std::string v = value;
    for (size_t i = 0; i < v.size(); i++) {
        if (v[i] == '\r' || v[i] == '\n') v[i] = ' ';
    }
    return std::string(key) + "," + v + "\r\n";
}

// ---------------------------------------------------------- ファイル一覧


std::string YayaTxt() {
    return "charset, UTF-8\r\n"
           "dicdir, yaya_base\r\n"
           "dic, studio_runtime.dic\r\n"
           "dic, studio_program.dic\r\n";
}

std::vector<OutFile> BuildGhostFiles(const JValue& project, const std::vector<OutFile>& kit,
                                     const std::string& dic, bool includeShell, std::string* folderOut) {
    const JValue& meta = project["meta"];
    std::string folder = GhostFolderName(project);
    if (folderOut) *folderOut = folder;

    std::vector<OutFile> files;
    OutFile f;

    bool withBalloon = includeShell && project["shell"]["balloonEnabled"].asBool(false);

    f.shell = false;
    f.name = "install.txt";
    f.data = DescriptLine("charset", "UTF-8") + DescriptLine("type", "ghost") +
             DescriptLine("name", GhostName(project)) + DescriptLine("directory", folder);
    if (withBalloon) {
        // アーカイブの中の balloon/ を、<フォルダ名>-balloon として入れてもらう
        f.data += DescriptLine("balloon.directory", folder + "-balloon") +
                  DescriptLine("balloon.source.directory", "balloon");
    }
    files.push_back(f);

    // readme.txt は、ゴーストの言語で書きます
    f.name = "readme.txt";
    f.data = GhostName(project);
    f.data += "\r\n\r\n";
    f.data += ByGhostLang(project, "作者      : ", "Author : ") +
              meta["craftman"].asStr(ByGhostLang(project, "(未設定)", "(not set)")) + "\r\n";
    f.data += ByGhostLang(project, "バージョン: ", "Version: ") + meta["version"].asStr("1.0.0") + "\r\n\r\n";
    f.data += meta["description"].asStr("") + "\r\n\r\n";
    f.data += "----\r\n";
    f.data += ByGhostLang(project, "このゴーストは 栞 YAYA (yaya.dll) で動いています。\r\n"
                 "会話は伺かスタジオのブロックで作り、ghost/master/studio_program.dic に YAYA の辞書として\r\n"
                 "書き出しています。ブロックの写しは ghost/master/ghost.json にあり、伺かスタジオで\r\n"
                 "読み込むと編集できます。\r\n"
                 "YAYA: https://github.com/YAYA-shiori/yaya-shiori\r\n",
                 "This ghost runs on the YAYA SHIORI (yaya.dll).\r\n"
                 "Its dialogue was made with blocks in Ukagaka Studio and exported as a YAYA dictionary,\r\n"
                 "ghost/master/studio_program.dic. A copy of the blocks is in ghost/master/ghost.json;\r\n"
                 "open it in Ukagaka Studio to edit it.\r\n"
                 "YAYA: https://github.com/YAYA-shiori/yaya-shiori\r\n");
    files.push_back(f);

    f.name = "ghost/master/descript.txt";
    f.data = DescriptLine("charset", "UTF-8") + DescriptLine("type", "ghost") +
             DescriptLine("name", GhostName(project)) +
             DescriptLine("sakura.name", meta["sakuraName"].asStr(DefaultSakuraName(project))) +
             DescriptLine("kero.name", meta["keroName"].asStr(DefaultKeroName(project))) +
             DescriptLine("craftman", meta["craftman"].asStr("unknown")) +
             DescriptLine("craftmanw", meta["craftman"].asStr("unknown")) +
             DescriptLine("craftmanurl", meta["craftmanUrl"].asStr("")) +
             DescriptLine("shiori", "yaya.dll") +
             // ネットワーク更新のありか。空なら書かない（書くと更新を試して失敗する）
             (meta["homeUrl"].asStr("").empty()
                  ? std::string()
                  : DescriptLine("homeurl", meta["homeUrl"].asStr(""))) +
             DescriptLine("sakura.seriko.defaultsurface",
                  NumToStr(project["settings"]["defaultSurfaceSakura"].asNum(0))) +
             DescriptLine("kero.seriko.defaultsurface",
                  NumToStr(project["settings"]["defaultSurfaceKero"].asNum(10)));
    files.push_back(f);

    // ブロックの写し（YAYA は読みません。伺かスタジオで読みこみなおすためのもの）
    f.name = "ghost/master/ghost.json";
    f.data = RuntimeProgramJson(project);
    files.push_back(f);

    // YAYA で動かすためのもの
    f.name = "ghost/master/yaya.txt";
    f.data = YayaTxt();
    files.push_back(f);
    f.name = "ghost/master/studio_program.dic";
    f.data = dic;
    files.push_back(f);
    for (size_t i = 0; i < kit.size(); i++) {
        f.name = "ghost/master/" + kit[i].name;
        f.data = kit[i].data;
        files.push_back(f);
    }

    if (includeShell) AppendShell(files, project);
    if (withBalloon) AppendBalloon(files, project);
    return files;
}

// -------------------------------------------------------------- 書き出し

ExportResult ExportToDir(const JValue& project, const std::wstring& outDir, const std::vector<OutFile>& kit,
                         const std::string& dic, bool includeShell, bool overwriteShell) {
    ExportResult r;
    std::string folder;
    std::vector<OutFile> files = BuildGhostFiles(project, kit, dic, includeShell, &folder);
    r.folder = folder;
    r.root = PathJoin(outDir, Utf8ToWide(folder));

    if (!EnsureDir(r.root)) {
        r.error = "mkdir_failed";
        return r;
    }

    for (size_t i = 0; i < files.size(); i++) {
        std::wstring rel = Utf8ToWide(files[i].name);
        for (size_t k = 0; k < rel.size(); k++) {
            if (rel[k] == L'/') rel[k] = L'\\';
        }
        std::wstring dest = PathJoin(r.root, rel);
        EnsureDir(ParentDir(dest));                 // ghost/master/yaya_base/ など
        if (files[i].shell && PathExists(dest) && !overwriteShell) {
            r.skipped.push_back(files[i].name);
            continue;
        }
        if (!WriteBinaryFile(dest, files[i].data)) {
            r.error = "write_failed";
            r.detail = files[i].name;
            return r;
        }
        r.written.push_back(files[i].name);
    }

    // 「更新のありか」を決めているゴーストには、照合表も置く。
    // 中身から作るので、自分で差し替えた絵や、あとから足したファイルもそのまま入る。
    if (!project["meta"]["homeUrl"].asStr("").empty()) {
        std::string dau = BuildUpdatesDau(r.root);
        if (!dau.empty() && WriteBinaryFile(PathJoin(r.root, L"updates2.dau"), dau)) {
            r.written.push_back("updates2.dau");
        }
    }

    r.ok = true;
    return r;
}

ExportResult ExportToNar(const JValue& project, const std::wstring& outDir, const std::vector<OutFile>& kit,
                         const std::string& dic, bool includeShell) {
    ExportResult r;
    std::string folder;
    std::vector<OutFile> files = BuildGhostFiles(project, kit, dic, includeShell, &folder);
    r.folder = folder;

    std::vector<ZipEntry> entries;
    for (size_t i = 0; i < files.size(); i++) {
        ZipEntry e;
        e.name = files[i].name;
        e.data = files[i].data;
        entries.push_back(e);
    }
    std::string zip = CreateZip(entries);

    if (!EnsureDir(outDir)) {
        r.error = "mkdir_failed";
        return r;
    }
    r.root = PathJoin(outDir, Utf8ToWide(folder) + L".nar");
    if (!WriteBinaryFile(r.root, zip)) {
        r.error = "nar_write_failed";
        return r;
    }
    r.written.push_back(folder + ".nar");
    r.ok = true;
    return r;
}

} // namespace ikaga
