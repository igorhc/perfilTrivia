import type { JSX } from 'react';
import type { SpecialKind, ThemeId } from '../logic/board';

export interface ThemeStyle {
  name: string;
  bg: [string, string];
  road: string;
  roadEdge: string;
  cell: string;
  cellStroke: string;
  cellText: string;
  island: string;
  islandEdge: string;
  bridge: string;
}

export const THEME_STYLES: Record<ThemeId, ThemeStyle> = {
  floresta: { name: 'Floresta', bg: ['#9fd88a', '#5fa65a'], road: '#d9b77c', roadEdge: '#8a6b3c', cell: '#fff8e7', cellStroke: '#6b4f2a', cellText: '#3d2b14', island: '#7cc36b', islandEdge: '#3f7d38', bridge: '#8a5a2b' },
  espaco: { name: 'Espaço', bg: ['#1b1745', '#05040f'], road: '#3b3480', roadEdge: '#8f86ff', cell: '#e9e6ff', cellStroke: '#5b50d6', cellText: '#1b1745', island: '#2c2463', islandEdge: '#6a5fe0', bridge: '#8f86ff' },
  oceano: { name: 'Oceano', bg: ['#5cc8f0', '#1565a8'], road: '#f2dfb0', roadEdge: '#b08d4c', cell: '#ffffff', cellStroke: '#0e5e8c', cellText: '#0b3a5a', island: '#f3d99b', islandEdge: '#c9a55a', bridge: '#8a5a2b' },
  deserto: { name: 'Deserto', bg: ['#ffd99a', '#e8a25a'], road: '#c97f43', roadEdge: '#8c4f22', cell: '#fff5e3', cellStroke: '#8c4f22', cellText: '#5a2f10', island: '#f0c27a', islandEdge: '#b9813f', bridge: '#6b3e1a' },
  cidade: { name: 'Cidade', bg: ['#b9d7ee', '#8fb3cf'], road: '#4a4f5a', roadEdge: '#2a2d33', cell: '#ffffff', cellStroke: '#2a2d33', cellText: '#1d2026', island: '#9bc48a', islandEdge: '#5d8a4f', bridge: '#2a2d33' },
  doces: { name: 'Doces', bg: ['#ffd1ea', '#f59fcb'], road: '#fff1f8', roadEdge: '#e05a9c', cell: '#ffffff', cellStroke: '#c2337b', cellText: '#7a1648', island: '#fbe3a6', islandEdge: '#d9a441', bridge: '#c2337b' },
};

export const SPECIAL_INFO: Record<SpecialKind, { label: string; short: string; icon: string; color: string; desc: string }> = {
  avance3: { label: 'Avance 3', short: '+3', icon: '⏩', color: '#2ecc71', desc: 'Anda mais 3 casas.' },
  volte3: { label: 'Volte 3', short: '−3', icon: '⏪', color: '#e74c3c', desc: 'Volta 3 casas.' },
  perdeVez: { label: 'Perca a vez', short: '⛔', icon: '⛔', color: '#7f8c8d', desc: 'Perde a próxima jogada.' },
  jogueNovamente: { label: 'Jogue de novo', short: '↻', icon: '🔁', color: '#f39c12', desc: 'Joga outra vez agora.' },
  escolhaLivre: { label: 'Escolha livre', short: '★', icon: '⭐', color: '#9b59b6', desc: 'Na próxima jogada escolhe o tipo da carta (Perfil ou Trivia) e a categoria.' },
};

const V = ['#e76f51', '#f4a261', '#2a9d8f', '#e9c46a', '#8ab17d', '#b56576'];

/** Desenha uma decoração centrada em (0,0) dentro de uma caixa de ~1×1. */
export function decorationShape(kind: string, variant: number): JSX.Element {
  const c = V[variant % V.length];
  switch (kind) {
    case 'arvore':
      return (<g><rect x={-0.07} y={0.05} width={0.14} height={0.4} fill="#7a4e2a" /><circle cx={0} cy={-0.12} r={0.32} fill={variant % 2 ? '#3f8f3a' : '#4fa64a'} /><circle cx={-0.15} cy={-0.02} r={0.2} fill="#3a8235" /><circle cx={0.16} cy={-0.05} r={0.2} fill="#57b350" /></g>);
    case 'pinheiro':
      return (<g><rect x={-0.06} y={0.3} width={0.12} height={0.18} fill="#6b4226" /><polygon points="0,-0.5 0.3,0 -0.3,0" fill="#2f6b34" /><polygon points="0,-0.3 0.36,0.32 -0.36,0.32" fill="#357a3b" /></g>);
    case 'arbusto':
      return (<g><circle cx={-0.18} cy={0.15} r={0.2} fill="#5a8f3a" /><circle cx={0.15} cy={0.15} r={0.22} fill="#4c7d31" /><circle cx={0} cy={0} r={0.24} fill="#66a043" /></g>);
    case 'flor':
      return (<g><rect x={-0.02} y={0} width={0.04} height={0.45} fill="#3a7a2a" />{[0, 72, 144, 216, 288].map((a) => (<circle key={a} cx={0.13 * Math.cos((a * Math.PI) / 180)} cy={0.13 * Math.sin((a * Math.PI) / 180) - 0.05} r={0.1} fill={c} />))}<circle cx={0} cy={-0.05} r={0.07} fill="#ffd166" /></g>);
    case 'pedra':
      return (<g><path d="M-0.4,0.25 L-0.3,-0.1 L-0.05,-0.25 L0.25,-0.15 L0.4,0.25 Z" fill="#9a9a9a" stroke="#6d6d6d" strokeWidth={0.03} /><path d="M-0.05,-0.25 L0.05,0.25" stroke="#7d7d7d" strokeWidth={0.02} /></g>);
    case 'cogumelo':
      return (<g><rect x={-0.08} y={0} width={0.16} height={0.3} fill="#f5ecd7" rx={0.05} /><path d="M-0.35,0.02 A0.35,0.3 0 0 1 0.35,0.02 Z" fill="#d63c3c" /><circle cx={-0.12} cy={-0.1} r={0.05} fill="#fff" /><circle cx={0.12} cy={-0.14} r={0.04} fill="#fff" /></g>);
    case 'planeta':
      return (<g><circle r={0.3} fill={c} /><circle cx={-0.1} cy={-0.1} r={0.08} fill="#fff" opacity={0.25} />{variant % 2 === 0 && <ellipse rx={0.48} ry={0.1} fill="none" stroke="#f1e3b5" strokeWidth={0.04} transform="rotate(-20)" />}</g>);
    case 'estrela':
      return (<polygon points="0,-0.35 0.09,-0.1 0.35,-0.1 0.14,0.06 0.22,0.32 0,0.16 -0.22,0.32 -0.14,0.06 -0.35,-0.1 -0.09,-0.1" fill="#fff6b0" transform="scale(0.7)" />);
    case 'asteroide':
      return (<g><path d="M-0.3,0 L-0.2,-0.25 L0.1,-0.3 L0.3,-0.05 L0.2,0.25 L-0.15,0.28 Z" fill="#6e6a80" /><circle cx={0.05} cy={-0.05} r={0.06} fill="#57536a" /><circle cx={-0.12} cy={0.12} r={0.04} fill="#57536a" /></g>);
    case 'cometa':
      return (<g><path d="M0.2,-0.2 L-0.45,0.35 L0.05,-0.05 Z" fill="#9fd3ff" opacity={0.6} /><circle cx={0.2} cy={-0.2} r={0.12} fill="#e6f4ff" /></g>);
    case 'peixe':
      return (<g><ellipse rx={0.3} ry={0.16} fill={c} /><polygon points="0.25,0 0.45,-0.15 0.45,0.15" fill={c} /><circle cx={-0.15} cy={-0.04} r={0.04} fill="#fff" /></g>);
    case 'coral':
      return (<g fill="none" stroke={c} strokeWidth={0.08} strokeLinecap="round"><path d="M0,0.45 L0,-0.1 M0,0.15 L-0.2,-0.15 M0,0.05 L0.22,-0.3 M-0.2,-0.15 L-0.25,-0.35" /></g>);
    case 'bolha':
      return (<g fill="none" stroke="#e8f8ff" strokeWidth={0.03}><circle r={0.15} /><circle cx={0.2} cy={-0.25} r={0.08} /><circle cx={-0.15} cy={-0.3} r={0.05} /></g>);
    case 'onda':
      return (<path d="M-0.45,0 Q-0.3,-0.15 -0.15,0 T0.15,0 T0.45,0" fill="none" stroke="#e8f8ff" strokeWidth={0.05} strokeLinecap="round" opacity={0.8} />);
    case 'alga':
      return (<path d="M0,0.45 C-0.2,0.2 0.2,0 0,-0.2 C-0.15,-0.35 0.05,-0.45 0,-0.5" fill="none" stroke="#2e8b57" strokeWidth={0.08} strokeLinecap="round" />);
    case 'concha':
      return (<g><path d="M0,0.25 L-0.3,-0.05 A0.3,0.3 0 0 1 0.3,-0.05 Z" fill="#ffd3b6" stroke="#e29578" strokeWidth={0.03} /><path d="M0,0.25 L0,-0.3 M0,0.25 L-0.17,-0.25 M0,0.25 L0.17,-0.25" stroke="#e29578" strokeWidth={0.02} /></g>);
    case 'cacto':
      return (<g fill="#3d9a4b"><rect x={-0.09} y={-0.4} width={0.18} height={0.85} rx={0.09} /><rect x={-0.3} y={-0.15} width={0.12} height={0.3} rx={0.06} /><rect x={-0.3} y={0.07} width={0.25} height={0.1} rx={0.05} /><rect x={0.18} y={-0.28} width={0.12} height={0.3} rx={0.06} /><rect x={0.05} y={-0.06} width={0.25} height={0.1} rx={0.05} /></g>);
    case 'duna':
      return (<path d="M-0.5,0.2 Q-0.1,-0.25 0.5,0.2 Z" fill="#e3a856" opacity={0.8} />);
    case 'caveira':
      return (<g><circle cy={-0.05} r={0.2} fill="#f3eee3" /><rect x={-0.1} y={0.08} width={0.2} height={0.12} fill="#f3eee3" /><circle cx={-0.07} cy={-0.05} r={0.05} fill="#5a3b1e" /><circle cx={0.07} cy={-0.05} r={0.05} fill="#5a3b1e" /></g>);
    case 'predio': {
      const h = 0.6 + (variant % 3) * 0.15;
      const windows = [];
      for (let y = -h / 2 + 0.08; y < h / 2 - 0.1; y += 0.14) for (const x of [-0.12, 0.03]) windows.push(<rect key={`${x}${y}`} x={x} y={y} width={0.08} height={0.08} fill="#ffe8a3" />);
      return (<g><rect x={-0.2} y={-h / 2} width={0.4} height={h} fill={['#6c7a89', '#8e7d6b', '#5c6b7a', '#a0848a'][variant % 4]} />{windows}</g>);
    }
    case 'casa':
      return (<g><rect x={-0.25} y={-0.05} width={0.5} height={0.35} fill="#f2e2c4" /><polygon points="-0.32,-0.05 0,-0.32 0.32,-0.05" fill={c} /><rect x={-0.06} y={0.1} width={0.12} height={0.2} fill="#7a4e2a" /></g>);
    case 'poste':
      return (<g><rect x={-0.025} y={-0.4} width={0.05} height={0.85} fill="#3a3f47" /><circle cy={-0.42} r={0.08} fill="#ffe08a" /></g>);
    case 'nuvem':
      return (<g fill="#ffffff" opacity={0.9}><circle cx={-0.18} cy={0.05} r={0.15} /><circle cx={0.02} cy={-0.05} r={0.2} /><circle cx={0.22} cy={0.06} r={0.14} /></g>);
    case 'pirulito':
      return (<g><rect x={-0.025} y={0} width={0.05} height={0.45} fill="#fff" stroke="#ccc" strokeWidth={0.01} /><circle cy={-0.1} r={0.25} fill={c} /><path d="M0,-0.1 m-0.15,0 a0.15,0.15 0 1 1 0.3,0 a0.1,0.1 0 1 1 -0.2,0" fill="none" stroke="#fff" strokeWidth={0.04} /></g>);
    case 'bala':
      return (<g><polygon points="-0.4,-0.12 -0.2,0 -0.4,0.12" fill={c} /><polygon points="0.4,-0.12 0.2,0 0.4,0.12" fill={c} /><ellipse rx={0.22} ry={0.14} fill={c} /><ellipse rx={0.1} ry={0.05} cy={-0.04} fill="#fff" opacity={0.5} /></g>);
    case 'cupcake':
      return (<g><path d="M-0.22,0 L0.22,0 L0.16,0.35 L-0.16,0.35 Z" fill="#c98b52" /><circle cx={-0.1} cy={-0.05} r={0.14} fill="#ffe0f0" /><circle cx={0.1} cy={-0.05} r={0.14} fill="#ffe0f0" /><circle cy={-0.17} r={0.13} fill="#ffe0f0" /><circle cy={-0.32} r={0.05} fill="#d62839" /></g>);
    case 'rosquinha':
      return (<g><circle r={0.3} fill="#d9a066" /><circle r={0.26} fill={c} /><circle r={0.1} fill="#f59fcb" /></g>);
    default:
      return <circle r={0.2} fill={c} />;
  }
}
