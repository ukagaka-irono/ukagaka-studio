// 伺かスタジオ - いまあるシェルのフォルダを読みこむ（段階 3-5d）
//
// シェルのフォルダ（または、それをふくむゴーストのフォルダ）から、番号ごとの立ち絵
// （surface0.png・surface0010.png など）を集めます。プロジェクトの shell.images に並べる材料です。
// 絵の組み合わせ（element）だけで作っている番号は、1 枚の絵が無いので読みこめず、compositeOnly に並べます。
//
// surfaces.txt からは、うごき（SERIKO/2.0 の新しい書式の animationN.*）と、四角い当たり判定（collisionN）も読みます。
// シェルの descript.txt に着せ替えの名前（sakura.bindgroupN.name）があれば、そのうごきに付けます。
// 四角でない当たり判定（collisionexN）と、古い書式（SERIKO/1 の 0interval など）は読まずに skipped に数えます。
#pragma once

#include "json.h"

#include <string>
#include <vector>

namespace ikaga {

struct ShellImageFile {
    int id = 0;
    std::wstring path;
    std::string name;
    int width = 0, height = 0;
};

struct ShellImport {
    bool ok = false;
    std::string error;                 // not_shell_folder
    std::wstring folder;               // 読んだシェルのフォルダ
    std::vector<ShellImageFile> images;   // 番号の小さい順
    std::vector<int> compositeOnly;    // surfaces.txt にあるが、1 枚の絵が無い番号
    std::vector<std::string> unreadable;  // PNG として読めなかったファイル
    JValue areas = JValue::makeObj();      // { "立ち絵の番号": [{ name, x1, y1, x2, y2 }] }（プロジェクトの shell.areas の形）
    JValue animations = JValue::makeArr(); // プロジェクトの animations の形
    int skipped = 0;                       // 読まなかった行（四角でない当たり判定・古い書式）
};

// path はシェルのフォルダか、shell/master をふくむゴーストのフォルダ
ShellImport ImportShellFolder(const std::wstring& path);

} // namespace ikaga
