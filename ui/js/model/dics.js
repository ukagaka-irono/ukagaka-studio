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
  if (/[\\/:*?"<>|\x00-\x1f]/.test(s)) return false;
  return !STUDIO_FILES.includes(s.toLowerCase());
}

/**
 * いまある YAYA ゴーストの辞書（master からの相対パス）を、プロジェクトの辞書の名前にする（段階 8-6）。
 * フォルダの区切りは _ に、使えない文字も _ にし、スタジオのファイルの名前なら imported_ を前に付けます。
 * taken（もうある名前）と、大文字小文字だけちがう名前にもならないよう、_2・_3 … を付けます
 */
export function importDicName(rel, taken) {
  let base = String(rel || '').replace(/^[\/]+/, '').replace(/[\/]/g, '_').replace(/[:*?"<>|\x00-\x1f]/g, '_');
  if (!/\.dic$/i.test(base)) base += '.dic';
  if (base[0] === '.' || base[0] === ' ') base = '_' + base;
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

/** スタジオのしくみと yaya_base がもう使っている名前か（同じ名前の関数を書くと、YAYA が辞書をまるごと読まない） */
export function reservedFunction(name) {
  return name.startsWith('Studio.') || name === 'OnGhostLoad.Studio' || name === 'OnGhostUnload.Studio'
    || YAYA_BASE_FUNCTIONS.includes(name);
}

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
