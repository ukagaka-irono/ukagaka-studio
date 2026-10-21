// 伺かスタジオ - ロゴの SVG から、exe のアイコン（.ico）を作る
//
//   node studio\tools\make-icon.mjs
//
// ui/img/logo.svg を、Windows に入っている Edge（画面を出さないモード）で大きさごとに描き、
// PNG を並べた .ico にして studio/res/ukagaka-studio.ico に書きます。
// ロゴを描きかえたら、これを走らせてから .\build.ps1 で exe を作りなおしてください。
// ビルドのたびに走らせるものではありません（できあがった .ico をリポジトリに入れておきます）。

import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SVG = path.join(root, 'ui', 'img', 'logo.svg');
const OUT = path.join(root, 'studio', 'res', 'ukagaka-studio.ico');
const SIZES = [16, 20, 24, 32, 40, 48, 64, 96, 128, 256];
const PORT = 9341;

const EDGE = [
  `${process.env['ProgramFiles(x86)']}\\Microsoft\\Edge\\Application\\msedge.exe`,
  `${process.env.ProgramFiles}\\Microsoft\\Edge\\Application\\msedge.exe`,
].find((p) => p && existsSync(p));
if (!EDGE) { console.error('[icon] Edge が見つかりません'); process.exit(2); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = mkdtempSync(path.join(tmpdir(), 'ikaga-icon-'));
const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--disable-extensions', 'about:blank'], { stdio: 'ignore' });

try {
  let target;
  for (let i = 0; i < 60 && !target; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      target = list.find((t) => t.type === 'page');
    } catch { /* まだ立ち上がっていない */ }
    if (!target) await sleep(250);
  }
  if (!target) throw new Error('Edge につながりませんでした');

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  const reply = new Promise((r) => ws.addEventListener('message', (e) => r(JSON.parse(e.data))));

  // 大きさごとに canvas へ描いて、PNG（base64）で返してもらう
  const svg = readFileSync(SVG, 'utf8');
  const expr = `(async () => {
    const img = new Image();
    img.src = 'data:image/svg+xml;base64,' + ${JSON.stringify(Buffer.from(svg).toString('base64'))};
    await img.decode();
    const out = {};
    for (const n of ${JSON.stringify(SIZES)}) {
      const c = document.createElement('canvas');
      c.width = c.height = n;
      const g = c.getContext('2d');
      g.imageSmoothingQuality = 'high';
      g.drawImage(img, 0, 0, n, n);
      out[n] = c.toDataURL('image/png').split(',')[1];
    }
    return out;
  })()`;
  ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: expr, awaitPromise: true, returnByValue: true } }));
  const r = await reply;
  if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.text);
  const pngs = SIZES.map((n) => Buffer.from(r.result.result.value[n], 'base64'));
  ws.close();

  // .ico = 6 バイトの頭 + 16 バイト × 枚数の目録 + PNG をそのまま並べたもの
  const head = Buffer.alloc(6);
  head.writeUInt16LE(0, 0);             // 予約
  head.writeUInt16LE(1, 2);             // 1 = アイコン
  head.writeUInt16LE(SIZES.length, 4);
  let offset = 6 + 16 * SIZES.length;
  const dir = SIZES.map((n, i) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(n >= 256 ? 0 : n, 0);  // 幅（256 は 0 と書く決まり）
    e.writeUInt8(n >= 256 ? 0 : n, 1);  // 高さ
    e.writeUInt8(0, 2);                 // 色数（使わない）
    e.writeUInt8(0, 3);                 // 予約
    e.writeUInt16LE(1, 4);              // 面
    e.writeUInt16LE(32, 6);             // 1 ドットのビット数
    e.writeUInt32LE(pngs[i].length, 8);
    e.writeUInt32LE(offset, 12);
    offset += pngs[i].length;
    return e;
  });
  writeFileSync(OUT, Buffer.concat([head, ...dir, ...pngs]));
  console.log(`[icon] ${SIZES.join(' / ')} px -> ${path.relative(root, OUT)}`);
} finally {
  edge.kill();
  await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* Edge がまだつかんでいることがある */ }
}
