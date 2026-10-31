/* 伺かスタジオ - プロジェクトの中の YAYA の辞書（段階 8-2）
 *
 * project.dics = [{ name: 'talk.dic', text: '…' }]。書き出すと ghost/master/<name> に入り、yaya.txt に「dic, <name>」が足されます
 * （studio/src/exporter.cpp。名前の決まりは exe の DicNameOk と同じ）。
 * 辞書にある関数は「手書き」と同じにあつかい、同じ名前のイベントの入り口はブロックからは書きません（model/yaya.js の toYaya）。
 * YAYA は、同じ名前の関数が 2 つあると辞書をまるごと読まないので、チェックタブでかぶりを知らせます。
 * DOM を触らないので、node のテスト（ui\test\editor.js）からそのまま使えます。
 */

import { parseYaya, highlightYaya } from './yayatext.js';
import { YAYA_SYSTEM_FUNCTIONS } from './yblocks.js';
import { t } from '../i18n/i18n.js';

// スタジオが書くファイル（辞書の名前には使えない）
const STUDIO_FILES = ['studio_runtime.dic', 'studio_program.dic', 'studio_preview.dic'];

/** 辞書の名前に使えるか（フォルダの区切りや、Windows で使えない文字が無く、.dic で終わる。スタジオのファイルではない） */
export function dicNameOk(name) {
  const s = String(name || '');
  if (!s || s.length > 64 || s[0] === '.' || s[0] === ' ') return false;
  if (!/\.dic$/i.test(s)) return false;
  // ~ は 8.3 の短い名前（STUDIO~1.DIC がスタジオのファイルになる）、, は yaya.txt の区切りになる
  if (/[\\/:*?"<>|~,\x00-\x1f]/.test(s)) return false;
  if (deviceName(s)) return false;
  return !STUDIO_FILES.includes(s.toLowerCase());
}

/** NUL.dic・COM1.dic のような、Windows が機械の名前として取っておいている名前か（書いても消えてしまう。studio/src/exporter.cpp と同じ） */
function deviceName(s) {
  const stem = s.split('.')[0].replace(/ +$/, '').toUpperCase();
  return /^(CON|PRN|AUX|NUL|CONIN\$|CONOUT\$|(COM|LPT)[0-9¹²³])$/.test(stem);
}

/**
 * いまある YAYA ゴーストの辞書（master からの相対パス）を、プロジェクトの辞書の名前にする（段階 8-6）。
 * フォルダの区切りは _ に、使えない文字も _ にし、スタジオのファイルの名前なら imported_ を前に付けます。
 * taken（もうある名前）と、大文字小文字だけちがう名前にもならないよう、_2・_3 … を付けます
 */
export function importDicName(rel, taken) {
  let base = String(rel || '').replace(/^[\/]+/, '').replace(/[\/]/g, '_').replace(/[:*?"<>|~,\x00-\x1f]/g, '_');
  if (!/\.dic$/i.test(base)) base += '.dic';
  if (base[0] === '.' || base[0] === ' ' || deviceName(base)) base = '_' + base;
  if (STUDIO_FILES.includes(base.toLowerCase())) base = 'imported_' + base;
  const stem = base.slice(0, -4);
  const used = new Set([...(taken || [])].map((n) => String(n).toLowerCase()));
  // _2 などを付けても 64 字に収まるよう、名前の前のほうを残して切る
  const make = (suffix) => stem.slice(0, 64 - 4 - suffix.length) + suffix + '.dic';
  let name = make('');
  for (let i = 2; used.has(name.toLowerCase()); i++) name = make('_' + i);
  return name;
}

/** 読みこんだプロジェクトの dics を、決まった形にする（名前と文字のどちらかが無いものは落とす） */
export function normalizeDics(list) {
  return (Array.isArray(list) ? list : [])
    .filter((d) => d && typeof d === 'object' && typeof d.name === 'string')
    .map((d) => ({ name: d.name, text: typeof d.text === 'string' ? d.text.replace(/\r\n?/g, '\n') : '' }));
}

/** 辞書ごとに読んだ結果（{ dic, name, parsed: { dic, errors } }）。テキストが同じあいだは、読みなおさない */
const cache = new Map();
export function parseDic(d) {
  const hit = cache.get(d.text);
  if (hit) return hit;
  const parsed = parseYaya(d.text);
  if (cache.size > 64) cache.clear();
  cache.set(d.text, parsed);
  return parsed;
}

/** プロジェクトの辞書にある関数（{ name, dic }。同じ名前が何度あっても、みな返す） */
export function dicFunctions(project) {
  const out = [];
  for (const d of (project && project.dics) || []) {
    for (const item of parseDic(d).dic.items) if (item.type === 'func') out.push({ name: item.name, dic: d.name });
  }
  return out;
}

/** 書き出すときに「手書き」としてあつかう名前（同じ名前のイベントの入り口を、ブロックからは書かない） */
export function dicFunctionNames(project) {
  return [...new Set(dicFunctions(project).map((f) => f.name))];
}

// yaya_base（third_party/yaya-dic/yaya_base）にある関数。ui\test\yayatext.js が、本物の yaya_base と同じかを見ます
export const YAYA_BASE_FUNCTIONS = [
  'ASC', 'AVERAGE', 'AyaLoad.FuncEnumExec', 'AyaTest.Eval', 'AyaTest.EvalAcceptsStatements', 'AyaTest.EvalLines', 'ChainTalk',
  'DUMP', 'EXECUTE_SSTP', 'FUNCTIONEX', 'FUNCTIONLOAD', 'GET_PROPERTY', 'IASC', 'ISINSIDE', 'ISINTEGER', 'ISREAL', 'JOIN',
  'LIB.HEADER', 'LIB.KEY', 'LIB.VALUE', 'MAX', 'MIN', 'OnRequest', 'OnSystemLoad.SHIORI3FW.OPTIONAL',
  'OnSystemUnload.SHIORI3FW.OPTIONAL', 'On_installedghostname', 'On_installedkeroname', 'On_installedsakuraname', 'REQ.HEADER',
  'REQ.KEY', 'REQ.VALUE', 'REVERSE', 'SAORI', 'SET_PROPERTY', 'SHIORI3EV.ExternalEvent.On_Get_Supported_Events',
  'SHIORI3EV.ExternalEvent.On_Has_Event', 'SHIORI3EV.OnAITalkNewEvent', 'SHIORI3EV.OnBalloonChange', 'SHIORI3EV.OnInitialize',
  'SHIORI3EV.OnNotifySelfInfo', 'SHIORI3EV.OnNotifyUserInfo', 'SHIORI3EV.OnShellChanged', 'SHIORI3EV.OnSurfaceChange',
  'SHIORI3EV.OnUpdateComplete', 'SHIORI3EV.On_Get_Supported_Events', 'SHIORI3EV.On_Has_Event', 'SHIORI3EV.On_ShioriEcho',
  'SHIORI3EV.On_capability', 'SHIORI3EV.On_craftman', 'SHIORI3EV.On_craftmanw', 'SHIORI3EV.On_enable_debug',
  'SHIORI3EV.On_enable_log', 'SHIORI3EV.On_getaistate', 'SHIORI3EV.On_hwnd', 'SHIORI3EV.On_log_path', 'SHIORI3EV.On_name',
  'SHIORI3EV.On_tamaExit', 'SHIORI3EV.On_tamaOpen', 'SHIORI3EV.On_uniqueid', 'SHIORI3EV.On_version', 'SHIORI3FW.AIGraphJoin',
  'SHIORI3FW.AIGraphMax', 'SHIORI3FW.AssembleReferenceHeader', 'SHIORI3FW.CanTalk', 'SHIORI3FW.ChainTime',
  'SHIORI3FW.ClearAdditionalReturnVariable', 'SHIORI3FW.ClearChainVariable', 'SHIORI3FW.ClearReferenceAndPassThruInsVariable',
  'SHIORI3FW.ClearValueexVariable', 'SHIORI3FW.ControlAITalk', 'SHIORI3FW.Dl2ToDll', 'SHIORI3FW.EndChainTalk',
  'SHIORI3FW.EscapeAllTags', 'SHIORI3FW.EscapeDangerousTags', 'SHIORI3FW.ExecuteDl2ToDll', 'SHIORI3FW.ExecuteInternalSaori',
  'SHIORI3FW.GetAdditionalReturns', 'SHIORI3FW.GetCharsetFromDescriptTxt', 'SHIORI3FW.GetDelayEvent',
  'SHIORI3FW.GetGhostNameFromDescriptTxt', 'SHIORI3FW.GetLastErrorLog', 'SHIORI3FW.GetTickInfo', 'SHIORI3FW.HTTPCodeToMessage',
  'SHIORI3FW.InitAdditionalReturn', 'SHIORI3FW.InitBalloons', 'SHIORI3FW.InitChain', 'SHIORI3FW.InternalSaoriAvailable',
  'SHIORI3FW.InternalSaoriModule', 'SHIORI3FW.IsChain', 'SHIORI3FW.IsGhostExist', 'SHIORI3FW.IsImportantEvent',
  'SHIORI3FW.IsInternalSaori', 'SHIORI3FW.Lint.CheckLocal', 'SHIORI3FW.Lint.Distance', 'SHIORI3FW.Lint.EscapeRegex',
  'SHIORI3FW.Lint.Finding', 'SHIORI3FW.Lint.Format', 'SHIORI3FW.Lint.GetLines', 'SHIORI3FW.Lint.IsConditionContext',
  'SHIORI3FW.Lint.IsInString', 'SHIORI3FW.Lint.IsUnder', 'SHIORI3FW.Lint.MatchAny', 'SHIORI3FW.Lint.NormalizePath',
  'SHIORI3FW.Lint.ParentDir', 'SHIORI3FW.Lint.ReadTexts', 'SHIORI3FW.Lint.RelativePath', 'SHIORI3FW.Lint.Run',
  'SHIORI3FW.Lint.Suggest', 'SHIORI3FW.Lint.WordPattern', 'SHIORI3FW.MakeEmptyResponse', 'SHIORI3FW.MakeJustText',
  'SHIORI3FW.MakeLongText', 'SHIORI3FW.MakeReferenceAndPassThruInsVariable', 'SHIORI3FW.MakeShortText',
  'SHIORI3FW.MakeValueexVariable', 'SHIORI3FW.ParseLibResponse', 'SHIORI3FW.PushAdditionalReturn', 'SHIORI3FW.PushErrorAlart',
  'SHIORI3FW.Push_X_SSTP_PassThru', 'SHIORI3FW.RaiseIDEvent', 'SHIORI3FW.RefreshFMOTable', 'SHIORI3FW.RegisterTempVar',
  'SHIORI3FW.RemoveAllTags', 'SHIORI3FW.RequestLib', 'SHIORI3FW.ResetAITalkInterval', 'SHIORI3FW.SaoriUnloadAll',
  'SHIORI3FW.SendGETVersion', 'SHIORI3FW.SetDelayEvent', 'SHIORI3FW.StartChainTalk', 'SHIORI3FW.StartChainTalkScriptDirect',
  'SHIORI3FW.StructInstalledGhostList', 'SHIORI3FW.TranslateEvent', 'SHIORI3FW.TranslateSystemChar', 'SPLITEX', 'UNIQUE', 'ampm',
  'day', 'ghostupmin', 'ghostupmin_total', 'hour', 'hour12', 'hour12ex', 'load', 'memoryavailphys', 'memoryavailvirtual',
  'memoryload', 'memorytotalphys', 'memorytotalvirtual', 'minute', 'month', 'request', 'restore_old_variables', 'second',
  'systemuphour', 'systemupminute', 'systemupsecond', 'systemuptickcount', 'systemuptime', 'unload', 'weekday', 'year',
];

// yaya_base が使う大域変数（関数と同じ名前は使えない）。reference0・valueex0 のような番号つきのものは、名前の形で見ます。
// shiori\test\yaya\ が、本物の yaya_base で値を入れている名前と同じかを見ます
export const YAYA_BASE_VARIABLES = [
  'CHAIN.IDName', 'CHAIN.Index', 'CHAIN.Script', 'CHAIN.StartTime', 'C_BYTE1', 'C_CRLF', 'C_CRLF2', 'LIB.PROTOCOL',
  'LIB.STATUSCODE', 'REQ.COMMAND', 'REQ.PROTOCOL', 'SAORI.DllList', 'SAORI.InternalList', 'SAORI.InternalOk',
  'SHIORI3FW.AdditionalReturn.String', 'SHIORI3FW.BalloonHWnd', 'SHIORI3FW.BalloonName', 'SHIORI3FW.BalloonNameOld',
  'SHIORI3FW.BalloonPath', 'SHIORI3FW.BasewareNotifysInstalledKeroName', 'SHIORI3FW.BasewareNotifysInstalledSakuraName',
  'SHIORI3FW.CanTalkFlag', 'SHIORI3FW.Capability', 'SHIORI3FW.DebugMode', 'SHIORI3FW.DelayEvent',
  'SHIORI3FW.DelayEventReference', 'SHIORI3FW.DelayEventTime', 'SHIORI3FW.ErrorDescription', 'SHIORI3FW.ErrorLevel',
  'SHIORI3FW.Eventid', 'SHIORI3FW.EventidOld', 'SHIORI3FW.EventidTranslate', 'SHIORI3FW.EventidTranslateOld',
  'SHIORI3FW.FMOCache', 'SHIORI3FW.FMOTable', 'SHIORI3FW.GhostName', 'SHIORI3FW.HWnd', 'SHIORI3FW.HWndOld',
  'SHIORI3FW.IsAITalkComplete', 'SHIORI3FW.IsSurfaceRestoreComplete', 'SHIORI3FW.IsVisible', 'SHIORI3FW.LastAITalk',
  'SHIORI3FW.LastAITalkTime', 'SHIORI3FW.LastErrorDescription', 'SHIORI3FW.LastSurface', 'SHIORI3FW.LastTalk',
  'SHIORI3FW.LastTalkTime', 'SHIORI3FW.PassThru_Ins_List', 'SHIORI3FW.Path', 'SHIORI3FW.ReferenceList',
  'SHIORI3FW.SakuraNameList', 'SHIORI3FW.SaveVarCount', 'SHIORI3FW.SecurityLevel', 'SHIORI3FW.ShellName',
  'SHIORI3FW.ShellNameOld', 'SHIORI3FW.ShellPath', 'SHIORI3FW.Status', 'SHIORI3FW.TalkEndTime', 'SHIORI3FW.TamaHwnd',
  'SHIORI3FW.UniqueID', 'SHIORI3FW.UserBirthday', 'SHIORI3FW.UserName', 'SHIORI3FW.UserNameFull', 'SHIORI3FW.UserSex',
  'SHIORI3FW.tempvarname', 'SSTP.STATUS', 'SSTP.STATUSCODE', 'S_CHARSET', 'StructGhostList.Index', 'aitalkinterval',
  'array_eventtranslate', 'array_translateinternal', 'ascii', 'basewarename', 'basewarenameex', 'communicateratio',
  'ghostbootmin', 'ghostupmin_last', 'ghostuptimes', 'installedghostlist', 'installedkerolist', 'installedsakuralist',
  'keroname', 'reference', 'reference.raw', 'reference0', 'sakuraname', 'selfname', 'sender', 'status', 'valueex',
  'var.lib.key', 'var.lib.result', 'var.lib.value', 'var.req.key', 'var.req.rawvalue', 'var.req.value',
];

/** スタジオのしくみと yaya_base がもう使っている名前か（同じ名前の関数を書くと、YAYA が辞書をまるごと読まない） */
export function reservedFunction(name) {
  return name.startsWith('Studio.') || name === 'OnGhostLoad.Studio' || name === 'OnGhostUnload.Studio'
    || YAYA_BASE_FUNCTIONS.includes(name) || YAYA_BASE_VARIABLES.includes(name)
    || /^(reference|valueex)\d+$/.test(name);
}

/** YAYA にもとからある関数の名前か（同じ名前の関数を書いても、そちらがよばれる） */
export const yayaSystemFunction = (name) => SYSTEM_FUNCTIONS.has(name);

/**
 * チェックタブに出す、辞書の注意（model/lint.js がよびます）。
 *   issue(level, message, hint, where)・where は { dic, line }（チェックタブから辞書の画面のその行へ動くため）・blockEvents … ブロックのイベント名（止めていないもの）・linked … 手書きのゴーストにつないでいるか
 */
export function dicIssues(project, issue, { blockEvents = [], linked = false } = {}) {
  const dics = (project && project.dics) || [];
  if (!dics.length) return;
  if (linked) {
    issue('warn', t('手書きのゴーストにつないでいるあいだは、プロジェクトの辞書を書き出しません'),
      t('つないだゴーストには、スタジオのファイルだけを書きこみます。辞書の関数は、つないだゴーストの手書きの辞書に書いてください。'));
  }
  const names = new Set();
  const where = new Map();
  for (const d of dics) {
    if (!dicNameOk(d.name)) {
      issue('error', t('辞書の名前「{name}」は使えません', { name: d.name }),
        t('「.dic」で終わる名前にしてください（フォルダの区切りや \\ / : * ? " < > | は使えません。studio_runtime.dic など、スタジオのファイルの名前も使えません）。'), { dic: d.name });
    } else if (names.has(d.name.toLowerCase())) {
      issue('error', t('辞書「{name}」が 2 つあります', { name: d.name }), t('どちらかの名前を変えてください。'), { dic: d.name });
    }
    names.add(String(d.name).toLowerCase());
    const parsed = parseDic(d);
    for (const e of parsed.errors) {
      issue('error', t('辞書「{name}」の {line} 行目が、YAYA として読めません', { name: d.name, line: e.line }),
        t('ひとつでも読めないところがあると、YAYA は辞書をまるごと読みません。辞書の画面で直してください。'), { dic: d.name, line: e.line });
    }
    for (const item of parsed.dic.items) {
      if (item.type !== 'func') continue;
      if (reservedFunction(item.name)) {
        issue('error', t('辞書「{dic}」の関数「{name}」は、スタジオのしくみか yaya_base がもう使っている名前です', { dic: d.name, name: item.name }),
          t('同じ名前の関数が 2 つあると、YAYA は辞書をまるごと読みません。名前を変えてください。'), { dic: d.name });
      } else if (where.has(item.name)) {
        issue('error', t('関数「{name}」が、辞書「{a}」と「{b}」の両方にあります', { name: item.name, a: where.get(item.name), b: d.name }),
          t('同じ名前の関数が 2 つあると、YAYA は辞書をまるごと読みません。どちらかを消すか、名前を変えてください。'), { dic: d.name });
      } else {
        where.set(item.name, d.name);
      }
    }
  }
  // ブロックにも同じイベントがあると、辞書のほうが動く（両方は書けない）
  for (const ev of new Set(blockEvents)) {
    if (!where.has(ev)) continue;
    issue('warn', t('{event} は、プロジェクトの辞書「{dic}」にもあります', { event: ev, dic: where.get(ev) }),
      t("辞書のほうが動くので、ブロックの {event} は、辞書の {event} の中で Studio.Event('{event}') をよんだときだけ動きます。", { event: ev }),
      { dic: where.get(ev) });
  }
  // どこにも無い関数をよんでいる（段階 9-1）。YAYA は無い関数をよんでも何も出さずに先へ進むので、書きまちがいに気づきにくい。
  // つないだ手書きのゴーストの関数は、ここではわからないので、つないでいるあいだは見ません
  if (linked) return;
  const events = new Set(blockEvents);
  const known = (name) => where.has(name) || reservedFunction(name) || SYSTEM_FUNCTIONS.has(name) || events.has(name);
  for (const d of dics) {
    if (parseDic(d).errors.length) continue;   // 読めない辞書は、先にそちらを直してもらう
    const seen = new Set();
    // 色分け（highlightYaya）で「( が続く名前」になったものが、関数をよんでいるところ（コメントと文字列の中はのぞかれます）
    highlightYaya(d.text).forEach((spans, k) => {
      for (const [cls, s] of spans) {
        const name = s.trim();
        if (cls !== 'call' || seen.has(name) || known(name)) continue;
        seen.add(name);
        issue('warn', t('辞書「{dic}」の {line} 行目でよんでいる「{name}」は、どこにも無い関数です', { dic: d.name, line: k + 1, name }),
          t('YAYA は、無い関数をよぶと何もせずに先へ進みます。名前の書きまちがいか、まだ作っていない関数かもしれません。'),
          { dic: d.name, line: k + 1 });
      }
    });
  }
}

const SYSTEM_FUNCTIONS = new Set(Object.values(YAYA_SYSTEM_FUNCTIONS).flat());

/**
 * YAYA に元からある関数のうち、このパソコンでプログラムを動かす・DLL を読む・ファイルを書きかえる・辞書を足す・
 * 文字を YAYA のコードとして動かすもの。人からもらったプロジェクトに入っていたら、「ためす」の前に確かめてもらいます
 * （「ためす」も、書き出したゴーストと同じ yaya.dll で本当に動かすため）
 */
export const RISKY_FUNCTIONS = new Set([
  'EXECUTE', 'EXECUTE_WAIT', 'LOADLIB', 'UNLOADLIB', 'REQUESTLIB', 'FUNCTIONEX', 'DICLOAD', 'DICUNLOAD', 'APPEND_RUNTIME_DIC',
  'FOPEN', 'FWRITE', 'FWRITE2', 'FWRITEBIN', 'FWRITEDECODE', 'FWRITEJSON', 'FWRITETOML', 'FWRITEXML', 'FWRITEYAML',
  'FDEL', 'FMOVE', 'FCOPY', 'FRENAME', 'MKDIR', 'RMDIR', 'EVAL', 'SETSETTING', 'FUNCDECL_WRITE', 'FUNCDECL_ERASE',
  'DIRECTSSTP', 'LETTONAME', 'SAVEVAR', 'RESTOREVAR', 'SQLOPEN', 'SQLEXEC', 'LOGGING', 'SETGLOBALDEFINE', 'UNDEFFUNC',
  // yaya_base と、しくみ（studio_runtime.dic）の関数で、上のものを渡された文字のままよぶもの
  // （ui/test/editor.js が、どちらの辞書にも漏れがないかを確かめます）
  'CALLBYNAME', 'NAMETOVALUE', 'FUNCTIONLOAD', 'SAORI', 'AyaTest.Eval', 'AyaTest.EvalLines', 'AyaLoad.FuncEnumExec',
  'EXECUTE_SSTP', 'SET_PROPERTY', 'SHIORI3FW.ExecuteInternalSaori', 'SHIORI3FW.ExecuteDl2ToDll', 'SHIORI3FW.RequestLib',
  'SHIORI3FW.RaiseIDEvent', 'SHIORI3EV.On_ShioriEcho', 'Studio.YayaExpr', 'Studio.YayaCall',
  // 「ためす」で SAORI を止めている印（書きかえると、SAORI の DLL を読めてしまう）
  'Studio.noSaori',
]);

const isNameChar = (c) => c !== undefined && !/[\s!"#$%&()*+,\-/:;<=>?@[\]`{|}~']/.test(c);

/** 行の終わりの / でつないだ行を 1 行にする（[{ text, line }]。line は始まりの行） */
function joinLines(lines) {
  const out = [];
  for (let k = 0; k < lines.length; k++) {
    let text = lines[k];
    const line = k + 1;
    while (/\/[ \t]*$/.test(text) && k + 1 < lines.length) text = text.replace(/\/[ \t]*$/, '') + lines[++k].replace(/^[ \t]+/, '');
    out.push({ text, line });
  }
  return out;
}

/** 辞書の #define・#globaldefine（[[前, 後], …]） */
export function dicDefines(texts) {
  const out = [];
  for (const text of texts) {
    for (const line of String(text || '').split(/\r\n?|\n/)) {
      const m = /^\s*#(?:global)?define\s+(\S+)\s+(.*?)\s*$/.exec(line);
      if (m) out.push([m[1], m[2]]);
    }
  }
  return out;
}

/**
 * YAYA の文（辞書のテキストや YAYA の式）で RISKY_FUNCTIONS の名前が出てくるところ（[{ name, line }]。名前ごとに最初の 1 か所）。
 * 人からもらったものを見るので、色分けとはちがって、かたく見ます。
 * 文字列（%(…) で動く）とコメント（YAYA と読みかたがずれると、そこに隠せる）の中も、
 * ( が続かない名前（#define で書きかえる・/ で次の行につなぐ）も、
 * / でつないだ行と、defines（dicDefines）で書きかえたあとの文も見ます
 */
export function riskyCalls(text, defines = []) {
  const out = [];
  const seen = new Set();
  const scan = (s, line) => {
    for (let i = 0; i < s.length;) {
      if (!isNameChar(s[i])) { i++; continue; }
      let j = i;
      while (j < s.length && isNameChar(s[j])) j++;
      // 名前の終わりの . は名前に入れない（Studio.noSaori. のような書きかたもあるので、. で切ったものも見る）
      const word = s.slice(i, j);
      for (const name of [word, word.replace(/\.+$/, '')]) {
        if (seen.has(name) || !RISKY_FUNCTIONS.has(name)) continue;
        seen.add(name);
        out.push({ name, line });
      }
      i = j;
    }
  };
  const expand = (s) => {
    for (const [from, to] of defines) if (from) s = s.split(from).join(to);
    return s;
  };
  const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
  lines.forEach((s, k) => scan(s, k + 1));
  for (const { text: s, line } of joinLines(lines)) { scan(s, line); scan(expand(s), line); }
  out.sort((a, b) => a.line - b.line);
  return out;
}
