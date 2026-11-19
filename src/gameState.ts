import type { Card } from './logic/cards';
import type { MoveResult, PlayerState } from './logic/game';
import { fillBag, type CardType, type TypeBag } from './logic/typeBag';

export type Phase = 'start' | 'roulette' | 'category' | 'card' | 'result' | 'moving' | 'victory';

export interface TurnState {
  phase: Phase;
  type?: CardType;
  /** Esta jogada tem escolha livre de tipo (casa especial). */
  free?: boolean;
  cardId?: number;
  /** Perfil: dicas visíveis (1..10). Trivia: dicas usadas (0..3). */
  shown: number;
  revealed: boolean;
  picked?: string;
  /** Trivia de múltipla escolha: alternativas que o jogador já errou nesta carta. */
  wrong?: string[];
  /** reason: explicação mostrada no resultado (ex.: sobrou só uma alternativa). */
  outcome?: { correct: boolean; steps: number; reason?: string };
  move?: MoveResult;
  hintSeed: string;
}

export interface GameState {
  version: 1;
  seed: string;
  players: PlayerState[];
  current: number;
  bag: TypeBag;
  used: number[];
  turn: TurnState;
  winnerId?: string;
}

const KEY = 'pt-game-v1';

export function newTurn(): TurnState {
  return { phase: 'start', shown: 0, revealed: false, hintSeed: Math.random().toString(36).slice(2) };
}

export function newGame(players: { id: string; name: string; color: string }[], seed: string): GameState {
  return {
    version: 1,
    seed,
    players: players.map((p) => ({ ...p, position: 0, skipNext: false, freeChoice: false })),
    current: 0,
    bag: fillBag(Math.random, 3),
    used: [],
    turn: newTurn(),
  };
}

export function saveGame(g: GameState | null) {
  try {
    if (!g || g.turn.phase === 'victory') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(g));
  } catch { /* armazenamento indisponível */ }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const g = JSON.parse(raw) as GameState;
    return g.version === 1 && Array.isArray(g.players) ? g : null;
  } catch { return null; }
}

/** Categorias de um tipo com quantas cartas ainda não usadas cada uma tem. */
export function availableByCategory(cards: Card[], used: number[], type: CardType, categories: string[]): { name: string; count: number }[] {
  const usedSet = new Set(used);
  return categories.map((name) => ({
    name,
    count: cards.filter((c) => c.kind === type && c.category === name && !usedSet.has(c.id!)).length,
  }));
}

/** Sorteia uma carta não usada da categoria. Se todas já saíram, libera as repetidas dessa categoria. */
export function drawCard(cards: Card[], used: number[], type: CardType, category: string): Card | null {
  const usedSet = new Set(used);
  const pool = cards.filter((c) => c.kind === type && c.category === category);
  const fresh = pool.filter((c) => !usedSet.has(c.id!));
  const from = fresh.length ? fresh : pool;
  return from.length ? from[Math.floor(Math.random() * from.length)] : null;
}
