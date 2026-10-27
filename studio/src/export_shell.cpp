// 伺かスタジオ - 書き出し: シェル（仮の立ち絵・descript.txt・surfaces.txt）
#include "exporter.h"
#include "export_parts.h"
#include "image.h"
#include "fsutil.h"
#include "util.h"

#include <cstdio>

namespace ikaga {

// -------------------------------------------------------- 仮シェルの生成

static const Rgb kSkin = { 255, 232, 216 };
static const Rgb kLine = { 78, 62, 70 };
static const Rgb kWhite = { 255, 255, 255 };
static const Rgb kBlush = { 255, 150, 160 };
static const Rgb kMouth = { 190, 90, 110 };

// face: 0=ふつう 1=わらい 2=おどろき
static std::string DrawCharacter(int w, int h, const std::string& hairHex,
                                 const std::string& clothHex, int face) {
    Canvas c(w, h);
    Rgb hair = RgbFromHex(hairHex, Rgb{ 240, 140, 170 });
    Rgb cloth = RgbFromHex(clothHex, Rgb{ 110, 130, 200 });
    double cx = w / 2.0;
    double headR = w * 0.30;
    double headY = h * 0.33;
    double bodyTop = headY + headR * 0.85;

    std::vector<std::pair<double, double> > dress;
    dress.push_back(std::make_pair(cx - w * 0.16, bodyTop));
    dress.push_back(std::make_pair(cx + w * 0.16, bodyTop));
    dress.push_back(std::make_pair(cx + w * 0.34, h - 2.0));
    dress.push_back(std::make_pair(cx - w * 0.34, h - 2.0));
    c.Polygon(dress, cloth);
    c.RoundRect(cx - w * 0.17, bodyTop - 4, w * 0.34, h * 0.12, 8, Shade(cloth, 0.12));

    c.Ellipse(cx - w * 0.30, bodyTop + h * 0.12, w * 0.07, h * 0.10, Shade(cloth, -0.08));
    c.Ellipse(cx + w * 0.30, bodyTop + h * 0.12, w * 0.07, h * 0.10, Shade(cloth, -0.08));
    c.Ellipse(cx - w * 0.31, bodyTop + h * 0.20, w * 0.055, w * 0.055, kSkin);
    c.Ellipse(cx + w * 0.31, bodyTop + h * 0.20, w * 0.055, w * 0.055, kSkin);

    c.Ellipse(cx, headY + 4, headR * 1.14, headR * 1.12, hair);
    c.Ellipse(cx, headY, headR, headR * 0.98, kSkin);
    c.Ellipse(cx, headY - headR * 0.34, headR * 1.06, headR * 0.72, hair);
    c.Ellipse(cx - headR * 0.92, headY + headR * 0.30, headR * 0.26, headR * 0.72, hair);
    c.Ellipse(cx + headR * 0.92, headY + headR * 0.30, headR * 0.26, headR * 0.72, hair);

    double eyeY = headY + headR * 0.16;
    double eyeDx = headR * 0.42;
    double eyeR = headR * 0.155;

    for (int side = 0; side < 2; side++) {
        double ex = cx + (side == 0 ? -eyeDx : eyeDx);
        if (face == 1) {
            double t = eyeR * 0.36 > 2.0 ? eyeR * 0.36 : 2.0;
            std::vector<std::pair<double, double> > pts;
            pts.push_back(std::make_pair(ex - eyeR, eyeY + eyeR * 0.45));
            pts.push_back(std::make_pair(ex, eyeY - eyeR * 0.5));
            pts.push_back(std::make_pair(ex + eyeR, eyeY + eyeR * 0.45));
            pts.push_back(std::make_pair(ex + eyeR, eyeY + eyeR * 0.45 + t));
            pts.push_back(std::make_pair(ex, eyeY - eyeR * 0.5 + t));
            pts.push_back(std::make_pair(ex - eyeR, eyeY + eyeR * 0.45 + t));
            c.Polygon(pts, kLine);
        } else {
            double s = face == 2 ? 1.35 : 1.0;
            c.Ellipse(ex, eyeY, eyeR * 0.85 * s, eyeR * 1.15 * s, kLine);
            c.Ellipse(ex - eyeR * 0.25, eyeY - eyeR * 0.35, eyeR * 0.28, eyeR * 0.32, kWhite);
        }
    }

    c.Ellipse(cx - headR * 0.62, eyeY + headR * 0.26, headR * 0.2, headR * 0.12, kBlush, 0.55);
    c.Ellipse(cx + headR * 0.62, eyeY + headR * 0.26, headR * 0.2, headR * 0.12, kBlush, 0.55);

    double mouthY = headY + headR * 0.52;
    if (face == 2) {
        c.Ellipse(cx, mouthY, headR * 0.12, headR * 0.17, kMouth);
    } else if (face == 1) {
        std::vector<std::pair<double, double> > m;
        m.push_back(std::make_pair(cx - headR * 0.16, mouthY - headR * 0.06));
        m.push_back(std::make_pair(cx + headR * 0.16, mouthY - headR * 0.06));
        m.push_back(std::make_pair(cx, mouthY + headR * 0.14));
        c.Polygon(m, kMouth);
    } else {
        c.Ellipse(cx, mouthY, headR * 0.09, headR * 0.05, kMouth);
    }
    return c.ToPng();
}

// DrawCharacter の配置に合わせた当たり判定。
// なでなで／クリックのイベントは、ここで付けた名前で絞り込みます。
std::vector<HitArea> DefaultHitAreas(int w, int h) {
    // 頭は中心 y=0.33h・半径 0.30w、体はその下から。
    const double headY = h * 0.33, headR = w * 0.30;
    const double eyeY = headY + headR * 0.16;
    const double bodyTop = headY + headR * 0.85;

    struct Area { const char* name; double x1, y1, x2, y2; };
    Area areas[] = {
        { "Head",  w * 0.18, headY - headR * 1.15, w * 0.82, eyeY },
        { "Face",  w * 0.24, eyeY,                 w * 0.76, bodyTop },
        { "Bust",  w * 0.30, bodyTop,              w * 0.70, h * 0.78 },
        { "Skirt", w * 0.10, h * 0.78,             w * 0.90, (double)h },
        { "Hand",  w * 0.18, bodyTop + h * 0.10,   w * 0.30, bodyTop + h * 0.26 },
        { "Hand",  w * 0.70, bodyTop + h * 0.10,   w * 0.82, bodyTop + h * 0.26 },
    };
    std::vector<HitArea> out;
    for (int i = 0; i < (int)(sizeof(areas) / sizeof(areas[0])); i++) {
        HitArea a;
        a.name = areas[i].name;
        a.x1 = (int)areas[i].x1;
        a.y1 = areas[i].y1 < 0 ? 0 : (int)areas[i].y1;
        a.x2 = (int)areas[i].x2;
        a.y2 = (int)areas[i].y2;
        out.push_back(a);
    }
    return out;
}

static std::string CollisionLines(int w, int h) {
    char buf[256];
    std::string out;
    std::vector<HitArea> areas = DefaultHitAreas(w, h);
    for (size_t i = 0; i < areas.size(); i++) {
        sprintf_s(buf, "collision%d,%d,%d,%d,%d,%s\r\n", (int)i,
                  areas[i].x1, areas[i].y1, areas[i].x2, areas[i].y2, areas[i].name.c_str());
        out += buf;
    }
    return out;
}

// 絵の上で描いた当たり判定（shell.areas の、その番号のもの）。1 つも無ければ空で、自動の形を使う
static std::string CustomCollisionLines(const JValue& project, int surfaceId) {
    const JValue& list = project["shell"]["areas"][NumToStr(surfaceId).c_str()];
    if (!list.isArr()) return std::string();
    std::string out;
    int n = 0;
    for (size_t i = 0; i < list.size(); i++) {
        const JValue& a = list.at(i);
        std::string name = Trim(a["name"].asStr());
        if (name.empty()) continue;
        for (size_t k = 0; k < name.size(); k++) {              // 1 行に収める
            if (name[k] == ',' || name[k] == '\r' || name[k] == '\n') name[k] = ' ';
        }
        int x1 = a["x1"].asInt(0), y1 = a["y1"].asInt(0), x2 = a["x2"].asInt(0), y2 = a["y2"].asInt(0);
        if (x1 > x2) { int t = x1; x1 = x2; x2 = t; }
        if (y1 > y2) { int t = y1; y1 = y2; y2 = t; }
        if (x1 < 0) x1 = 0;
        if (y1 < 0) y1 = 0;
        if (x2 - x1 < 2 || y2 - y1 < 2) continue;               // 小さすぎるものは、さわれないので書かない
        out += "collision" + NumToStr(n++) + "," + NumToStr(x1) + "," + NumToStr(y1) + "," +
               NumToStr(x2) + "," + NumToStr(y2) + "," + name + "\r\n";
    }
    return out;
}

std::string RenderSurfacePng(int surfaceId, const std::string& hairHex, const std::string& clothHex) {
    const int SW = 190, SH = 320, KW = 140, KH = 230;
    bool kero = surfaceId >= 10;
    int face = surfaceId - (kero ? 10 : 0);
    if (face < 0 || face > 2) face = 0;
    std::string hair = hairHex.empty() ? (kero ? "#8fd18a" : "#f08cae") : hairHex;
    std::string cloth = clothHex.empty() ? (kero ? "#e8b45c" : "#6e82c8") : clothHex;
    return DrawCharacter(kero ? KW : SW, kero ? KH : SH, hair, cloth, face);
}

// プロジェクトで指定した画像ファイル。無ければ空。
std::string ShellImagePath(const JValue& project, int surfaceId) {
    const JValue& list = project["shell"]["images"];
    for (size_t i = 0; i < list.size(); i++) {
        const JValue& one = list.at(i);
        if (one["id"].asInt(-1) == surfaceId) return one["path"].asStr();
    }
    return std::string();
}

void AppendShell(std::vector<OutFile>& files, const JValue& project) {
    const JValue& shell = project["shell"];
    const JValue& meta = project["meta"];
    std::string sakuraHair = shell["sakuraColor"].asStr("#f08cae");
    std::string sakuraCloth = shell["sakuraCloth"].asStr("#6e82c8");
    std::string keroHair = shell["keroColor"].asStr("#8fd18a");
    std::string keroCloth = shell["keroCloth"].asStr("#e8b45c");

    const int SW = 190, SH = 320, KW = 140, KH = 230;
    struct Surface { int id; int w, h; const std::string* hair; const std::string* cloth; int face; };
    std::vector<Surface> list;
    const int stdIds[6] = { 0, 1, 2, 10, 11, 12 };
    for (int i = 0; i < 6; i++) {
        Surface s;
        s.id = stdIds[i];
        bool kero = s.id >= 10;
        s.w = kero ? KW : SW;
        s.h = kero ? KH : SH;
        s.hair = kero ? &keroHair : &sakuraHair;
        s.cloth = kero ? &keroCloth : &sakuraCloth;
        s.face = s.id - (kero ? 10 : 0);
        list.push_back(s);
    }
    // 用意した画像だけにある番号（21番など）も書き出す
    const JValue& images = shell["images"];
    for (size_t i = 0; i < images.size(); i++) {
        int id = images.at(i)["id"].asInt(-1);
        if (id < 0 || images.at(i)["path"].asStr().empty()) continue;
        bool known = false;
        for (size_t k = 0; k < list.size(); k++) {
            if (list[k].id == id) { known = true; break; }
        }
        if (known) continue;
        Surface s;
        s.id = id;
        bool kero = id >= 10;
        s.w = kero ? KW : SW;
        s.h = kero ? KH : SH;
        s.hair = kero ? &keroHair : &sakuraHair;
        s.cloth = kero ? &keroCloth : &sakuraCloth;
        s.face = 0;
        list.push_back(s);
    }

    for (size_t i = 0; i < list.size(); i++) {
        OutFile f;
        char name[32];
        sprintf_s(name, "surface%d.png", list[i].id);
        f.name = std::string("shell/master/") + name;
        f.shell = true;

        // 画像を指定していればそれを使う。読めなければ自動生成にもどす。
        std::string path = ShellImagePath(project, list[i].id);
        std::string data;
        int w = 0, h = 0;
        if (!path.empty() && IsLocalPath(Utf8ToWide(path)) && ReadBinaryFile(Utf8ToWide(path), data) && PngSize(data, &w, &h)) {
            f.data = data;
            f.shell = false;   // 自分でえらんだ絵は、既存があっても書きこむ
            list[i].w = w;
            list[i].h = h;
        } else {
            f.data = DrawCharacter(list[i].w, list[i].h, *list[i].hair, *list[i].cloth, list[i].face);
        }
        files.push_back(f);
    }

    OutFile d;
    d.name = "shell/master/descript.txt";
    d.shell = true;
    d.data = DescriptLine("charset", "UTF-8") + DescriptLine("type", "shell") + DescriptLine("name", "master") +
             DescriptLine("craftman", meta["craftman"].asStr("ikaga")) +
             DescriptLine("seriko.use_self_alpha", "1") +
             DescriptLine("seriko.alignmenttodesktop", "bottom") +
             DescriptLine("sakura.balloon.offsetx", "80") + DescriptLine("sakura.balloon.offsety", "40") +
             DescriptLine("kero.balloon.offsetx", "20") + DescriptLine("kero.balloon.offsety", "30") +
             DescriptLine("sakura.defaultx", "80") + DescriptLine("kero.defaultx", "-40") +
             BindDescriptLines(project);      // 着せ替えの名前とメニュー（あれば）
    files.push_back(d);

    OutFile s;
    s.name = "shell/master/surfaces.txt";
    s.shell = true;
    s.data = "charset,UTF-8\r\n\r\ndescript\r\n{\r\nversion,1\r\n}\r\n\r\n";
    for (size_t i = 0; i < list.size(); i++) {
        char head[32];
        sprintf_s(head, "surface%d\r\n{\r\n", list[i].id);
        s.data += head;
        // 絵の上で描いた当たり判定があればそれを、無ければ自動の形（画像を使うときはその大きさで）
        std::string custom = CustomCollisionLines(project, list[i].id);
        s.data += custom.empty() ? CollisionLines(list[i].w, list[i].h) : custom;
        s.data += AnimationLines(project, list[i].id);    // SERIKO のアニメーション
        s.data += "}\r\n\r\n";
    }
    files.push_back(s);
}

} // namespace ikaga
