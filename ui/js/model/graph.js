/* 伺かスタジオ - 選択肢のつながり（段階 7-7。キャンバスの「つながり」で図にします。panels/graph.js）
 *
 * かたまりの中の「選択肢」（choice の target）と、「◯をよぶ」（call）・「◯秒後によぶ」（later）から、
 * どのかたまりがどのトークへつながるかを集めます。止めたかたまりは入れません。
 * 行き先のトークが無いときは、missing の点（赤い箱）にします。
 * 点には、左から何列目か（depth）と、その列の何番目か（row）を付けます。DOM を触らないので、node のテストから使えます。
 */

function walkBlocks(v, visit) {
  if (Array.isArray(v)) { v.forEach((x) => walkBlocks(x, visit)); return; }
  if (!v || typeof v !== 'object') return;
  if (typeof v.type === 'string') visit(v);
  for (const k of Object.keys(v)) if (v[k] && typeof v[k] === 'object') walkBlocks(v[k], visit);
}

/**
 * { nodes: [{ id, script | null, missing, name, depth, row }], edges: [{ from, to, kind: 'choice' | 'call', label }] }
 * edges の from・to は nodes の id（かたまりの id か「missing:名前」）
 */
export function choiceGraph(project) {
  const scripts = ((project && project.scripts) || [])
    .filter((s) => !s.disabled && (s.kind === 'event' || s.kind === 'talk' || s.kind === 'function'));
  const byName = new Map();
  for (const s of scripts) if ((s.kind === 'talk' || s.kind === 'function') && s.name && !byName.has(s.name)) byName.set(s.name, s);

  const edges = [];
  const missing = new Map();
  const target = (name) => {
    const s = byName.get(name);
    if (s) return s.id;
    if (!missing.has(name)) missing.set(name, 'missing:' + name);
    return missing.get(name);
  };
  for (const s of scripts) {
    walkBlocks(s.blocks, (b) => {
      if (b.type === 'choice' && typeof b.target === 'string' && b.target.trim()) {
        edges.push({ from: s.id, to: target(b.target.trim()), kind: 'choice', label: typeof b.label === 'string' ? b.label : '' });
      } else if ((b.type === 'call' || b.type === 'later') && typeof b.name === 'string' && b.name.trim()) {
        edges.push({ from: s.id, to: target(b.name.trim()), kind: 'call', label: '' });
      }
    });
  }

  // つながりに出てくるかたまりだけを点にする（かたまりの並びのまま）
  const used = new Set();
  for (const e of edges) { used.add(e.from); used.add(e.to); }
  const nodes = scripts.filter((s) => used.has(s.id)).map((s) => ({ id: s.id, script: s, missing: false, name: s.name || '' }));
  for (const [name, id] of missing) nodes.push({ id, script: null, missing: true, name });

  // 列: どこからもつながってこない点を 0 列目にして、そこからたどる（輪になっていて始まりの無いものは、残りの先頭から）
  const incoming = new Set(edges.map((e) => e.to));
  const out = new Map(nodes.map((n) => [n.id, []]));
  for (const e of edges) if (!out.get(e.from).includes(e.to)) out.get(e.from).push(e.to);
  const depth = new Map();
  const queue = [];
  const start = (id) => { depth.set(id, 0); queue.push(id); };
  for (const n of nodes) if (!incoming.has(n.id)) start(n.id);
  const drain = () => {
    while (queue.length) {
      const id = queue.shift();
      for (const to of out.get(id)) {
        if (depth.has(to)) continue;
        depth.set(to, depth.get(id) + 1);
        queue.push(to);
      }
    }
  };
  drain();
  for (const n of nodes) if (!depth.has(n.id)) { start(n.id); drain(); }
  const rows = new Map();
  for (const n of nodes) {
    n.depth = depth.get(n.id);
    n.row = rows.get(n.depth) || 0;
    rows.set(n.depth, n.row + 1);
  }
  return { nodes, edges };
}
