/* 伺かスタジオ - 下の層から、上の層の操作を呼ぶための受け口
 *
 * import は「下の層へ」だけ向けます（docs/maintenance.md の「画面のファイルの決まりごと」）。
 * それでも、ブロックの描画（editor/）やステージ（panels/shell.js）から
 * 「このかたまりを実行する」のような、上の層の操作を呼びたいときがあります。
 *
 * そういうものだけを、ここに名前で並べておきます。中身は、持ち主が起動時に
 * provide() で入れます。ここに無いものを下から呼ぶことはできません。
 */

function notYet(name) {
  return function () { throw new Error(`Commands.${name} がまだ用意されていません`); };   // i18n-ignore（作る人むけ）
}

export const Commands = {
  /** かたまりを「ためす」で動かす（panels/run.js） */
  runScript: notYet('runScript'),
  /** 名前を聞いて変数を作る。作った名前か null を返す（panels/vars.js） */
  promptNewVariable: notYet('promptNewVariable'),
};

/** 持ち主が中身を入れる。知らない名前は入れさせない（書きまちがいで黙って増えないように） */
export function provide(impl) {
  for (const name of Object.keys(impl)) {
    if (!(name in Commands)) throw new Error(`Commands に ${name} はありません`);   // i18n-ignore（作る人むけ）
    Commands[name] = impl[name];
  }
}
