// 伺かスタジオ - 書き出し: 栞が読む ghost.json（エディタ専用の項目を落としたもの）
#include "exporter.h"
#include "util.h"

namespace ikaga {

std::string RuntimeProgramJson(const JValue& project) {
    const JValue& meta = project["meta"];
    const JValue& settings = project["settings"];

    JValue root = JValue::makeObj();
    root.set("format", JValue::makeStr("ikaga/1"));

    JValue m = JValue::makeObj();
    m.set("name", JValue::makeStr(GhostName(project)));
    m.set("sakuraName", JValue::makeStr(meta["sakuraName"].asStr(DefaultSakuraName(project))));
    m.set("keroName", JValue::makeStr(meta["keroName"].asStr(DefaultKeroName(project))));
    m.set("craftman", JValue::makeStr(meta["craftman"].asStr("")));
    m.set("craftmanUrl", JValue::makeStr(meta["craftmanUrl"].asStr("")));
    m.set("version", JValue::makeStr(meta["version"].asStr("1.0.0")));
    // 栞が自分で言う決まり文句と「いまごろ」などの値の言語。日本語のときは書きません
    // （無ければ日本語。前に書き出したものと同じ中身のままにするため）
    if (EnglishGhost(project)) m.set("lang", JValue::makeStr("en"));
    root.set("meta", m);

    JValue s = JValue::makeObj();
    s.set("randomTalkInterval", JValue::makeNum(settings["randomTalkInterval"].asNum(180)));
    s.set("randomTalkEnabled", JValue::makeBool(settings["randomTalkEnabled"].asBool(true)));
    s.set("noRepeatCount", JValue::makeNum(settings["noRepeatCount"].asNum(0)));
    root.set("settings", s);

    JValue vars = JValue::makeArr();
    const JValue& pv = project["variables"];
    for (size_t i = 0; i < pv.size(); i++) {
        const JValue& v = pv.at(i);
        if (v["name"].asStr().empty()) continue;
        JValue one = JValue::makeObj();
        one.set("name", JValue::makeStr(v["name"].asStr()));
        one.set("value", v["value"]);
        vars.arr.push_back(one);
    }
    root.set("variables", vars);

    JValue scripts = JValue::makeArr();
    const JValue& ps = project["scripts"];
    for (size_t i = 0; i < ps.size(); i++) {
        const JValue& src = ps.at(i);
        std::string kind = src["kind"].asStr();
        if (kind != "event" && kind != "talk" && kind != "function") continue;
        JValue one = JValue::makeObj();
        one.set("id", JValue::makeStr(src["id"].asStr()));
        one.set("kind", JValue::makeStr(kind));
        if (kind == "event") {
            one.set("event", JValue::makeStr(src["event"].asStr()));
            // くりかえしの間隔（毎秒でよければ書かない）
            int every = src["everySec"].asInt(1);
            if (every > 1) one.set("everySec", JValue::makeNum(every));
            // イベントの絞り込み。使っていなければ書かない。
            //   マウス系 … 当たった場所・相手
            //   ゴースト間通信 … 相手の名前・言われたことにふくまれる言葉
            // 前に別のイベントを選んでいたときの絞り込みが残っていても、
            // 今のイベントに関係しないものは書き出さない。
            std::string ev = src["event"].asStr();
            bool isMouse = (ev.compare(0, 7, "OnMouse") == 0) || ev == "OnNadeNade";
            bool isComm = (ev == "OnCommunicate");
            std::string area = isMouse ? src["area"].asStr() : std::string();
            int who = isMouse ? src["who"].asInt(-1) : -1;
            std::string from = isComm ? src["from"].asStr() : std::string();
            std::string contains = isComm ? src["contains"].asStr() : std::string();
            if (!area.empty() || who >= 0 || !from.empty() || !contains.empty()) {
                JValue f = JValue::makeObj();
                if (!area.empty()) f.set("area", JValue::makeStr(area));
                if (who >= 0) f.set("who", JValue::makeNum(who));
                if (!from.empty()) f.set("from", JValue::makeStr(from));
                if (!contains.empty()) f.set("contains", JValue::makeStr(contains));
                one.set("filter", f);
            }
        }
        if (kind == "talk" || kind == "function") one.set("name", JValue::makeStr(src["name"].asStr()));
        if (kind == "talk") {
            one.set("weight", JValue::makeNum(src["weight"].asNum(1)));
            // 「まとまり」（朝のトーク、など）。空なら書かない
            std::string group = Trim(src["group"].asStr());
            if (!group.empty()) one.set("group", JValue::makeStr(group));
        }
        if (src["disabled"].asBool(false)) one.set("disabled", JValue::makeBool(true));
        // かたまりのメモ（空なら書かない）。ブロックのメモは blocks の中にそのまま入ります
        if (!Trim(src["note"].asStr()).empty()) one.set("note", JValue::makeStr(src["note"].asStr()));
        one.set("blocks", src["blocks"].isArr() ? src["blocks"] : JValue::makeArr());
        scripts.arr.push_back(one);
    }
    root.set("scripts", scripts);

    return root.dump(2);
}

} // namespace ikaga
