// 伺かスタジオ - 書き出しの部品（exporter.cpp と export_*.cpp の中だけで使う）
#pragma once

#include "exporter.h"
#include "json.h"

#include <string>
#include <vector>

namespace ikaga {

// descript.txt / install.txt の 1 行（"key,value\r\n"）。値の改行は空白にする。
std::string DescriptLine(const char* key, const std::string& value);

// shell/master/ の絵・descript.txt・surfaces.txt を足す（export_shell.cpp）
void AppendShell(std::vector<OutFile>& files, const JValue& project);

// その surface の SERIKO のうごき（animationN.*）の行（export_seriko.cpp）
std::string AnimationLines(const JValue& project, int surfaceId);

// balloon/ の絵と descript.txt を足す（export_balloon.cpp）
void AppendBalloon(std::vector<OutFile>& files, const JValue& project);

} // namespace ikaga
