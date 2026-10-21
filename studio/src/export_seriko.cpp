// 伺かスタジオ - 書き出し: SERIKO のうごき（surfaces.txt の animationN.*）
#include "export_parts.h"
#include "util.h"

#include <cstdio>
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
            static const char* kMethods[] = {
                "overlay", "overlayfast", "base", "replace",
                "interpolate", "asis", "reduce", "move",
                "blend-multiply", "blend-screen", "blend-overlay", "blend-add",
                "start", "stop", "import",
            };
            std::string method = p["method"].asStr("base");
            bool known = false;
            for (size_t mi = 0; mi < sizeof(kMethods) / sizeof(kMethods[0]); mi++) {
                if (method == kMethods[mi]) { known = true; break; }
            }
            if (!known) method = "base";
            int surf = p["surface"].asInt(0);
            int wait = p["wait"].asInt(200);
            if (wait < 0) wait = 0;
            // こまごとの位置ずらし（基準の絵の左上からの相対）
            int px = p["x"].asInt(0), py = p["y"].asInt(0);
            if (px < -9999) px = -9999; if (px > 9999) px = 9999;
            if (py < -9999) py = -9999; if (py > 9999) py = 9999;
            char buf[320];

            if (method == "start" || method == "stop") {
                // 別のうごきを動かす／止める。番号だけを書く（ウェイトは見られない）
                if (surf < 0 || surf > 127) continue;
                sprintf_s(buf, "animation%d.pattern%d,%s,%d\r\n", id, m++, method.c_str(), surf);
                body += buf;
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
            char cbuf[320];

            if (shape == "ellipse") {
                sprintf_s(cbuf, "animation%d.collisionex%d,%s,ellipse,%d,%d,%d,%d\r\n",
                          id, cx++, name.c_str(), x1, y1, x2, y2);
                body += cbuf;
            } else if (shape == "circle") {
                if (x2 <= 0) continue;                         // 半径 0 は触れない
                sprintf_s(cbuf, "animation%d.collisionex%d,%s,circle,%d,%d,%d\r\n",
                          id, cx++, name.c_str(), x1, y1, x2);
                body += cbuf;
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
                sprintf_s(cbuf, "animation%d.collision%d,%d,%d,%d,%d,%s\r\n",
                          id, c++, x1, y1, x2, y2, name.c_str());
                body += cbuf;
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

} // namespace ikaga
