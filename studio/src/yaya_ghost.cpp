// 伺かスタジオ - 手書きの YAYA ゴーストにつなぐ（yaya_ghost.h を見てください）
#include "yaya_ghost.h"

#include "fsutil.h"
#include "util.h"

#include <algorithm>
#include <cwctype>
#include <set>

namespace ikaga {

const char* kStudioMark = "ukagaka-studio: generated";

static const char* kBegin = "// ukagaka-studio: begin (Ukagaka Studio rewrites these lines on export)";
static const char* kEnd = "// ukagaka-studio: end";
static const char* kStudioFiles[] = { "studio_runtime.dic", "studio_program.dic" };

// ---------------------------------------------------------------- 小道具

// yaya.txt に書ける辞書の数と、読む量の上限（同じ辞書を何度も書いたり、大きなファイルを並べたりしても、止まらないように）
static const size_t kMaxDics = 2000;
static const size_t kMaxDicBytes = 64u << 20;

// 大文字小文字をそろえた、ほんとうの場所（.. や / をといたもの）。とけなければ空
static std::wstring FullPathLower(const std::wstring& path) {
    DWORD n = GetFullPathNameW(path.c_str(), 0, NULL, NULL);
    if (n == 0) return std::wstring();
    std::wstring buf(n, L'\0');
    DWORD got = GetFullPathNameW(path.c_str(), n, &buf[0], NULL);
    if (got == 0 || got >= n) return std::wstring();
    buf.resize(got);
    for (size_t i = 0; i < buf.size(); i++) buf[i] = (wchar_t)towlower(buf[i]);
    return buf;
}

// yaya.txt に書いてある場所が、ghost/master の中を指しているか（.. で外へ出る・絶対パス・: をふくむものは読まない）。
// 中なら、くらべるための場所（FullPathLower）を key に入れて true
static bool InsideMaster(const std::wstring& master, const std::string& rel, std::wstring& key) {
    if (rel.empty() || rel.find(':') != std::string::npos || rel[0] == '\\' || rel[0] == '/') return false;
    std::wstring root = FullPathLower(master);
    std::wstring full = FullPathLower(PathJoin(master, Utf8ToWide(rel)));
    if (root.empty() || full.empty()) return false;
    if (root[root.size() - 1] != L'\\') root += L'\\';
    if (full.compare(0, root.size(), root) != 0) return false;
    key = full;
    return true;
}

static std::wstring FindMaster(const std::wstring& path) {
    std::wstring m = PathJoin(PathJoin(path, L"ghost"), L"master");
    if (PathExists(PathJoin(m, L"yaya.txt"))) return m;
    if (PathExists(PathJoin(path, L"yaya.txt"))) return path;
    return std::wstring();
}

static std::vector<std::string> SplitLines(const std::string& s) {
    std::vector<std::string> out;
    size_t pos = 0;
    while (pos <= s.size()) {
        size_t e = s.find('\n', pos);
        std::string line = s.substr(pos, e == std::string::npos ? std::string::npos : e - pos);
        if (!line.empty() && line[line.size() - 1] == '\r') line.erase(line.size() - 1);
        out.push_back(line);
        if (e == std::string::npos) break;
        pos = e + 1;
    }
    return out;
}

static std::string Lower(std::string s) {
    for (size_t i = 0; i < s.size(); i++) if (s[i] >= 'A' && s[i] <= 'Z') s[i] = (char)(s[i] - 'A' + 'a');
    return s;
}

// 「キー, 値, 文字コード」の行をほどく（yaya.txt・descript.txt）
static bool KeyValue(const std::string& line, std::string& key, std::string& value) {
    std::string t = Trim(line);
    if (t.empty() || t.compare(0, 2, "//") == 0) return false;
    size_t c = t.find(',');
    if (c == std::string::npos) return false;
    key = Lower(Trim(t.substr(0, c)));
    std::string rest = t.substr(c + 1);
    size_t c2 = rest.find(',');
    value = Trim(c2 == std::string::npos ? rest : rest.substr(0, c2));
    return true;
}

static bool IsStudioFile(const std::string& rel) {
    std::string low = Lower(rel);
    for (size_t i = 0; i < low.size(); i++) if (low[i] == '\\') low[i] = '/';
    return low == "studio_runtime.dic" || low == "studio_program.dic" || low == "studio_preview.dic";
}

static bool InYayaBase(const std::string& rel) {
    std::string low = Lower(rel);
    for (size_t i = 0; i < low.size(); i++) if (low[i] == '\\') low[i] = '/';
    return low == "yaya_base" || low.compare(0, 10, "yaya_base/") == 0;
}

// 辞書の中の、いちばん外側に書いてある関数の名前を集める（文字列とコメントの中は見ない）
static void CollectFunctions(const std::string& text, std::vector<std::string>& out, std::set<std::string>& seen) {
    static const char* kWords[] = { "if", "elseif", "else", "while", "for", "foreach", "case", "when",
                                    "others", "switch", "return", "break", "continue", "void", NULL };
    int depth = 0;
    std::string pending;
    size_t i = 0;
    while (i < text.size()) {
        char c = text[i];
        if (c == '/' && i + 1 < text.size() && text[i + 1] == '/') {          // 行のコメント
            while (i < text.size() && text[i] != '\n') i++;
            continue;
        }
        if (c == '/' && i + 1 < text.size() && text[i + 1] == '*') {          // かこみのコメント
            size_t e = text.find("*/", i + 2);
            i = (e == std::string::npos) ? text.size() : e + 2;
            continue;
        }
        if (c == '"' || c == '\'') {                                           // 文字列（行の中で閉じる）
            size_t j = i + 1;
            while (j < text.size() && text[j] != c && text[j] != '\n') j++;
            if (depth == 0) pending += ' ';
            i = j + 1;
            continue;
        }
        if (c == '#' && depth == 0 && (i == 0 || text[i - 1] == '\n')) {       // #define など
            while (i < text.size() && text[i] != '\n') i++;
            continue;
        }
        if (c == '{') {
            if (depth == 0) {
                // 直前の行が関数の名前（「名前 : void」のような書きかたもある）
                std::vector<std::string> lines = SplitLines(pending);
                std::string name;
                for (size_t k = lines.size(); k-- > 0;) {
                    std::string t = Trim(lines[k]);
                    if (!t.empty()) { name = t; break; }
                }
                size_t colon = name.find(':');
                if (colon != std::string::npos) name = Trim(name.substr(0, colon));
                bool ok = !name.empty() && name.find_first_of(" \t=;,()[]+-*<>!&|\"'") == std::string::npos;
                for (int w = 0; ok && kWords[w]; w++) if (name == kWords[w]) ok = false;
                if (ok && seen.insert(name).second) out.push_back(name);
                pending.clear();
            }
            depth++;
            i++;
            continue;
        }
        if (c == '}') {
            if (depth > 0) depth--;
            if (depth == 0) pending.clear();
            i++;
            continue;
        }
        if (depth == 0) pending += c;
        i++;
    }
}

// yaya.dll が YAYA 6 系（ハッシュを使える）か。関数の名前 "IHASH" が UTF-16 で入っているかで見ます
static bool YayaDllNewEnough(const std::string& dll) {
    const char pat[] = { 'I', 0, 'H', 0, 'A', 0, 'S', 0, 'H', 0, 0, 0 };
    return std::search(dll.begin(), dll.end(), pat, pat + sizeof(pat)) != dll.end();
}

// ---------------------------------------------------------------- 調べる

YayaGhostInfo InspectYayaGhost(const std::wstring& path) {
    YayaGhostInfo info;
    info.master = FindMaster(path);
    if (info.master.empty()) { info.error = "not_yaya_ghost"; return info; }

    // descript.txt の名前
    std::string raw;
    if (ReadBinaryFile(PathJoin(info.master, L"descript.txt"), raw)) {
        std::vector<std::string> lines = SplitLines(ToUtf8(raw));
        for (size_t i = 0; i < lines.size(); i++) {
            std::string k, v;
            if (!KeyValue(lines[i], k, v)) continue;
            if (k == "name") info.name = v;
            else if (k == "sakura.name") info.sakuraName = v;
            else if (k == "kero.name") info.keroName = v;
        }
    }

    // yaya.txt から、読む辞書を集める
    std::string txt;
    ReadBinaryFile(PathJoin(info.master, L"yaya.txt"), txt);
    txt = ToUtf8(txt);
    info.linked = txt.find("ukagaka-studio: begin") != std::string::npos;
    bool baseListed = false;
    std::vector<std::string> lines = SplitLines(txt);
    // 辞書の場所は ghost/master の中だけ。同じ辞書は 1 回だけ、数にも上限
    std::set<std::wstring> listed;
    auto addDic = [&](const std::string& rel) {
        std::wstring key;
        if (info.dics.size() >= kMaxDics || !InsideMaster(info.master, rel, key)) return;
        if (listed.insert(key).second) info.dics.push_back(rel);
    };
    for (size_t i = 0; i < lines.size(); i++) {
        std::string k, v;
        if (!KeyValue(lines[i], k, v)) continue;
        if (k != "dic" && k != "dicif" && k != "dicdir") continue;
        if (InYayaBase(v)) { baseListed = true; continue; }
        if (IsStudioFile(v)) continue;
        if (k == "dicdir") {
            std::wstring key;
            if (!InsideMaster(info.master, v, key)) continue;
            std::wstring dir = PathJoin(info.master, Utf8ToWide(v));
            std::vector<std::wstring> files = ListFilesDeep(dir);
            std::sort(files.begin(), files.end());
            for (size_t f = 0; f < files.size(); f++) {
                std::string rel = v + "/" + WideToUtf8(files[f]);
                if (Lower(rel).size() > 4 && Lower(rel).compare(rel.size() - 4, 4, ".dic") == 0) addDic(rel);
            }
        } else {
            addDic(v);
        }
    }
    std::set<std::string> seen;
    size_t total = 0;
    for (size_t i = 0; i < info.dics.size() && total < kMaxDicBytes; i++) {
        std::string d;
        if (!ReadBinaryFile(PathJoin(info.master, Utf8ToWide(info.dics[i])), d)) continue;
        total += d.size();
        CollectFunctions(ToUtf8(d), info.functions, seen);
    }

    // スタジオのしくみが動くのに足りているか
    std::string dll;
    if (!ReadBinaryFile(PathJoin(info.master, L"yaya.dll"), dll)) info.problems.push_back("yaya_dll_missing");
    else if (!YayaDllNewEnough(dll)) info.problems.push_back("yaya_dll_old");

    std::wstring baseDir = PathJoin(info.master, L"yaya_base");
    std::string base;
    std::vector<std::wstring> baseFiles = ListFilesDeep(baseDir);
    for (size_t i = 0; i < baseFiles.size(); i++) {
        std::string d;
        if (ReadBinaryFile(PathJoin(baseDir, baseFiles[i]), d)) base += d;
    }
    if (!baseListed || base.empty()) {
        info.problems.push_back("yaya_base_missing");
    } else {
        // しくみの辞書が使う yaya_base の関数と変数
        const char* need[] = { "SHIORI3FW.PushAdditionalReturn", "FUNCTIONLOAD", "reference.raw",
                               "OnGhostLoad", NULL };
        for (int n = 0; need[n]; n++) {
            if (base.find(need[n]) == std::string::npos) { info.problems.push_back("yaya_base_old"); break; }
        }
    }

    // スタジオのファイルの名前で、人が書いたものが置いてあったら止める
    for (size_t i = 0; i < 2; i++) {
        std::string d;
        if (!ReadBinaryFile(PathJoin(info.master, Utf8ToWide(kStudioFiles[i])), d)) continue;
        if (d.substr(0, 512).find(kStudioMark) == std::string::npos) {
            info.problems.push_back("not_studio_file");
            info.problemDetail = kStudioFiles[i];
        }
    }

    info.ok = true;
    return info;
}

// ---------------------------------------------------------------- 読みこむ
bool ReadYayaGhostDics(const std::wstring& path, std::vector<YayaDicFile>& out, std::string& error) {
    YayaGhostInfo info = InspectYayaGhost(path);   // 辞書の場所は ghost/master の中だけ・同じものは 1 回（InsideMaster）
    if (!info.ok) { error = info.error; return false; }
    size_t total = 0;
    for (size_t i = 0; i < info.dics.size() && total < kMaxDicBytes; i++) {
        std::string raw;
        if (!ReadBinaryFile(PathJoin(info.master, Utf8ToWide(info.dics[i])), raw)) continue;   // dicif の無いファイルなど
        total += raw.size();
        std::string text = ToUtf8(raw), lf;
        lf.reserve(text.size());
        for (size_t k = 0; k < text.size(); k++) if (text[k] != '\r') lf += text[k];
        YayaDicFile f;
        f.name = info.dics[i];
        for (size_t k = 0; k < f.name.size(); k++) if (f.name[k] == '\\') f.name[k] = '/';
        f.text = lf;
        out.push_back(f);
    }
    return true;
}

// ---------------------------------------------------------------- 書き出す

std::string WithStudioLines(const std::string& yayaTxt) {
    const std::string nl = yayaTxt.find("\r\n") != std::string::npos || yayaTxt.empty() ? "\r\n" : "\n";
    const std::string block = std::string(kBegin) + nl +
                              "dic, studio_runtime.dic, UTF-8" + nl +
                              "dic, studio_program.dic, UTF-8" + nl +
                              kEnd + nl;
    size_t b = yayaTxt.find("// ukagaka-studio: begin");
    if (b != std::string::npos) {
        size_t e = yayaTxt.find(kEnd, b);
        if (e != std::string::npos) {
            e += strlen(kEnd);
            if (yayaTxt.compare(e, 2, "\r\n") == 0) e += 2;
            else if (e < yayaTxt.size() && yayaTxt[e] == '\n') e += 1;
            return yayaTxt.substr(0, b) + block + yayaTxt.substr(e);
        }
    }
    std::string out = yayaTxt;
    if (!out.empty() && out[out.size() - 1] != '\n') out += nl;
    return out + block;
}

ExportResult ExportLinked(const std::wstring& path, const std::string& runtime, const std::string& dic) {
    ExportResult r;
    YayaGhostInfo info = InspectYayaGhost(path);
    if (!info.ok) { r.error = info.error; return r; }
    if (!info.problems.empty()) {
        r.error = info.problems[0];
        r.detail = info.problemDetail;
        return r;
    }
    r.root = info.master;
    r.folder = WideToUtf8(FileNameOf(ParentDir(ParentDir(info.master))));

    const std::string* data[] = { &runtime, &dic };
    for (int i = 0; i < 2; i++) {
        if (!WriteBinaryFile(PathJoin(info.master, Utf8ToWide(kStudioFiles[i])), *data[i])) {
            r.error = "write_failed";
            r.detail = kStudioFiles[i];
            return r;
        }
        r.written.push_back(kStudioFiles[i]);
    }

    // yaya.txt は、印の行のところだけを書きかえる（ほかのバイトはそのまま）
    std::wstring txtPath = PathJoin(info.master, L"yaya.txt");
    std::string txt;
    ReadBinaryFile(txtPath, txt);
    std::string next = WithStudioLines(txt);
    if (next != txt) {
        if (!WriteBinaryFile(txtPath, next)) { r.error = "write_failed"; r.detail = "yaya.txt"; return r; }
        r.written.push_back("yaya.txt");
    }
    r.ok = true;
    return r;
}

} // namespace ikaga
