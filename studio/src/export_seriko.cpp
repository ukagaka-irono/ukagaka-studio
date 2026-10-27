// 伺かスタジオ - 書き出し: SERIKO のうごき（surfaces.txt の animationN.*）
#include "export_parts.h"
#include "util.h"

#include <cstdio>
#include <algorithm>
#include <cstdlib>

namespace ikaga {

// SERIKO のアニメーション定義。
//
//   animationN.interval,sometimes
//   animationN.patternM,base,1,200,0,0
//
// interval は「いつ動きだすか」、pattern は「どの絵を何ミリ秒出すか」です。
// base は絵をまるごと差しかえる方式で、overlay は上に重ねる方式です。
// プロジェクトの animations に入っているもののうち、その surface のものだけ書きます。
//
// 書きかたは UKADOC の surfaces.txt（SERIKO/2.0 の新しい書式）に合わせています。
//   start / stop / insert,ID            … 番号だけ（ウェイトは見られない）
//   alternativestart など,(ID1,ID2,…)  … まとめて動かす・止める
//   scaling,絵,ウェイト,X,Y             … X・Y は倍率（%。小数も書ける）
//   interval,bind と add                … 着せ替え（名前とメニューはシェルの descript.txt。BindDescriptLines）

// 知っている重ねかた（ui/js/model/model.js の ANIM_METHODS と同じ）
static bool KnownMethod(const std::string& m) {
    static const char* kMethods[] = {
        "overlay", "overlayfast", "base", "replace", "interpolate", "asis", "reduce", "move", "scaling", "add",
        "start", "stop", "alternativestart", "alternativestop", "parallelstart", "parallelstop", "insert", "import",
    };
    static const char* kBlends[] = {
        "multiply", "screen", "overlay", "add", "add-glow", "soft-light", "hard-light",
        "color-dodge", "color-burn", "linear-burn", "linear-light", "vivid-light", "pin-light", "hard-mix",
        "darken", "lighten", "darker-color", "lighter-color", "difference", "exclusion", "subtract", "divide",
        "color", "luminosity", "hue", "saturation", "dither",
    };
    for (size_t i = 0; i < sizeof(kMethods) / sizeof(kMethods[0]); i++) if (m == kMethods[i]) return true;
    if (m.compare(0, 6, "blend-") == 0) {
        for (size_t i = 0; i < sizeof(kBlends) / sizeof(kBlends[0]); i++) if (m.substr(6) == kBlends[i]) return true;
    }
    return false;
}

static bool IsGroupMethod(const std::string& m) {
    return m == "alternativestart" || m == "alternativestop" || m == "parallelstart" || m == "parallelstop";
}
std::string AnimationLines(const JValue& project, int surfaceId) {
    const JValue& anims = project["animations"];
    if (!anims.isArr()) return std::string();

    std::string out;
    for (size_t i = 0; i < anims.size(); i++) {
        const JValue& a = anims.at(i);
        if (!a.isObj()) continue;
        if (a["base"].asInt(0) != surfaceId) continue;
        if (a["disabled"].asBool(false)) continue;

        int id = a["id"].asInt((int)i);
        if (id < 0 || id > 127) continue;

        std::string interval = a["interval"].asStr("never");
        if (interval.empty()) interval = "never";
        // "random" と "talk" は回数が要る（random,4 のように書く）
        if (interval == "random" || interval == "talk") {
            char n[24];
            sprintf_s(n, ",%d", a["every"].asInt(4) < 1 ? 1 : a["every"].asInt(4));
            interval += n;
        }
        const JValue& pats = a["patterns"];
        std::string body;
        int m = 0;
        for (size_t k = 0; k < pats.size(); k++) {
            const JValue& p = pats.at(k);
            if (!p.isObj()) continue;
            // 重ねかた（SERIKO の描画メソッド）。知らない名前は base に倒す。
            std::string method = p["method"].asStr("base");
            if (!KnownMethod(method)) method = "base";
            int surf = p["surface"].asInt(0);
            int wait = p["wait"].asInt(200);
            if (wait < 0) wait = 0;
            // こまごとの位置ずらし（基準の絵の左上からの相対）
            int px = p["x"].asInt(0), py = p["y"].asInt(0);
            if (px < -9999) px = -9999; if (px > 9999) px = 9999;
            if (py < -9999) py = -9999; if (py > 9999) py = 9999;
            char buf[320];

            if (method == "start" || method == "stop" || method == "insert") {
                // 別のうごきを動かす／止める、着せ替えを描く順の場所。番号だけを書く（ウェイトは見られない）
                if (surf < 0 || surf > 127) continue;
                sprintf_s(buf, "animation%d.pattern%d,%s,%d\r\n", id, m++, method.c_str(), surf);
                body += buf;
                continue;
            }
            if (IsGroupMethod(method)) {
                // いくつかのうごきの、どれか 1 つ（alternative）／ぜんぶ（parallel）を動かす・止める
                std::string ids;
                const JValue& list = p["ids"];
                for (size_t n = 0; n < list.size(); n++) {
                    int v = list.at(n).asInt(-1);
                    if (v < 0 || v > 127) continue;
                    if (!ids.empty()) ids += ",";
                    ids += NumToStr(v);
                }
                if (ids.empty()) continue;
                body += "animation" + NumToStr(id) + ".pattern" + NumToStr(m++) + "," + method + ",(" + ids + ")\r\n";
                continue;
            }
            if (method == "scaling") {
                // 大きさ。X・Y は倍率（%）で、小数も書ける（1〜1000 に収める）
                double sx = p["x"].asNum(100), sy = p["y"].asNum(100);
                if (!(sx >= 1)) sx = 1; if (sx > 1000) sx = 1000;
                if (!(sy >= 1)) sy = 1; if (sy > 1000) sy = 1000;
                body += "animation" + NumToStr(id) + ".pattern" + NumToStr(m++) + ",scaling," + NumToStr(surf) + "," +
                        NumToStr(wait) + "," + NumToStr(sx) + "," + NumToStr(sy) + "\r\n";
                continue;
            }
            if (method == "import") {
                // APNG / GIF / WebP をそのまま差しこむ
                std::string file = Trim(p["file"].asStr());
                if (file.empty() || file.size() > 160) continue;
                if (file.find(',') != std::string::npos) continue;      // 1 行が壊れる
                if (file.find("..") != std::string::npos) continue;     // 外へは出さない
                if (file.find('\r') != std::string::npos ||
                    file.find('\n') != std::string::npos) continue;
                sprintf_s(buf, "animation%d.pattern%d,import,%s,%d,%d,%d\r\n",
                          id, m++, file.c_str(), wait, px, py);
                body += buf;
                continue;
            }

            sprintf_s(buf, "animation%d.pattern%d,%s,%d,%d,%d,%d\r\n",
                      id, m++, method.c_str(), surf, wait, px, py);
            body += buf;
        }
        // 絵の指定が 1 つも無ければ、動かしようがないので何も書かない
        if (m == 0) continue;

        // このうごきが動いている間だけ有効な当たり判定。
        // 四角は collision、それ以外の形は collisionex で書きます。
        const JValue& cols = a["collisions"];
        int c = 0, cx = 0;
        for (size_t k = 0; k < cols.size(); k++) {
            const JValue& one = cols.at(k);
            if (!one.isObj()) continue;
            std::string name = Trim(one["name"].asStr());
            if (name.empty()) continue;
            for (size_t n = 0; n < name.size(); n++) {         // 1 行に収める
                if (name[n] == ',' || name[n] == '\r' || name[n] == '\n') name[n] = ' ';
            }
            std::string shape = one["shape"].asStr("rect");
            int x1 = one["x1"].asInt(0), y1 = one["y1"].asInt(0);
            int x2 = one["x2"].asInt(0), y2 = one["y2"].asInt(0);
            // 名前の長さは決まっていないので、決まった大きさの入れものには書かず、std::string でつなぐ
            // （長い名前で書き出しが止まらないように）
            const std::string head = "animation" + NumToStr(id);
            const std::string at = "," + NumToStr(x1) + "," + NumToStr(y1);

            if (shape == "ellipse") {
                body += head + ".collisionex" + NumToStr(cx++) + "," + name + ",ellipse" + at + "," +
                        NumToStr(x2) + "," + NumToStr(y2) + "\r\n";
            } else if (shape == "circle") {
                if (x2 <= 0) continue;                         // 半径 0 は触れない
                body += head + ".collisionex" + NumToStr(cx++) + "," + name + ",circle" + at + "," + NumToStr(x2) + "\r\n";
            } else if (shape == "polygon") {
                // "100,100 200,300 50,200" のように書いてもらったものを数だけ取り出す
                std::vector<int> nums;
                std::string src = one["points"].asStr();
                for (size_t n = 0; n < src.size(); ) {
                    if ((src[n] >= '0' && src[n] <= '9') || src[n] == '-') {
                        size_t e = n + 1;
                        while (e < src.size() && src[e] >= '0' && src[e] <= '9') e++;
                        nums.push_back(atoi(src.substr(n, e - n).c_str()));
                        n = e;
                    } else {
                        n++;
                    }
                }
                if (nums.size() < 6 || nums.size() % 2 != 0) continue;   // かどは 3 つ以上
                if (nums.size() > 64) nums.resize(64);
                std::string line = "animation" + NumToStr(id) + ".collisionex" +
                                   NumToStr(cx++) + "," + name + ",polygon";
                for (size_t n = 0; n < nums.size(); n++) line += "," + NumToStr(nums[n]);
                body += line + "\r\n";
            } else {
                body += head + ".collision" + NumToStr(c++) + at + "," + NumToStr(x2) + "," + NumToStr(y2) + "," + name + "\r\n";
            }
        }

        char head2[96];
        sprintf_s(head2, "animation%d.interval,", id);
        out += head2;
        out += interval;
        out += "\r\n";
        out += body;
    }
    return out;
}

// 着せ替え（interval が bind のうごき）の名前とメニューを、シェルの descript.txt の行にする。
//   sakura.bindgroup<番号>.name,<種類>,<名前>   sakura.bindgroup<番号>.default,1   sakura.menuitem<順>,<番号>
//   sakura.bindgroup<番号>.addid,<番号>,…（いっしょに着る）   sakura.bindoption<順>.group,<種類>,<えらびかた>
// 付ける立ち絵が 10 番以上なら相方（kero.）のもの。種類か名前が空なら、SSP のメニューに出せないので書きません。
std::string BindDescriptLines(const JValue& project) {
    const JValue& anims = project["animations"];
    if (!anims.isArr()) return std::string();
    struct One { int id; bool kero; std::string category, part; bool def; std::string option, addid; };
    std::vector<One> list;
    for (size_t i = 0; i < anims.size(); i++) {
        const JValue& a = anims.at(i);
        if (!a.isObj() || a["disabled"].asBool(false)) continue;
        if (a["interval"].asStr() != "bind") continue;
        int id = a["id"].asInt((int)i);
        if (id < 0 || id > 127) continue;
        One o;
        o.id = id;
        o.kero = a["base"].asInt(0) >= 10;
        o.category = Trim(a["bind"]["category"].asStr());
        o.part = Trim(a["bind"]["part"].asStr());
        o.def = a["bind"]["default"].asBool(false);
        o.option = a["bind"]["option"].asStr();
        if (o.option != "mustselect" && o.option != "multiple" && o.option != "mustselect+multiple") o.option.clear();
        const JValue& add = a["bind"]["addid"];
        for (size_t n = 0; n < add.size(); n++) {
            int v = add.at(n).asInt(-1);
            if (v < 0 || v > 127 || v == id) continue;
            if (!o.addid.empty()) o.addid += ",";
            o.addid += NumToStr(v);
        }
        for (std::string* f : { &o.category, &o.part }) {      // 1 行に収める
            for (size_t n = 0; n < f->size(); n++) {
                if ((*f)[n] == ',' || (*f)[n] == '\r' || (*f)[n] == '\n') (*f)[n] = ' ';
            }
        }
        if (o.category.empty() || o.part.empty()) continue;
        list.push_back(o);
    }
    std::sort(list.begin(), list.end(), [](const One& a, const One& b) { return a.id < b.id; });
    std::string out;
    for (int kero = 0; kero <= 1; kero++) {
        const char* who = kero ? "kero" : "sakura";
        int menu = 0;
        for (const One& o : list) {
            if (o.kero != (kero == 1)) continue;
            std::string key = std::string(who) + ".bindgroup" + NumToStr(o.id);
            out += DescriptLine((key + ".name").c_str(), o.category + "," + o.part);
            if (o.def) out += DescriptLine((key + ".default").c_str(), "1");
            if (!o.addid.empty()) out += DescriptLine((key + ".addid").c_str(), o.addid);
            out += DescriptLine((std::string(who) + ".menuitem" + NumToStr(menu++)).c_str(), NumToStr(o.id));
        }
        // 種類ごとのえらびかた（その種類で、最初にえらびかたを決めたものに合わせる）
        std::vector<std::string> done;
        int opt = 0;
        for (const One& o : list) {
            if (o.kero != (kero == 1) || o.option.empty()) continue;
            if (std::find(done.begin(), done.end(), o.category) != done.end()) continue;
            done.push_back(o.category);
            out += DescriptLine((std::string(who) + ".bindoption" + NumToStr(opt++) + ".group").c_str(), o.category + "," + o.option);
        }
    }
    return out;
}

} // namespace ikaga
