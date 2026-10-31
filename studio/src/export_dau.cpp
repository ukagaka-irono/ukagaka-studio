// 伺かスタジオ - 書き出し: ネットワーク更新の照合表（updates2.dau）
#include "exporter.h"
#include "fsutil.h"
#include "util.h"

namespace ikaga {

// updates2.dau は「どのファイルが、どんな中身か」の一覧です。使う人の SSP は
// これを見て、変わったファイルだけ落としてきます。1 行が 1 ファイルで、
//
//     ghost\master\ghost.json <0x01> md5 <0x01> <CRLF>
//
// という形です（区切りは 0x01、MD5 は小文字 16 進）。
// この形は公式には書かれていないので、公開されている読み取り側の実装
// （ninix-kagari の lib/ninix/update.rb）に合わせています。
// うまくいかないときは、フォルダを SSP に投げれば SSP が作り直してくれます。
static bool SkipInDau(const std::wstring& rel) {
    std::wstring low = rel;
    for (size_t i = 0; i < low.size(); i++) {
        if (low[i] >= L'A' && low[i] <= L'Z') low[i] = (wchar_t)(low[i] - L'A' + L'a');
    }
    // 使う人ごとの持ちもの・こちらの作業用ファイルは配らない
    if (low.find(L"ikaga_save.json") != std::wstring::npos) return true;
    if (low.find(L"ikaga_debug.txt") != std::wstring::npos) return true;
    if (low.find(L"yaya_variable.cfg") != std::wstring::npos) return true;   // YAYA が覚えている変数
    if (low.find(L"studio_debug.txt") != std::wstring::npos) return true;    // しくみの辞書の記録
    if (low.find(L"yaya.log") != std::wstring::npos) return true;
    if (low == L"updates2.dau" || low == L"updates.txt") return true;
    if (low == L"delete.txt") return true;              // サーバ側だけの指示書
    if (low == L"thumbs.db" || low == L"desktop.ini") return true;
    if (low.compare(0, 5, L".git\\") == 0 || low == L".git") return true;
    // SSP が使う人ごとに書く profile フォルダ（ghost\master\profile・shell\master\profile など）
    if (low.compare(0, 8, L"profile\\") == 0 || low.find(L"\\profile\\") != std::wstring::npos) return true;
    return false;
}

std::string BuildUpdatesDau(const std::wstring& root) {
    std::vector<std::wstring> rels = ListFilesDeep(root);
    std::string out;
    for (size_t i = 0; i < rels.size(); i++) {
        if (SkipInDau(rels[i])) continue;
        std::string data;
        if (!ReadBinaryFile(PathJoin(root, rels[i]), data)) continue;
        std::string md5 = Md5Hex(data);
        if (md5.empty()) continue;
        out += WideToUtf8(rels[i]);
        out += '\x01';
        out += md5;
        out += '\x01';
        out += "\r\n";
    }
    return out;
}

} // namespace ikaga
