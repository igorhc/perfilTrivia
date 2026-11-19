import { type Rng, shuffle } from './rng';

export type CardType = 'perfil' | 'trivia';

export interface TypeBag {
  /** Tipos restantes no saco; o próximo a sair é o último. */
  remaining: CardType[];
  /** Quantas cartas de cada tipo entram em cada reabastecimento. */
  perType: number;
}

export function fillBag(rng: Rng, perType = 3): TypeBag {
  const items: CardType[] = [];
  for (let i = 0; i < perType; i++) items.push('perfil', 'trivia');
  return { remaining: shuffle(rng, items), perType };
}

/** Tira um tipo do saco (reabastecendo quando vazio). Não muta o saco recebido. */
export function drawType(bag: TypeBag, rng: Rng): { type: CardType; bag: TypeBag } {
  const current = bag.remaining.length > 0 ? bag : fillBag(rng, bag.perType);
  const remaining = current.remaining.slice();
  const type = remaining.pop()!;
  return { type, bag: { remaining, perType: current.perType } };
}
