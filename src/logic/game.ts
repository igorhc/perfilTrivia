import type { SpecialKind } from './board';

export interface PlayerState {
  id: string;
  name: string;
  color: string;
  position: number;
  /** Perde a próxima vez (caiu em "perca a vez"). */
  skipNext: boolean;
  /** Na próxima jogada escolhe livremente tipo e categoria. */
  freeChoice: boolean;
}

export interface MoveResult {
  /** Casas percorridas no movimento principal (sem incluir a casa de partida). */
  path: number[];
  /** Casa onde o movimento principal terminou. */
  landing: number;
  /** Efeito especial aplicado (se a casa de chegada tiver um). */
  special?: SpecialKind;
  /** Casas percorridas pelo efeito especial (avance/volte 3). */
  specialPath: number[];
  finalPosition: number;
  extraTurn: boolean;
  skipNext: boolean;
  freeChoice: boolean;
  won: boolean;
}

export const SPECIAL_STEPS = 3;

function walk(from: number, to: number): number[] {
  const out: number[] = [];
  const dir = to > from ? 1 : -1;
  for (let i = from + dir; dir > 0 ? i <= to : i >= to; i += dir) out.push(i);
  return out;
}

/**
 * Calcula o movimento de um pino. `specials` mapeia índice da casa → efeito.
 * O efeito só é aplicado na casa onde o movimento principal termina (sem encadear).
 */
export function resolveMove(
  from: number,
  steps: number,
  total: number,
  specials: ReadonlyMap<number, SpecialKind> | Record<number, SpecialKind | undefined>,
): MoveResult {
  const finish = total - 1;
  const getSpecial = (i: number) =>
    specials instanceof Map ? specials.get(i) : (specials as Record<number, SpecialKind | undefined>)[i];
  const landing = Math.min(finish, from + Math.max(0, steps));
  const path = walk(from, landing);
  const result: MoveResult = {
    path, landing, specialPath: [], finalPosition: landing,
    extraTurn: false, skipNext: false, freeChoice: false, won: landing >= finish,
  };
  if (steps <= 0 || result.won) return result;
  const special = getSpecial(landing);
  if (!special) return result;
  result.special = special;
  switch (special) {
    case 'avance3': {
      const to = Math.min(finish, landing + SPECIAL_STEPS);
      result.specialPath = walk(landing, to);
      result.finalPosition = to;
      result.won = to >= finish;
      break;
    }
    case 'volte3': {
      const to = Math.max(0, landing - SPECIAL_STEPS);
      result.specialPath = walk(landing, to);
      result.finalPosition = to;
      break;
    }
    case 'perdeVez': result.skipNext = true; break;
    case 'jogueNovamente': result.extraTurn = true; break;
    case 'escolhaLivre': result.freeChoice = true; break;
  }
  return result;
}

/**
 * Decide quem joga a seguir. Jogadores com `skipNext` são pulados uma vez (e o flag é limpo).
 * Retorna o índice do próximo jogador, a lista de jogadores atualizada e quem foi pulado.
 */
export function nextTurn(
  players: PlayerState[],
  current: number,
  extraTurn: boolean,
): { index: number; players: PlayerState[]; skipped: string[] } {
  if (extraTurn) return { index: current, players, skipped: [] };
  const updated = players.map((p) => ({ ...p }));
  const skipped: string[] = [];
  let idx = current;
  for (let guard = 0; guard < players.length * 2 + 1; guard++) {
    idx = (idx + 1) % updated.length;
    if (updated[idx].skipNext) {
      updated[idx].skipNext = false;
      skipped.push(updated[idx].name);
      continue;
    }
    return { index: idx, players: updated, skipped };
  }
  return { index: (current + 1) % updated.length, players: updated, skipped };
}

/** Ranking pela posição no tabuleiro (empates mantêm a ordem de turno). */
export function ranking(players: PlayerState[]): PlayerState[] {
  return players.map((p, i) => ({ p, i })).sort((a, b) => b.p.position - a.p.position || a.i - b.i).map((x) => x.p);
}

/** Posições laterais para vários pinos na mesma casa. */
export function pinOffsets(count: number, spacing: number): { dx: number; dy: number }[] {
  if (count <= 1) return [{ dx: 0, dy: 0 }];
  const perRow = count <= 4 ? count : Math.ceil(count / 2);
  const rows = Math.ceil(count / perRow);
  const out: { dx: number; dy: number }[] = [];
  for (let i = 0; i < count; i++) {
    const r = Math.floor(i / perRow);
    const inRow = r === rows - 1 ? count - r * perRow : perRow;
    const c = i % perRow;
    out.push({ dx: (c - (inRow - 1) / 2) * spacing, dy: (r - (rows - 1) / 2) * spacing * 0.9 });
  }
  return out;
}
