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
void AppendBalloon(std::vector<OutFile>& files, const JValue& project) {
    const JValue& shell = project["shell"];
    Rgb bg = RgbFromHex(shell["balloonColor"].asStr("#fffdf5"), Rgb());
    Rgb line = Shade(bg, -0.35);
    Rgb text = Shade(bg, -0.82);

    const int W = 330, H = 210;
    const int TAIL = 16;              // 下のしっぽのぶん
    const int BODY = H - TAIL;

    // 本体側（しっぽは左寄り）と相方側（しっぽは右寄り）
    for (int side = 0; side < 2; side++) {
        Canvas c(W, H);
        c.RoundRect(0, 0, W, (double)BODY, 18, line, 1.0);
        c.RoundRect(2, 2, W - 4, (double)BODY - 4, 16, bg, 1.0);

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
             DescriptLine("name", project["meta"]["name"].asStr("なしゴースト") + " のバルーン") +
             DescriptLine("craftman", project["meta"]["craftman"].asStr("unknown"));
    d.data += "origin.x,18\r\norigin.y,16\r\n";
    d.data += "validrect.left,0\r\nvalidrect.top,0\r\nvalidrect.right,0\r\n";
    sprintf_s(buf, "validrect.bottom,-%d\r\n", TAIL);
    d.data += buf;
    d.data += "wordwrappoint.x,-22\r\n";
    sprintf_s(buf, "font.color.r,%d\r\n", (int)text.r); d.data += buf;
    sprintf_s(buf, "font.color.g,%d\r\n", (int)text.g); d.data += buf;
    sprintf_s(buf, "font.color.b,%d\r\n", (int)text.b); d.data += buf;
    d.data += "arrow0.x,300\r\narrow0.y,8\r\n";
    sprintf_s(buf, "arrow1.x,300\r\narrow1.y,-%d\r\n", TAIL + 14);
    d.data += buf;
    files.push_back(d);
}

} // namespace ikaga
