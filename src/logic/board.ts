import { type Rng, createRng, pick, randInt, randRange, shuffle } from './rng';

export type SpecialKind = 'avance3' | 'volte3' | 'perdeVez' | 'jogueNovamente' | 'escolhaLivre';
export type LayoutKind = 'serpente' | 'colunas' | 'sinuoso' | 'espiral' | 'ilhas';
export type ThemeId = 'floresta' | 'espaco' | 'oceano' | 'deserto' | 'cidade' | 'doces';

export const SPECIAL_KINDS: SpecialKind[] = ['avance3', 'volte3', 'perdeVez', 'jogueNovamente', 'escolhaLivre'];
export const LAYOUTS: LayoutKind[] = ['serpente', 'colunas', 'sinuoso', 'espiral', 'ilhas'];
export const THEMES: ThemeId[] = ['floresta', 'espaco', 'oceano', 'deserto', 'cidade', 'doces'];

export const MIN_CELLS = 120;
export const MAX_CELLS = 140;
/** Nenhuma especial nas N primeiras casas numeradas nem nas N últimas. */
export const SPECIAL_MARGIN = 5;

/** Tamanho de uma "unidade" de layout em pixels do SVG (≈ distância entre casas). */
export const UNIT = 70;
export const CELL_RADIUS = 0.38 * UNIT;

export interface Pt { x: number; y: number }
export interface Cell { index: number; x: number; y: number; special?: SpecialKind }
export interface Decoration { kind: string; x: number; y: number; size: number; rot: number; variant: number }
export interface Island { x: number; y: number; r: number }

export interface Board {
  seed: string;
  total: number;
  layout: LayoutKind;
  theme: ThemeId;
  cells: Cell[];
  /** Linha suavizada do caminho (px), usada para desenhar a trilha. */
  path: Pt[];
  islands: Island[];
  decorations: Decoration[];
  width: number;
  height: number;
  cellRadius: number;
}

export const DECORATIONS_BY_THEME: Record<ThemeId, string[]> = {
  floresta: ['arvore', 'pinheiro', 'arbusto', 'flor', 'pedra', 'cogumelo'],
  espaco: ['planeta', 'estrela', 'asteroide', 'estrela', 'cometa', 'planeta'],
  oceano: ['peixe', 'coral', 'bolha', 'onda', 'alga', 'concha'],
  deserto: ['cacto', 'duna', 'pedra', 'cacto', 'caveira', 'arbusto'],
  cidade: ['predio', 'predio', 'nuvem', 'arvore', 'casa', 'poste'],
  doces: ['pirulito', 'bala', 'cupcake', 'pirulito', 'rosquinha', 'nuvem'],
};

// ---------- utilidades geométricas ----------

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

export function chaikin(points: Pt[], iterations: number): Pt[] {
  let pts = points;
  for (let it = 0; it < iterations; it++) {
    const out: Pt[] = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      out.push({ x: 0.75 * a.x + 0.25 * b.x, y: 0.75 * a.y + 0.25 * b.y });
      out.push({ x: 0.25 * a.x + 0.75 * b.x, y: 0.25 * a.y + 0.75 * b.y });
    }
    out.push(pts[pts.length - 1]);
    pts = out;
  }
  return pts;
}

export function polylineLength(points: Pt[]): number {
  let l = 0;
  for (let i = 1; i < points.length; i++) l += dist(points[i - 1], points[i]);
  return l;
}

/** Distribui `count` pontos igualmente espaçados ao longo da polilinha. */
export function resample(points: Pt[], count: number): Pt[] {
  const total = polylineLength(points);
  const step = total / (count - 1);
  const out: Pt[] = [points[0]];
  let seg = 0;
  let segStart = 0;
  for (let i = 1; i < count - 1; i++) {
    const target = i * step;
    while (seg < points.length - 2 && segStart + dist(points[seg], points[seg + 1]) < target) {
      segStart += dist(points[seg], points[seg + 1]);
      seg++;
    }
    const a = points[seg], b = points[seg + 1];
    const len = dist(a, b) || 1;
    const t = Math.min(1, Math.max(0, (target - segStart) / len));
    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  out.push(points[points.length - 1]);
  return out;
}

/** Menor distância entre casas não consecutivas. */
export function minNonAdjacentDistance(cells: Pt[]): number {
  let min = Infinity;
  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 2; j < cells.length; j++) {
      const d = dist(cells[i], cells[j]);
      if (d < min) min = d;
    }
  }
  return min;
}

/** Verifica se dois segmentos se cruzam (excluindo pontas compartilhadas). */
function segmentsCross(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const o = (p: Pt, q: Pt, r: Pt) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const d1 = o(c, d, a), d2 = o(c, d, b), d3 = o(a, b, c), d4 = o(a, b, d);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

/** True se o caminho ligando as casas em ordem se cruza em algum ponto. */
export function pathSelfIntersects(cells: Pt[]): boolean {
  for (let i = 0; i < cells.length - 1; i++) {
    for (let j = i + 2; j < cells.length - 1; j++) {
      if (segmentsCross(cells[i], cells[i + 1], cells[j], cells[j + 1])) return true;
    }
  }
  return false;
}

// ---------- traçados (em unidades; ~1 unidade entre casas) ----------

interface Trace { points: Pt[]; islands: Island[] }

function serpentine(lanes: number, laneLen: number, gap: number, rng: Rng): Pt[] {
  const pts: Pt[] = [];
  const amp = randRange(rng, 0.1, 0.3);
  const freq = randRange(rng, 0.35, 0.6);
  const phase = randRange(rng, 0, Math.PI * 2);
  const wave = (x: number) => amp * Math.sin(x * freq + phase);
  const steps = Math.ceil(laneLen * 2);
  for (let l = 0; l < lanes; l++) {
    const y = l * gap;
    const forward = l % 2 === 0;
    for (let k = 0; k <= steps; k++) {
      const x = forward ? (laneLen * k) / steps : laneLen - (laneLen * k) / steps;
      pts.push({ x, y: y + wave(x) });
    }
    if (l < lanes - 1) {
      // curva em U (semicírculo) até a próxima faixa
      const cx = forward ? laneLen : 0;
      const cy = y + gap / 2;
      const r = gap / 2;
      for (let s = 1; s < 12; s++) {
        const a = -Math.PI / 2 + (Math.PI * s) / 12;
        const x = forward ? cx + r * Math.cos(a) : cx - r * Math.cos(a);
        pts.push({ x, y: cy + r * Math.sin(a) + wave(cx) });
      }
    }
  }
  return pts;
}

function traceSerpente(rng: Rng, total: number): Trace {
  const gap = randRange(rng, 1.35, 1.6);
  const lanes = randInt(rng, 6, 8);
  const turnLen = (Math.PI * gap) / 2;
  const laneLen = (total - 1 - (lanes - 1) * turnLen) / lanes;
  return { points: serpentine(lanes, laneLen, gap, rng), islands: [] };
}

function traceColunas(rng: Rng, total: number): Trace {
  const gap = randRange(rng, 1.35, 1.6);
  const lanes = randInt(rng, 11, 14);
  const turnLen = (Math.PI * gap) / 2;
  const laneLen = (total - 1 - (lanes - 1) * turnLen) / lanes;
  const pts = serpentine(lanes, laneLen, gap, rng).map((p) => ({ x: p.y, y: p.x }));
  return { points: pts, islands: [] };
}

/** Caminho hamiltoniano aleatório numa grade, via movimentos "backbite" na ponta final
 *  (a ponta inicial fica fixa no canto). Nunca se cruza por construção. */
export function randomGridPath(rng: Rng, cols: number, rows: number, moves: number): Pt[] {
  const path: Pt[] = [];
  for (let y = 0; y < rows; y++) {
    for (let i = 0; i < cols; i++) path.push({ x: y % 2 === 0 ? i : cols - 1 - i, y });
  }
  const key = (p: Pt) => p.y * cols + p.x;
  const pos = new Int32Array(cols * rows);
  path.forEach((p, i) => (pos[key(p)] = i));
  const n = path.length;
  for (let m = 0; m < moves; m++) {
    const end = path[n - 1];
    const nbs: Pt[] = [];
    if (end.x > 0) nbs.push({ x: end.x - 1, y: end.y });
    if (end.x < cols - 1) nbs.push({ x: end.x + 1, y: end.y });
    if (end.y > 0) nbs.push({ x: end.x, y: end.y - 1 });
    if (end.y < rows - 1) nbs.push({ x: end.x, y: end.y + 1 });
    const nb = pick(rng, nbs);
    const j = pos[key(nb)];
    if (j === n - 2) continue;
    // liga a ponta ao vizinho j e inverte o trecho j+1..n-1
    let a = j + 1, b = n - 1;
    while (a < b) {
      [path[a], path[b]] = [path[b], path[a]];
      pos[key(path[a])] = a;
      pos[key(path[b])] = b;
      a++; b--;
    }
  }
  return path;
}

function traceSinuoso(rng: Rng, total: number): Trace {
  const scale = 1.3;
  const cells = Math.round(total * randRange(rng, 0.8, 0.88));
  const cols = Math.round(Math.sqrt(cells * 1.7));
  const rows = Math.max(4, Math.round(cells / cols));
  const raw = randomGridPath(rng, cols, rows, cols * rows * 40);
  const pts = chaikin(raw.map((p) => ({ x: p.x * scale, y: p.y * scale })), 3);
  return { points: pts, islands: [] };
}

function traceEspiral(rng: Rng, total: number): Trace {
  const gap = randRange(rng, 1.35, 1.55);
  const b = gap / (2 * Math.PI);
  const sx = randRange(rng, 1.5, 1.8);
  const r0 = 1.8;
  const dir = rng() < 0.5 ? 1 : -1;
  const rot = randRange(rng, 0, Math.PI * 2);
  const pts: Pt[] = [];
  let theta = r0 / b;
  let len = 0;
  let prev: Pt | null = null;
  const target = (total - 1) * 1.02;
  while (len < target) {
    const r = b * theta;
    const p = { x: r * Math.cos(dir * theta + rot) * sx, y: r * Math.sin(dir * theta + rot) };
    if (prev) len += dist(prev, p);
    pts.push(p);
    prev = p;
    theta += 0.03;
  }
  // de fora para dentro: CHEGADA no centro
  return { points: pts.reverse(), islands: [] };
}

function traceIlhas(rng: Rng, total: number): Trace {
  const [ic, ir] = pick(rng, [[3, 2], [4, 2], [3, 3]] as const);
  const bridge = randRange(rng, 2.2, 3.2);
  const order: { c: number; r: number }[] = [];
  for (let r = 0; r < ir; r++) for (let k = 0; k < ic; k++) order.push({ c: r % 2 === 0 ? k : ic - 1 - k, r });
  const n = order.length;
  const angle = (from: { c: number; r: number }, to: { c: number; r: number }) => Math.atan2(to.r - from.r, to.c - from.c);
  const arcs: { aIn: number; sweep: number }[] = [];
  let sweepSum = 0;
  for (let i = 0; i < n; i++) {
    const aOut = i < n - 1 ? angle(order[i], order[i + 1]) : angle(order[i - 1], order[i]) + randRange(rng, -0.4, 0.4);
    const aIn = i > 0 ? angle(order[i], order[i - 1]) : aOut + Math.PI + randRange(rng, -0.4, 0.4);
    // varre pelo lado longo do círculo (>= 180°)
    const ccw = (((aOut - aIn) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    let sweep: number;
    if (Math.abs(ccw - Math.PI) < 0.01) sweep = rng() < 0.5 ? Math.PI : -Math.PI;
    else sweep = ccw > Math.PI ? ccw : ccw - 2 * Math.PI;
    arcs.push({ aIn, sweep });
    sweepSum += Math.abs(sweep);
  }
  const R = (total - 1 - (n - 1) * bridge) / sweepSum;
  const D = 2 * R + bridge;
  const islands: Island[] = order.map((o) => ({ x: o.c * D, y: o.r * D, r: R }));
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const { aIn, sweep } = arcs[i];
    const isl = islands[i];
    const steps = Math.ceil(Math.abs(sweep) * R * 3);
    for (let s = 0; s <= steps; s++) {
      const a = aIn + (sweep * s) / steps;
      pts.push({ x: isl.x + R * Math.cos(a), y: isl.y + R * Math.sin(a) });
    }
    // a ponte é o segmento reto até o primeiro ponto da próxima ilha
  }
  return { points: pts, islands };
}

const TRACERS: Record<LayoutKind, (rng: Rng, total: number) => Trace> = {
  serpente: traceSerpente,
  colunas: traceColunas,
  sinuoso: traceSinuoso,
  espiral: traceEspiral,
  ilhas: traceIlhas,
};

// ---------- casas especiais ----------

export function placeSpecials(rng: Rng, total: number): Map<number, SpecialKind> {
  const count = Math.round(total * 0.1);
  const first = SPECIAL_MARGIN + 1; // casa 0 = INÍCIO
  const last = total - 2 - SPECIAL_MARGIN; // casa total-1 = CHEGADA
  const eligible = shuffle(rng, Array.from({ length: last - first + 1 }, (_, i) => first + i));
  const chosen = new Set<number>();
  for (const i of eligible) {
    if (chosen.size >= count) break;
    if (chosen.has(i - 1) || chosen.has(i + 1)) continue;
    chosen.add(i);
  }
  const kinds: SpecialKind[] = [];
  while (kinds.length < chosen.size) kinds.push(...shuffle(rng, SPECIAL_KINDS));
  const shuffledKinds = shuffle(rng, kinds.slice(0, chosen.size));
  const map = new Map<number, SpecialKind>();
  [...chosen].sort((a, b) => a - b).forEach((idx, k) => map.set(idx, shuffledKinds[k]));
  return map;
}

// ---------- decorações ----------

function placeDecorations(rng: Rng, theme: ThemeId, cells: Pt[], width: number, height: number): Decoration[] {
  const kinds = DECORATIONS_BY_THEME[theme];
  const out: Decoration[] = [];
  const target = Math.round((width * height) / (UNIT * UNIT) / 5);
  const cellClear = UNIT * 0.85;
  for (let attempt = 0; attempt < target * 12 && out.length < target; attempt++) {
    const size = randRange(rng, 0.6, 1.5) * UNIT;
    const p = { x: randRange(rng, 0, width), y: randRange(rng, 0, height) };
    let ok = true;
    for (const c of cells) {
      if (dist(c, p) < cellClear + size * 0.5) { ok = false; break; }
    }
    if (!ok) continue;
    for (const d of out) {
      if (dist(d, p) < (d.size + size) * 0.45) { ok = false; break; }
    }
    if (!ok) continue;
    out.push({ kind: pick(rng, kinds), x: p.x, y: p.y, size, rot: randRange(rng, -12, 12), variant: randInt(rng, 0, 3) });
  }
  return out.sort((a, b) => a.y - b.y);
}

// ---------- gerador principal ----------

export interface GenerateOptions { layout?: LayoutKind; theme?: ThemeId; total?: number }

export function generateBoard(seed: string, opts: GenerateOptions = {}): Board {
  const rng = createRng(seed);
  const total = opts.total ?? randInt(rng, MIN_CELLS, MAX_CELLS);
  const theme = opts.theme ?? pick(rng, THEMES);
  let layout = opts.layout ?? pick(rng, LAYOUTS);

  let trace: Trace | null = null;
  let cellsU: Pt[] = [];
  for (let attempt = 0; attempt < 40; attempt++) {
    const kind: LayoutKind = attempt < 30 ? layout : 'serpente';
    const t = TRACERS[kind](rng, total);
    const c = resample(t.points, total);
    const spacing = polylineLength(t.points) / (total - 1);
    if (spacing >= 0.85 && minNonAdjacentDistance(c) >= 0.82 && !pathSelfIntersects(c)) {
      trace = t;
      cellsU = c;
      layout = kind;
      break;
    }
  }
  if (!trace) throw new Error('Não foi possível gerar o tabuleiro');

  // normaliza para pixels
  const pad = 1.4;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const grow = (x: number, y: number, r = 0) => {
    minX = Math.min(minX, x - r); minY = Math.min(minY, y - r);
    maxX = Math.max(maxX, x + r); maxY = Math.max(maxY, y + r);
  };
  cellsU.forEach((p) => grow(p.x, p.y));
  trace.islands.forEach((i) => grow(i.x, i.y, i.r + 0.8));
  let width = (maxX - minX + pad * 2) * UNIT;
  let height = (maxY - minY + pad * 2) * UNIT;

  // aproxima a proporção de uma tela 16:9 acrescentando margem
  const aspect = 16 / 9;
  let offX = 0, offY = 0;
  if (width / height < aspect) { const w = height * aspect; offX = (w - width) / 2; width = w; }
  else if (width / height > aspect * 1.25) { const h = width / (aspect * 1.25); offY = (h - height) / 2; height = h; }
  const px = (p: Pt): Pt => ({ x: (p.x - minX + pad) * UNIT + offX, y: (p.y - minY + pad) * UNIT + offY });

  const specials = placeSpecials(rng, total);
  const cells: Cell[] = cellsU.map((p, index) => {
    const special = specials.get(index);
    return special ? { index, ...px(p), special } : { index, ...px(p) };
  });
  const path = trace.points.map(px);
  const islands = trace.islands.map((i) => ({ ...px(i), r: i.r * UNIT }));
  const decorations = placeDecorations(rng, theme, cells, width, height);

  return { seed, total, layout, theme, cells, path, islands, decorations, width, height, cellRadius: CELL_RADIUS };
}
