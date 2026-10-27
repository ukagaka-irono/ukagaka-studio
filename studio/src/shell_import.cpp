// 伺かスタジオ - いまあるシェルのフォルダを読みこむ（shell_import.h を見てください）
#include "shell_import.h"

#include "fsutil.h"
#include "image.h"
#include "util.h"

#include <algorithm>
#include <map>
#include <set>

namespace ikaga {

static const int kMaxSurface = 99999;   // これより大きい番号は、数えまちがいとみなす
static const int kMaxRange = 2000;      // surfaces.txt の「100-200」のような範囲の、広げてよい数
// 1 つの見出しで広げる番号の数と、読むうごきの数の上限（大きすぎる surfaces.txt で、読みこみが止まらないように）
static const size_t kMaxHeaderNumbers = 2000;
static const size_t kMaxAnimations = 10000;

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

static std::string Lower(std::string s) {
    for (size_t i = 0; i < s.size(); i++) if (s[i] >= 'A' && s[i] <= 'Z') s[i] = (char)(s[i] - 'A' + 'a');
    return s;
}

static std::vector<std::string> SplitLines(const std::string& text) {
    std::vector<std::string> out;
    size_t pos = 0;
    while (pos <= text.size()) {
        size_t e = text.find('\n', pos);
        out.push_back(Trim(text.substr(pos, e == std::string::npos ? std::string::npos : e - pos)));
        pos = (e == std::string::npos) ? text.size() + 1 : e + 1;
    }
    return out;
}

static std::vector<std::string> SplitComma(const std::string& s) {
    std::vector<std::string> out;
    size_t p = 0;
    while (p <= s.size()) {
        size_t c = s.find(',', p);
        out.push_back(Trim(s.substr(p, c == std::string::npos ? std::string::npos : c - p)));
        p = (c == std::string::npos) ? s.size() + 1 : c + 1;
    }
    return out;
}

// 「surface0」「surface10,11,12」「surface100-110」「surface.append0」の行なら、その番号を返す（そうでなければ空）
static std::vector<int> SurfaceHeaderNumbers(const std::string& line) {
    std::vector<int> out;
    std::string low = Lower(line);
    if (low.compare(0, 7, "surface") != 0) return out;
    std::string rest = low.substr(7);
    if (rest.compare(0, 7, ".append") == 0) rest = rest.substr(7);
    size_t brace = rest.find('{');                       // 「surface0{」のように同じ行に { があるとき
    if (brace != std::string::npos) rest = rest.substr(0, brace);
    if (rest.empty() || rest.find_first_not_of("0123456789,- \t") != std::string::npos) return out;
    // カンマで分けて、a-b は広げる（同じ番号は 1 つにまとめ、kMaxHeaderNumbers までにする）
    std::set<int> seen;
    for (const std::string& part : SplitComma(rest)) {
        if (part.empty()) continue;
        size_t dash = part.find('-');
        int a = atoi(part.c_str());
        int b = dash == std::string::npos ? a : atoi(part.c_str() + dash + 1);
        if (b < a || b - a > kMaxRange || b > kMaxSurface) continue;
        for (int n = a; n <= b && out.size() < kMaxHeaderNumbers; n++) {
            if (seen.insert(n).second) out.push_back(n);
        }
    }
    return out;
}

// 「animation12.pattern3,…」→ id 12、key "pattern"、番号 3、値 "…"。うごきの行でなければ false
static bool AnimationKey(const std::string& line, int& id, std::string& key, int& index, std::string& value) {
    std::string low = Lower(line);
    if (low.compare(0, 9, "animation") != 0) return false;
    size_t dot = low.find('.', 9);
    size_t comma = low.find(',');
    if (dot == std::string::npos || comma == std::string::npos || dot > comma) return false;
    std::string num = low.substr(9, dot - 9);
    if (num.empty() || num.find_first_not_of("0123456789") != std::string::npos) return false;
    id = atoi(num.c_str());
    std::string k = low.substr(dot + 1, comma - dot - 1);
    size_t d = k.find_first_of("0123456789");
    key = k.substr(0, d);
    index = d == std::string::npos ? 0 : atoi(k.c_str() + d);
    value = Trim(line.substr(comma + 1));
    return true;
}

// 当たり判定 1 つを、プロジェクトの形にする（四角は collision、そのほかは collisionex の書きかた）
static bool CollisionToJson(bool ex, const std::vector<std::string>& f, JValue& out) {
    out = JValue::makeObj();
    if (!ex) {                                           // 左,上,右,下,名前
        if (f.size() < 5 || Trim(f[4]).empty()) return false;
        out.set("name", JValue::makeStr(Trim(f[4])));
        out.set("shape", JValue::makeStr("rect"));
        out.set("x1", JValue::makeNum(atoi(f[0].c_str()))); out.set("y1", JValue::makeNum(atoi(f[1].c_str())));
        out.set("x2", JValue::makeNum(atoi(f[2].c_str()))); out.set("y2", JValue::makeNum(atoi(f[3].c_str())));
        return true;
    }
    if (f.size() < 3 || Trim(f[0]).empty()) return false; // 名前,形,…
    std::string shape = Lower(f[1]);
    out.set("name", JValue::makeStr(Trim(f[0])));
    out.set("shape", JValue::makeStr(shape));
    if ((shape == "rect" || shape == "ellipse") && f.size() >= 6) {
        out.set("x1", JValue::makeNum(atoi(f[2].c_str()))); out.set("y1", JValue::makeNum(atoi(f[3].c_str())));
        out.set("x2", JValue::makeNum(atoi(f[4].c_str()))); out.set("y2", JValue::makeNum(atoi(f[5].c_str())));
        return true;
    }
    if (shape == "circle" && f.size() >= 5) {
        out.set("x1", JValue::makeNum(atoi(f[2].c_str()))); out.set("y1", JValue::makeNum(atoi(f[3].c_str())));
        out.set("x2", JValue::makeNum(atoi(f[4].c_str())));
        return true;
    }
    if (shape == "polygon" && f.size() >= 8) {
        std::string pts;
        for (size_t i = 2; i + 1 < f.size(); i += 2) {
            if (!pts.empty()) pts += " ";
            pts += NumToStr(atoi(f[i].c_str())) + "," + NumToStr(atoi(f[i + 1].c_str()));
        }
        out.set("points", JValue::makeStr(pts));
        return true;
    }
    return false;                                        // region（絵で形を決める）などは読まない
}

// うごきのこま 1 つを、プロジェクトの形にする。古い書式（2 つめが数）や、読めないものは false
static bool PatternToJson(const std::string& value, JValue& out) {
    std::vector<std::string> f = SplitComma(value);
    if (f.empty() || f[0].empty()) return false;
    std::string method = Lower(f[0]);
    if (method.find_first_not_of("0123456789-") == std::string::npos) return false;   // SERIKO/1 の書きかた
    out = JValue::makeObj();
    out.set("method", JValue::makeStr(method));
    auto num = [&](size_t i) { return i < f.size() ? atof(f[i].c_str()) : 0.0; };
    if (method == "start" || method == "stop" || method == "insert") {
        out.set("surface", JValue::makeNum((int)num(1)));
        return true;
    }
    if (method == "alternativestart" || method == "alternativestop" || method == "parallelstart" || method == "parallelstop") {
        // (1,2) / [1.2] のどちらでも、数を順に集める
        JValue ids = JValue::makeArr();
        std::string rest = value.substr(value.find(',') == std::string::npos ? value.size() : value.find(',') + 1);
        for (size_t i = 0; i < rest.size(); ) {
            if (rest[i] >= '0' && rest[i] <= '9') {
                size_t e = rest.find_first_not_of("0123456789", i);
                ids.arr.push_back(JValue::makeNum(atoi(rest.substr(i, e == std::string::npos ? std::string::npos : e - i).c_str())));
                i = e == std::string::npos ? rest.size() : e;
            } else {
                i++;
            }
        }
        out.set("ids", ids);
        return true;
    }
    if (method == "import") {                            // import,ファイル,ウェイト,X,Y
        out.set("file", JValue::makeStr(f.size() > 1 ? f[1] : ""));
        out.set("wait", JValue::makeNum((int)num(2)));
        out.set("x", JValue::makeNum((int)num(3))); out.set("y", JValue::makeNum((int)num(4)));
        return true;
    }
    out.set("surface", JValue::makeNum((int)num(1)));    // 重ねかた,絵,ウェイト,X,Y
    out.set("wait", JValue::makeNum((int)num(2)));
    out.set("x", JValue::makeNum(method == "scaling" ? num(3) : (int)num(3)));
    out.set("y", JValue::makeNum(method == "scaling" ? num(4) : (int)num(4)));
    return true;
}

// surfaces.txt のうごきと当たり判定を、プロジェクトの形にして r に足す
static void ReadSurfacesTxt(const std::string& text, ShellImport& r, std::vector<int>& numbers) {
    struct Anim { int base, id; std::string interval; int every = 4; std::map<int, JValue> patterns; std::vector<JValue> collisions; };
    std::vector<Anim> anims;
    std::map<std::pair<int, int>, size_t> animIndex;   // (立ち絵の番号, うごきの番号) → anims の何番目か
    // 無ければ作る。うごきが kMaxAnimations こを超えるときは null（それ以上は読まない）
    auto animOf = [&](int base, int id) -> Anim* {
        std::map<std::pair<int, int>, size_t>::iterator it = animIndex.find(std::make_pair(base, id));
        if (it != animIndex.end()) return &anims[it->second];
        if (anims.size() >= kMaxAnimations) return nullptr;
        Anim a;
        a.base = base;
        a.id = id;
        animIndex[std::make_pair(base, id)] = anims.size();
        anims.push_back(a);
        return &anims.back();
    };
    std::set<int> numberSet(numbers.begin(), numbers.end());
    // 四角い当たり判定を、立ち絵の番号ごとに集める（さいごに r.areas へ。見つけた順に）
    std::map<int, std::vector<JValue> > areaLists;
    std::vector<int> areaOrder;

    std::vector<int> targets;   // いま読んでいるかたまりの番号（{ … } の中）
    bool inBlock = false;
    std::vector<int> pending;   // 見出しを読んで、{ を待っているとき
    for (const std::string& line : SplitLines(text)) {
        if (line.empty() || line.compare(0, 2, "//") == 0) continue;
        if (!inBlock) {
            std::vector<int> nums = SurfaceHeaderNumbers(line);
            if (!nums.empty()) {
                pending = nums;
                for (int n : nums) if (numberSet.insert(n).second) numbers.push_back(n);
            } else if (line.find('{') == std::string::npos) {
                pending.clear();                         // descript など、立ち絵でないかたまり
            }
            if (line.find('{') != std::string::npos) { inBlock = true; targets = pending; pending.clear(); }
            continue;
        }
        if (line[0] == '}') { inBlock = false; targets.clear(); continue; }
        if (targets.empty()) continue;

        std::string low = Lower(line);
        int id = 0, index = 0;
        std::string key, value;
        if (AnimationKey(line, id, key, index, value)) {
            for (int base : targets) {
                Anim* ap = animOf(base, id);
                if (!ap) break;
                Anim& a = *ap;
                if (key == "interval") {
                    std::vector<std::string> f = SplitComma(value);
                    std::string iv = Lower(f[0]);
                    if ((iv == "random" || iv == "talk") && f.size() > 1) { a.interval = iv; a.every = atoi(f[1].c_str()); }
                    else a.interval = Lower(value);      // bind+random,5 のような組み合わせは、そのまま持つ
                } else if (key == "pattern") {
                    JValue p;
                    if (PatternToJson(value, p)) a.patterns[index] = p;
                    else if (base == targets[0]) r.skipped++;
                } else if (key == "collision" || key == "collisionex") {
                    JValue c;
                    if (CollisionToJson(key == "collisionex", SplitComma(value), c)) a.collisions.push_back(c);
                    else if (base == targets[0]) r.skipped++;
                }
                // option（exclusive など）は持つ場所がないので読まない
            }
            continue;
        }
        if (low.compare(0, 9, "collision") == 0) {
            bool ex = low.compare(0, 11, "collisionex") == 0;
            size_t comma = line.find(',');
            JValue c;
            if (ex || comma == std::string::npos || !CollisionToJson(false, SplitComma(line.substr(comma + 1)), c)) {
                r.skipped++;                             // 四角でない当たり判定は、立ち絵の上では描けないので読まない
                continue;
            }
            JValue area = JValue::makeObj();
            area.set("name", c["name"]);
            area.set("x1", c["x1"]); area.set("y1", c["y1"]); area.set("x2", c["x2"]); area.set("y2", c["y2"]);
            for (int base : targets) {
                std::vector<JValue>& list = areaLists[base];
                if (list.empty()) areaOrder.push_back(base);
                list.push_back(area);
            }
            continue;
        }
        // SERIKO/1 の書きかた（0interval,… 0pattern0,…）は読まない
        if (low[0] >= '0' && low[0] <= '9' && (low.find("interval") != std::string::npos || low.find("pattern") != std::string::npos)) {
            r.skipped++;
        }
    }

    for (int base : areaOrder) {
        std::string k = NumToStr(base);
        JValue list = r.areas[k.c_str()].isArr() ? r.areas[k.c_str()] : JValue::makeArr();
        for (JValue& a : areaLists[base]) list.arr.push_back(a);
        r.areas.set(k, list);
    }

    for (Anim& a : anims) {
        if (a.patterns.empty()) continue;                // こまの無いうごき（古い書式だけのもの）は持ってこない
        JValue o = JValue::makeObj();
        o.set("id", JValue::makeNum(a.id));
        o.set("base", JValue::makeNum(a.base));
        o.set("interval", JValue::makeStr(a.interval.empty() ? "never" : a.interval));
        o.set("every", JValue::makeNum(a.every < 1 ? 1 : a.every));
        JValue pats = JValue::makeArr();
        for (auto& p : a.patterns) pats.arr.push_back(p.second);
        o.set("patterns", pats);
        JValue cols = JValue::makeArr();
        for (JValue& c : a.collisions) cols.arr.push_back(c);
        o.set("collisions", cols);
        r.animations.arr.push_back(o);
    }
}

// シェルの descript.txt の着せ替えの名前（sakura.bindgroupN.name,種類,名前 / .default,1）を、うごきに付ける
static void ReadBindNames(const std::string& text, ShellImport& r) {
    for (const std::string& line : SplitLines(text)) {
        std::string low = Lower(line);
        bool kero = low.compare(0, 14, "kero.bindgroup") == 0;
        if (!kero && low.compare(0, 16, "sakura.bindgroup") != 0) continue;
        size_t start = kero ? 14 : 16;
        size_t dot = low.find('.', start);
        size_t comma = low.find(',');
        if (dot == std::string::npos || comma == std::string::npos || dot > comma) continue;
        int id = atoi(low.substr(start, dot - start).c_str());
        std::string key = low.substr(dot + 1, comma - dot - 1);
        std::vector<std::string> f = SplitComma(line.substr(comma + 1));
        for (JValue& a : r.animations.arr) {
            if (a["id"].asInt(-1) != id || (a["base"].asInt(0) >= 10) != kero) continue;
            if (a["interval"].asStr().find("bind") == std::string::npos) continue;
            JValue bind = a["bind"].isObj() ? a["bind"] : JValue::makeObj();
            if (key == "name" && f.size() >= 2) {
                bind.set("category", JValue::makeStr(f[0]));
                bind.set("part", JValue::makeStr(f[1]));
            } else if (key == "default") {
                bind.set("default", JValue::makeBool(atoi(f[0].c_str()) != 0));
            } else if (key == "addid") {
                JValue ids = JValue::makeArr();
                for (const std::string& s : f) if (!s.empty()) ids.arr.push_back(JValue::makeNum(atoi(s.c_str())));
                bind.set("addid", ids);
            }
            a.set("bind", bind);
        }
    }
    // 種類ごとのえらびかた（sakura.bindoptionN.group,種類,mustselect+multiple）を、その種類の着せ替えに付ける
    for (const std::string& line : SplitLines(text)) {
        std::string low = Lower(line);
        bool kero = low.compare(0, 15, "kero.bindoption") == 0;
        if (!kero && low.compare(0, 17, "sakura.bindoption") != 0) continue;
        size_t comma = low.find(',');
        if (comma == std::string::npos || low.find(".group") == std::string::npos) continue;
        std::vector<std::string> f = SplitComma(line.substr(comma + 1));
        if (f.size() < 2) continue;
        std::string option = Lower(f[1]);
        for (JValue& a : r.animations.arr) {
            if ((a["base"].asInt(0) >= 10) != kero || !a["bind"].isObj()) continue;
            if (a["bind"]["category"].asStr() != f[0]) continue;
            JValue bind = a["bind"];
            bind.set("option", JValue::makeStr(option));
            a.set("bind", bind);
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
        ReadSurfacesTxt(ToUtf8(txt), r, nums);
        std::string desc;
        if (ReadBinaryFile(PathJoin(r.folder, L"descript.txt"), desc)) ReadBindNames(ToUtf8(desc), r);
        std::sort(nums.begin(), nums.end());
        std::set<int> imageIds;
        for (size_t k = 0; k < r.images.size(); k++) imageIds.insert(r.images[k].id);
        for (size_t i = 0; i < nums.size(); i++) {
            if (!imageIds.count(nums[i])) r.compositeOnly.push_back(nums[i]);
        }
    }
    r.ok = true;
    return r;
}

} // namespace ikaga
