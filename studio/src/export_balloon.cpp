// 伺かスタジオ - 書き出し: ゴーストに同梱するバルーン（吹き出し）
#include "export_parts.h"
#include "image.h"

#include <cstdio>

namespace ikaga {

// ゴーストに同梱するバルーンを作ります。中身は
//   balloon/descript.txt … 文字を書く場所などの決まりごと
//   balloon/balloons0.png … 本体（さくら）側、balloonk0.png … 相方側
//   balloon/arrow0.png / arrow1.png … 続きがあるときの目印（上向き・下向き）
// で、install.txt の balloon.source.directory で「アーカイブの中の場所」を伝えます。
//
// 見た目は「キャラと絵」でえらべます（shell の balloon〜）。
//   balloonShape  … round（角丸）/ square（四角）/ soft（大きくまるい）
//   balloonSize   … small / normal / large
//   balloonTail   … しっぽ（下の三角）を付けるか
//   balloonCustomColors … 線と文字の色を自分で決めるか（決めなければ地の色から作る）
void AppendBalloon(std::vector<OutFile>& files, const JValue& project) {
    const JValue& shell = project["shell"];
    Rgb bg = RgbFromHex(shell["balloonColor"].asStr("#fffdf5"), Rgb());
    Rgb line = Shade(bg, -0.35);
    Rgb text = Shade(bg, -0.82);
    if (shell["balloonCustomColors"].asBool(false)) {
        line = RgbFromHex(shell["balloonLineColor"].asStr(""), line);
        text = RgbFromHex(shell["balloonTextColor"].asStr(""), text);
    }

    std::string size = shell["balloonSize"].asStr("normal");
    const int W = size == "small" ? 270 : size == "large" ? 420 : 330;
    const int H = size == "small" ? 170 : size == "large" ? 260 : 210;
    const int TAIL = shell["balloonTail"].asBool(true) ? 16 : 0;    // 下のしっぽのぶん
    const int BODY = H - TAIL;
    std::string shape = shell["balloonShape"].asStr("round");
    const double R = shape == "square" ? 4.0 : shape == "soft" ? 48.0 : 18.0;   // かどのまるみ

    // 本体側（しっぽは左寄り）と相方側（しっぽは右寄り）
    for (int side = 0; side < 2; side++) {
        Canvas c(W, H);
        c.RoundRect(0, 0, W, (double)BODY, R, line, 1.0);
        c.RoundRect(2, 2, W - 4, (double)BODY - 4, R > 3 ? R - 2 : 1, bg, 1.0);

        if (TAIL > 0) {
        double tx = side == 0 ? 46.0 : (double)W - 46.0;
        std::vector<std::pair<double, double> > tail;
        tail.push_back(std::make_pair(tx - 15, (double)BODY - 6));
        tail.push_back(std::make_pair(tx + 15, (double)BODY - 6));
        tail.push_back(std::make_pair(tx + (side == 0 ? -4 : 4), (double)H - 1));
        c.Polygon(tail, line, 1.0);
        std::vector<std::pair<double, double> > inner;
        inner.push_back(std::make_pair(tx - 11, (double)BODY - 8));
        inner.push_back(std::make_pair(tx + 11, (double)BODY - 8));
        inner.push_back(std::make_pair(tx + (side == 0 ? -4 : 4), (double)H - 5));
        c.Polygon(inner, bg, 1.0);
        }

        OutFile f;
        f.shell = true;               // 自分で描いたものがあれば、そちらを残す
        f.name = side == 0 ? "balloon/balloons0.png" : "balloon/balloonk0.png";
        f.data = c.ToPng();
        files.push_back(f);
    }

    // 続きがあるときの目印（上向き・下向きの三角）
    for (int dir = 0; dir < 2; dir++) {
        Canvas c(16, 12);
        std::vector<std::pair<double, double> > t;
        if (dir == 0) {                               // arrow0 = 上向き
            t.push_back(std::make_pair(8.0, 1.0));
            t.push_back(std::make_pair(15.0, 10.0));
            t.push_back(std::make_pair(1.0, 10.0));
        } else {                                      // arrow1 = 下向き
            t.push_back(std::make_pair(8.0, 11.0));
            t.push_back(std::make_pair(15.0, 2.0));
            t.push_back(std::make_pair(1.0, 2.0));
        }
        c.Polygon(t, line, 1.0);
        OutFile f;
        f.shell = true;
        f.name = dir == 0 ? "balloon/arrow0.png" : "balloon/arrow1.png";
        f.data = c.ToPng();
        files.push_back(f);
    }

    char buf[64];
    OutFile d;
    d.shell = false;
    d.name = "balloon/descript.txt";
    d.data = DescriptLine("charset", "UTF-8") + DescriptLine("type", "balloon") +
             DescriptLine("name", GhostName(project) + ByGhostLang(project, " のバルーン", " Balloon")) +
             DescriptLine("craftman", project["meta"]["craftman"].asStr("unknown"));
    // まるいかどの内がわから書きはじめる
    sprintf_s(buf, "origin.x,%d\r\norigin.y,%d\r\n", shape == "soft" ? 30 : 18, shape == "soft" ? 24 : 16);
    d.data += buf;
    d.data += "validrect.left,0\r\nvalidrect.top,0\r\nvalidrect.right,0\r\n";
    sprintf_s(buf, TAIL ? "validrect.bottom,-%d\r\n" : "validrect.bottom,%d\r\n", TAIL);
    d.data += buf;
    sprintf_s(buf, "wordwrappoint.x,-%d\r\n", shape == "soft" ? 34 : 22);
    d.data += buf;
    sprintf_s(buf, "font.color.r,%d\r\n", (int)text.r); d.data += buf;
    sprintf_s(buf, "font.color.g,%d\r\n", (int)text.g); d.data += buf;
    sprintf_s(buf, "font.color.b,%d\r\n", (int)text.b); d.data += buf;
    sprintf_s(buf, "arrow0.x,%d\r\narrow0.y,8\r\n", W - 30);
    d.data += buf;
    sprintf_s(buf, "arrow1.x,%d\r\narrow1.y,-%d\r\n", W - 30, TAIL + 14);
    d.data += buf;
    files.push_back(d);
}

} // namespace ikaga
