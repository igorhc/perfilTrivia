import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Board } from '../logic/board';
import { UNIT } from '../logic/board';
import { pinOffsets } from '../logic/game';
import { SPECIAL_INFO, THEME_STYLES, decorationShape } from './themes';

export interface PinView { id: string; name: string; color: string; cell: number }

interface Props {
  board: Board;
  pins?: PinView[];
  currentId?: string;
  /** 'follow' acompanha `focusCell`; 'all' mostra o tabuleiro inteiro. */
  camera?: 'follow' | 'all';
  focusCell?: number;
}

type VB = { x: number; y: number; w: number; h: number };

const StaticLayer = memo(function StaticLayer({ board }: { board: Board }) {
  const t = THEME_STYLES[board.theme];
  const r = board.cellRadius;
  const d = board.path.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const gid = `bg-${board.seed.replace(/[^a-z0-9]/gi, '')}`;
  const last = board.total - 1;
  return (
    <g>
      <defs>
        <radialGradient id={gid} cx="50%" cy="40%" r="80%">
          <stop offset="0%" stopColor={t.bg[0]} />
          <stop offset="100%" stopColor={t.bg[1]} />
        </radialGradient>
      </defs>
      <rect x={-board.width} y={-board.height} width={board.width * 3} height={board.height * 3} fill={t.bg[1]} />
      <rect x={0} y={0} width={board.width} height={board.height} fill={`url(#${gid})`} />
      {board.islands.map((i, k) => (
        <g key={k}>
          <circle cx={i.x} cy={i.y} r={i.r + UNIT * 0.75} fill={t.islandEdge} opacity={0.6} />
          <circle cx={i.x} cy={i.y} r={i.r + UNIT * 0.6} fill={t.island} />
        </g>
      ))}
      {board.decorations.map((dec, k) => (
        <g key={k} transform={`translate(${dec.x.toFixed(1)},${dec.y.toFixed(1)}) rotate(${dec.rot.toFixed(1)}) scale(${dec.size.toFixed(1)})`}>
          {decorationShape(dec.kind, dec.variant)}
        </g>
      ))}
      <path d={d} fill="none" stroke={t.roadEdge} strokeWidth={r * 2.5} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={t.road} strokeWidth={r * 2.1} strokeLinecap="round" strokeLinejoin="round" />
      {board.islands.length > 0 && (
        <path d={d} fill="none" stroke={t.bridge} strokeWidth={r * 2.1} strokeDasharray={`4 ${UNIT * 0.18}`} opacity={0.35} />
      )}
      {board.cells.map((c) => {
        const sp = c.special ? SPECIAL_INFO[c.special] : null;
        const isEnd = c.index === 0 || c.index === last;
        if (isEnd) {
          // rótulo do lado oposto à casa vizinha, fora do caminho
          const nb = board.cells[c.index === 0 ? 1 : last - 1];
          const dx = c.x - nb.x, dy = c.y - nb.y, len = Math.hypot(dx, dy) || 1;
          const lx = (dx / len) * r * 2.6, ly = (dy / len) * r * 2.3;
          return (
            <g key={c.index} transform={`translate(${c.x},${c.y})`}>
              <circle r={r * 1.55} fill={c.index === 0 ? '#2ecc71' : '#f1c40f'} stroke="#222" strokeWidth={4} />
              <text y={r * 0.35} textAnchor="middle" fontSize={r * 1.1}>{c.index === 0 ? '🚩' : '🏁'}</text>
              {/* rótulo fora do círculo para não ficar escondido pelos pinos */}
              <g transform={`translate(${lx},${ly})`}>
                <rect x={-r * 1.9} y={-r * 0.48} width={r * 3.8} height={r * 0.96} rx={r * 0.48} fill="#222" />
                <text y={r * 0.24} textAnchor="middle" fontSize={r * 0.66} fontWeight={900} fill="#fff">{c.index === 0 ? 'INÍCIO' : 'CHEGADA'}</text>
              </g>
            </g>
          );
        }
        return (
          <g key={c.index} transform={`translate(${c.x},${c.y})`}>
            <circle r={r} fill={sp ? sp.color : t.cell} stroke={sp ? '#fff' : t.cellStroke} strokeWidth={3} />
            {sp ? (
              <>
                <text y={r * 0.12} textAnchor="middle" fontSize={r * 0.85} fontWeight={900} fill="#fff">{sp.short}</text>
                <text y={r * 0.72} textAnchor="middle" fontSize={r * 0.42} fontWeight={700} fill="#fff">{c.index}</text>
              </>
            ) : (
              <text y={r * 0.3} textAnchor="middle" fontSize={r * 0.85} fontWeight={800} fill={t.cellText}>{c.index}</text>
            )}
          </g>
        );
      })}
    </g>
  );
});

function fitVB(board: Board, aspect: number): VB {
  let w = board.width, h = board.height;
  if (w / h < aspect) w = h * aspect; else h = w / aspect;
  return { x: (board.width - w) / 2, y: (board.height - h) / 2, w, h };
}

export default function BoardView({ board, pins = [], currentId, camera = 'all', focusCell }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [aspect, setAspect] = useState(16 / 9);
  const [vb, setVb] = useState<VB>(() => fitVB(board, 16 / 9));
  const vbRef = useRef(vb);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const { width, height } = el.getBoundingClientRect();
      if (width > 0 && height > 0) setAspect(width / height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // alvo da câmera
  const full = fitVB(board, aspect);
  let target = full;
  if (camera === 'follow' && focusCell !== undefined) {
    const c = board.cells[Math.max(0, Math.min(board.total - 1, focusCell))];
    const w = Math.min(full.w, UNIT * 13 * Math.max(1, aspect / 1.6));
    const h = w / aspect;
    // não deixa a câmera passar da borda do tabuleiro
    const clamp = (v: number, size: number, view: number) => (view >= size ? (size - view) / 2 : Math.max(0, Math.min(size - view, v)));
    target = { x: clamp(c.x - w / 2, board.width, w), y: clamp(c.y - h / 2, board.height, h), w, h };
  }
  const tKey = `${target.x.toFixed(0)}|${target.y.toFixed(0)}|${target.w.toFixed(0)}|${target.h.toFixed(0)}`;

  useEffect(() => {
    let raf = 0;
    const animate = () => {
      const cur = vbRef.current;
      const k = 0.12;
      const next = { x: cur.x + (target.x - cur.x) * k, y: cur.y + (target.y - cur.y) * k, w: cur.w + (target.w - cur.w) * k, h: cur.h + (target.h - cur.h) * k };
      const done = Math.abs(next.x - target.x) < 0.5 && Math.abs(next.y - target.y) < 0.5 && Math.abs(next.w - target.w) < 0.5;
      vbRef.current = done ? target : next;
      setVb(vbRef.current);
      if (!done) raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tKey]);

  // agrupa pinos por casa para ficarem lado a lado
  const byCell = new Map<number, PinView[]>();
  pins.forEach((p) => byCell.set(p.cell, [...(byCell.get(p.cell) ?? []), p]));
  const r = board.cellRadius;

  return (
    <div ref={wrapRef} className="board-wrap">
      <svg viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} preserveAspectRatio="xMidYMid meet" className="board-svg">
        <StaticLayer board={board} />
        {pins.map((p) => {
          const group = byCell.get(p.cell)!;
          const k = group.indexOf(p);
          const scale = group.length > 4 ? 0.7 : group.length > 1 ? 0.85 : 1;
          const off = pinOffsets(group.length, r * 0.95 * scale)[k];
          const c = board.cells[Math.min(board.total - 1, p.cell)];
          const isCur = p.id === currentId;
          return (
            <g key={p.id} className="pin" style={{ transform: `translate(${c.x + off.dx}px, ${c.y + off.dy - r * 0.4}px) scale(${scale})` }}>
              {isCur && <circle r={r * 0.95} cy={r * 0.35} className="pin-pulse" fill="none" stroke="#fff" strokeWidth={5} />}
              <ellipse cy={r * 0.75} rx={r * 0.45} ry={r * 0.15} fill="#000" opacity={0.3} />
              <path d={`M0,${r * 0.75} C${-r * 0.2},${r * 0.2} ${-r * 0.55},${r * 0.05} ${-r * 0.55},${-r * 0.35} A${r * 0.55},${r * 0.55} 0 1 1 ${r * 0.55},${-r * 0.35} C${r * 0.55},${r * 0.05} ${r * 0.2},${r * 0.2} 0,${r * 0.75} Z`}
                fill={p.color} stroke={isCur ? '#fff' : '#222'} strokeWidth={isCur ? 5 : 3} />
              <text y={-r * 0.18} textAnchor="middle" fontSize={r * 0.6} fontWeight={900} fill="#fff" stroke="#000" strokeWidth={1.5} paintOrder="stroke">
                {p.name.trim().charAt(0).toUpperCase()}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
