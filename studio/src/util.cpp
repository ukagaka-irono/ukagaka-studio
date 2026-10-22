#include "util.h"

#include <cstdio>
#include <cmath>
#include <cstring>

namespace ikaga {

// ---------------------------------------------------------------- encoding

std::wstring MbToWide(const std::string& s, UINT cp) {
    if (s.empty()) return std::wstring();
    int n = MultiByteToWideChar(cp, 0, s.c_str(), (int)s.size(), NULL, 0);
    if (n <= 0) return std::wstring();
    std::wstring out((size_t)n, L'\0');
    MultiByteToWideChar(cp, 0, s.c_str(), (int)s.size(), &out[0], n);
    return out;
}

std::string WideToMb(const std::wstring& s, UINT cp) {
    if (s.empty()) return std::string();
    int n = WideCharToMultiByte(cp, 0, s.c_str(), (int)s.size(), NULL, 0, NULL, NULL);
    if (n <= 0) return std::string();
    std::string out((size_t)n, '\0');
    WideCharToMultiByte(cp, 0, s.c_str(), (int)s.size(), &out[0], n, NULL, NULL);
    return out;
}

bool LooksUtf8(const std::string& s) {
    const unsigned char* p = (const unsigned char*)s.c_str();
    size_t len = s.size(), i = 0;
    while (i < len) {
        unsigned char c = p[i];
        size_t extra;
        if (c < 0x80)              { i++; continue; }
        else if ((c & 0xE0) == 0xC0) { extra = 1; if (c < 0xC2) return false; }
        else if ((c & 0xF0) == 0xE0) { extra = 2; }
        else if ((c & 0xF8) == 0xF0) { extra = 3; if (c > 0xF4) return false; }
        else return false;
        if (i + extra >= len) return false;
        for (size_t k = 1; k <= extra; k++) {
            if ((p[i + k] & 0xC0) != 0x80) return false;
        }
        i += extra + 1;
    }
    return true;
}

std::string ToUtf8(const std::string& raw) {
    std::string s = raw;
    if (s.size() >= 3 && (unsigned char)s[0] == 0xEF && (unsigned char)s[1] == 0xBB &&
        (unsigned char)s[2] == 0xBF) {
        s = s.substr(3);
    }
    if (LooksUtf8(s)) return s;
    return WideToUtf8(MbToWide(s, 932)); // Shift_JIS fallback
}

// ------------------------------------------------------------------- files

bool ReadTextFile(const std::wstring& path, std::string& outUtf8) {
    HANDLE h = CreateFileW(path.c_str(), GENERIC_READ, FILE_SHARE_READ, NULL,
                           OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, NULL);
    if (h == INVALID_HANDLE_VALUE) return false;
    LARGE_INTEGER size;
    if (!GetFileSizeEx(h, &size) || size.QuadPart > (1 << 24)) { CloseHandle(h); return false; }
    std::string buf((size_t)size.QuadPart, '\0');
    DWORD read = 0;
    if (!buf.empty() && !ReadFile(h, &buf[0], (DWORD)buf.size(), &read, NULL)) {
        CloseHandle(h);
        return false;
    }
    CloseHandle(h);
    buf.resize(read);
    outUtf8 = ToUtf8(buf);
    return true;
}

bool WriteTextFile(const std::wstring& path, const std::string& utf8) {
    HANDLE h = CreateFileW(path.c_str(), GENERIC_WRITE, 0, NULL, CREATE_ALWAYS,
                           FILE_ATTRIBUTE_NORMAL, NULL);
    if (h == INVALID_HANDLE_VALUE) return false;
    DWORD written = 0;
    BOOL ok = TRUE;
    if (!utf8.empty()) ok = WriteFile(h, utf8.c_str(), (DWORD)utf8.size(), &written, NULL);
    CloseHandle(h);
    return ok != FALSE;
}

bool FileExists(const std::wstring& path) {
    DWORD a = GetFileAttributesW(path.c_str());
    return a != INVALID_FILE_ATTRIBUTES && !(a & FILE_ATTRIBUTE_DIRECTORY);
}

// ----------------------------------------------------------------- strings

std::string Trim(const std::string& s) {
    size_t b = 0, e = s.size();
    while (b < e && (unsigned char)s[b] <= ' ') b++;
    while (e > b && (unsigned char)s[e - 1] <= ' ') e--;
    return s.substr(b, e - b);
}

bool IEquals(const std::string& a, const std::string& b) {
    if (a.size() != b.size()) return false;
    for (size_t i = 0; i < a.size(); i++) {
        char ca = a[i], cb = b[i];
        if (ca >= 'A' && ca <= 'Z') ca = (char)(ca - 'A' + 'a');
        if (cb >= 'A' && cb <= 'Z') cb = (char)(cb - 'A' + 'a');
        if (ca != cb) return false;
    }
    return true;
}

bool StartsWith(const std::string& s, const std::string& prefix) {
    return s.size() >= prefix.size() && s.compare(0, prefix.size(), prefix) == 0;
}

std::string NumToStr(double v) {
    if (!(v == v)) return "0";                       // NaN
    if (v == 0) return "0";                          // -0 も「0」と書く
    // 整数なら小数点を出さない（%.0f で書くと、long long を通さずに同じ字が出ます）。
    if (v == std::floor(v) && std::fabs(v) < 1e15) {
        char buf[32];
        sprintf_s(buf, "%.0f", v);
        return buf;
    }
    char buf[64];
    sprintf_s(buf, "%.10g", v);
    // 指数は 3 けたにそろえる（1e+023）。64bit の新しい C ランタイムは 2 けた（1e+23）で書きますが、
    // もとの栞（32bit・msvcrt.dll）が 3 けたで書いていたので、保存した値の見た目をそろえておきます。
    std::string s = buf;
    size_t e = s.find('e');
    if (e != std::string::npos && e + 2 < s.size()) {
        size_t digits = s.size() - (e + 2);         // e と符号のあとの数字の数
        if (digits < 3) s.insert(e + 2, 3 - digits, '0');
    }
    return s;
}

double StrToNum(const std::string& s) {
    std::string t = Trim(s);
    if (t.empty()) return 0.0;
    char* end = NULL;
    double v = strtod(t.c_str(), &end);
    if (end == t.c_str()) return 0.0;
    return v;
}

} // namespace ikaga
