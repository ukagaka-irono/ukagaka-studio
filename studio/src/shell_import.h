// 伺かスタジオ - いまあるシェルのフォルダを読みこむ（段階 3-5d）
//
// シェルのフォルダ（または、それをふくむゴーストのフォルダ）から、番号ごとの立ち絵
// （surface0.png・surface0010.png など）を集めます。プロジェクトの shell.images に並べる材料です。
// surfaces.txt は、番号を知るためだけに読みます。絵の組み合わせ（element）だけで作っている番号は、
// 1 枚の絵が無いので読みこめず、compositeOnly に並べます。うごき（SERIKO）と当たり判定は読みません。
#pragma once

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
};

// path はシェルのフォルダか、shell/master をふくむゴーストのフォルダ
ShellImport ImportShellFolder(const std::wstring& path);

} // namespace ikaga
