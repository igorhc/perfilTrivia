import { type Rng, shuffle } from './rng';
import { PERFIL_MAX_CLUES, TRIVIA_MAX_HINTS } from './scoring';

export type Difficulty = 'facil' | 'medio' | 'dificil';
export const DIFFICULTIES: Difficulty[] = ['facil', 'medio', 'dificil'];
export const DIFFICULTY_LABEL: Record<Difficulty, string> = { facil: 'Fácil', medio: 'Médio', dificil: 'Difícil' };

export const DEFAULT_PERFIL_CATEGORIES = ['Pessoa', 'Lugar', 'Coisa', 'Ano/Evento', 'Personagem', 'Animal'];
export const DEFAULT_TRIVIA_CATEGORIES = ['Geografia', 'História', 'Ciência', 'Esportes', 'Entretenimento', 'Tecnologia', 'Artes', 'Brasil'];

export interface PerfilCard {
  id?: number;
  kind: 'perfil';
  category: string;
  answer: string;
  clues: string[];
  difficulty: Difficulty;
}

export interface TriviaCard {
  id?: number;
  kind: 'trivia';
  category: string;
  question: string;
  type: 'multipla' | 'aberta';
  options?: string[];
  answer: string;
  hints: string[];
  difficulty: Difficulty;
}

export type Card = PerfilCard | TriviaCard;

export interface Category { id?: number; kind: 'perfil' | 'trivia'; name: string }

/** Formato do seed e do import/export. */
export interface QuestionBankFile {
  version?: number;
  categories?: { perfil?: string[]; trivia?: string[] };
  /** Cartas de versões anteriores do seed que foram substituídas (removidas ao atualizar o banco). */
  retired?: { perfil?: string[]; trivia?: string[] };
  perfil?: Omit<PerfilCard, 'kind' | 'id'>[];
  trivia?: Omit<TriviaCard, 'kind' | 'id'>[];
}

// ---------- validação ----------

const GENERIC_CLUE = /^(eu )?(sou|fui|era|e)? ?(um|uma|o|a)? ?(pessoa|ser humano|homem|mulher|menino|menina|lugar|local|localidade|coisa|objeto|animal|bicho|ser vivo|personagem|personagem ficticio|evento|acontecimento|ano|fato historico|data)( real| famos[oa]| ficticio| ficticia| historic[oa]| conhecid[oa])*$/;

/** Dica que COMEÇA anunciando a categoria ("Sou um animal que…", "Fui um evento…", "Fui uma competição…"). */
const CATEGORY_OPENING = /^(eu )?(sou|fui|era) (um|uma) (pessoa|ser humano|homem|mulher|lugar|local|localidade|coisa|objeto|animal|bicho|ser vivo|especie|personagem|evento|acontecimento|ano|data|competicao|fato|conflito|guerra|rebeliao|revolta|levante|cerco|batalha|festival|torneio|campeonato|marco|conspiracao|conjuracao|tragedia|catastrofe|desastre|crise|movimento)\b/;
const CATEGORY_OPENING_2 = /^aconteci (em|numa|num|em uma|em um|durante|durante uma|durante um) (um |uma )?(ano|data|partida|jogo|corrida|competicao|evento|seculo [a-z]+)\b/;

/** Dica que só diz o tipo de personagem ("Pertenço ao folclore brasileiro.", "Sou vilão de quadrinhos."). */
const ONLY_FOLKLORE = /^(eu )?(pertenco|perteco|venho|sou|fui|fa[cç]o parte) (ao|as|aos|a|da|das|do|dos|de) (folclore|lendas?|mitologia|historias? infantis|contos? de fadas)( [a-z]+){0,3}$/;
const ONLY_ROLE = /^(eu )?sou (um |uma )?(vilao|vila|heroi|heroina|mocinho|mocinha|protagonista) (de|da|das|do|dos|em) (historias?|quadrinhos|novelas?|filmes?|desenhos?|livros?|contos?)( [a-z]+){0,3}$/;

/** Dica que só diz o século ("Aconteci no século XX.") — vazia. */
const ONLY_CENTURY = /^(aconteci|ocorri|fui|existi) (no|em|durante o|no inicio do|no comeco do|no meio do|no fim do|no final do|na primeira metade do|na segunda metade do) seculo [a-z]+( (antes|depois) de cristo| ac| dc)?$/;

/**
 * Dica que só repete a categoria já escolhida ("Sou uma pessoa.", "Sou um lugar.", "Fui uma competição esportiva."…)
 * — o jogador já sabe disso porque escolheu a categoria.
 */
export function isGenericClue(clue: string): boolean {
  const n = normalize(clue);
  return GENERIC_CLUE.test(n) || CATEGORY_OPENING.test(n) || CATEGORY_OPENING_2.test(n) || ONLY_CENTURY.test(n) || ONLY_FOLKLORE.test(n) || ONLY_ROLE.test(n);
}

export function validateCard(card: Card): string[] {
  const errors: string[] = [];
  if (!card.category?.trim()) errors.push('Escolha uma categoria.');
  if (!card.answer?.trim()) errors.push('A resposta é obrigatória.');
  if (!DIFFICULTIES.includes(card.difficulty)) errors.push('Dificuldade inválida.');
  if (card.kind === 'perfil') {
    const clues = card.clues ?? [];
    if (clues.length !== PERFIL_MAX_CLUES) errors.push(`O perfil precisa ter exatamente ${PERFIL_MAX_CLUES} dicas (tem ${clues.length}).`);
    if (clues.some((c) => !c?.trim())) errors.push('Nenhuma dica pode ficar vazia.');
    clues.forEach((c, i) => {
      if (c?.trim() && isGenericClue(c)) errors.push(`A dica ${i + 1} ("${c.trim()}") só repete a categoria — o jogador já sabe disso. Use um fato real.`);
    });
  } else {
    if (!card.question?.trim()) errors.push('A pergunta é obrigatória.');
    const hints = card.hints ?? [];
    if (hints.length > TRIVIA_MAX_HINTS) errors.push(`No máximo ${TRIVIA_MAX_HINTS} dicas.`);
    if (hints.some((h) => !h?.trim())) errors.push('Nenhuma dica pode ficar vazia.');
    if (card.type === 'multipla') {
      const opts = card.options ?? [];
      if (opts.length !== 4) errors.push('Múltipla escolha precisa de 4 alternativas.');
      if (opts.some((o) => !o?.trim())) errors.push('Nenhuma alternativa pode ficar vazia.');
      if (new Set(opts.map(normalize)).size !== opts.length) errors.push('As alternativas não podem se repetir.');
      if (!opts.includes(card.answer)) errors.push('A resposta precisa ser uma das alternativas.');
    } else if (card.type !== 'aberta') {
      errors.push('Tipo de pergunta inválido.');
    }
  }
  return errors;
}

// ---------- duplicadas / normalização ----------

export function normalize(s: string): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Chave usada para detectar cartas duplicadas no import. */
export function cardKey(card: Card): string {
  return card.kind === 'perfil'
    ? `perfil|${normalize(card.answer)}`
    : `trivia|${normalize(card.question)}`;
}

/** Junta cartas novas às existentes ignorando duplicadas (inclusive dentro do próprio lote). */
export function mergeCards(existing: Card[], incoming: Card[]): { added: Card[]; skipped: number } {
  const keys = new Set(existing.map(cardKey));
  const added: Card[] = [];
  let skipped = 0;
  for (const c of incoming) {
    const k = cardKey(c);
    if (keys.has(k)) { skipped++; continue; }
    keys.add(k);
    added.push(c);
  }
  return { added, skipped };
}

/**
 * Atualiza um banco existente com um seed novo:
 * - perfis já existentes (mesma resposta) que ainda têm dicas genéricas recebem as dicas novas
 *   (cartas que o usuário já melhorou não são tocadas);
 * - cartas do seed que não existem no banco são adicionadas.
 */
export function syncWithSeed(
  existing: Card[],
  seedCards: Card[],
  retired: { perfil?: string[]; trivia?: string[] } = {},
): { updates: { id: number; changes: Partial<PerfilCard> }[]; adds: Card[]; removes: number[] } {
  // cartas de versões antigas do seed que foram reescritas/substituídas na revisão
  const seedKeys = new Set(seedCards.map(cardKey));
  const retiredKeys = new Set([
    ...(retired.perfil ?? []).map((a) => `perfil|${normalize(a)}`),
    ...(retired.trivia ?? []).map((q) => `trivia|${normalize(q)}`),
  ]);
  const removes = existing
    .filter((c) => c.id != null && retiredKeys.has(cardKey(c)) && !seedKeys.has(cardKey(c)))
    .map((c) => c.id!);
  const removed = new Set(removes);
  existing = existing.filter((c) => !removed.has(c.id!));
  const byKey = new Map(existing.map((c) => [cardKey(c), c]));
  const updates: { id: number; changes: Partial<PerfilCard> }[] = [];
  const adds: Card[] = [];
  for (const s of seedCards) {
    const cur = byKey.get(cardKey(s));
    if (!cur) { adds.push(s); byKey.set(cardKey(s), s); continue; }
    if (cur.kind === 'perfil' && s.kind === 'perfil' && cur.id != null && cur.clues.some(isGenericClue)) {
      updates.push({ id: cur.id, changes: { clues: s.clues, difficulty: s.difficulty } });
    }
  }
  return { updates, adds, removes };
}

/** Converte um arquivo de banco em cartas + categorias (com validação). */
export function parseBankFile(data: QuestionBankFile): { cards: Card[]; categories: Category[]; invalid: string[] } {
  const cards: Card[] = [];
  const invalid: string[] = [];
  const cats = new Map<string, Category>();
  const addCat = (kind: 'perfil' | 'trivia', name: string) => {
    if (name?.trim()) cats.set(`${kind}|${name}`, { kind, name });
  };
  data.categories?.perfil?.forEach((n) => addCat('perfil', n));
  data.categories?.trivia?.forEach((n) => addCat('trivia', n));
  (data.perfil ?? []).forEach((c, i) => {
    const card: PerfilCard = { kind: 'perfil', category: c.category, answer: c.answer, clues: c.clues, difficulty: c.difficulty ?? 'medio' };
    const e = validateCard(card);
    if (e.length) invalid.push(`Perfil #${i + 1} (${c.answer ?? '?'}): ${e.join(' ')}`);
    else { cards.push(card); addCat('perfil', card.category); }
  });
  (data.trivia ?? []).forEach((c, i) => {
    const card: TriviaCard = {
      kind: 'trivia', category: c.category, question: c.question, type: c.type,
      answer: c.answer, hints: c.hints ?? [], difficulty: c.difficulty ?? 'medio',
      ...(c.type === 'multipla' ? { options: c.options } : {}),
    };
    const e = validateCard(card);
    if (e.length) invalid.push(`Trivia #${i + 1} (${c.question?.slice(0, 40) ?? '?'}): ${e.join(' ')}`);
    else { cards.push(card); addCat('trivia', card.category); }
  });
  return { cards, categories: [...cats.values()], invalid };
}

export function toBankFile(cards: Card[], categories: Category[]): QuestionBankFile {
  const strip = <T extends Card>(c: T) => { const { id: _id, kind: _kind, ...rest } = c; return rest; };
  return {
    version: 1,
    categories: {
      perfil: categories.filter((c) => c.kind === 'perfil').map((c) => c.name),
      trivia: categories.filter((c) => c.kind === 'trivia').map((c) => c.name),
    },
    perfil: cards.filter((c): c is PerfilCard => c.kind === 'perfil').map(strip),
    trivia: cards.filter((c): c is TriviaCard => c.kind === 'trivia').map(strip),
  };
}

// ---------- conferência de palpite (perfil) ----------

export function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

const STOP = new Set(['o', 'a', 'os', 'as', 'um', 'uma', 'de', 'do', 'da', 'dos', 'das', 'e', 'the']);
const core = (s: string) => normalize(s).split(' ').filter((w) => !STOP.has(w)).join(' ');

/** Confere um palpite digitado com tolerância a acentos, artigos e pequenos erros de digitação. */
export function matchesAnswer(guess: string, answer: string): boolean {
  const g = core(guess);
  if (!g) return false;
  // aceita qualquer variante separada por "/" ou parênteses, ex.: "Rio de Janeiro (cidade)"
  const variants = [answer, ...answer.split(/[\/()]/)].map(core).filter(Boolean);
  return variants.some((a) => {
    if (a === g) return true;
    const tol = a.length >= 10 ? 2 : a.length >= 5 ? 1 : 0;
    if (levenshtein(a, g) <= tol) return true;
    // palpite parcial, mas substancial (ex.: "Pelé" para "Pelé (Edson Arantes)")
    return g.length >= 4 && a.includes(g) && g.length >= a.length * 0.6;
  });
}

// ---------- dicas de trivia ----------

export type TriviaHint = { kind: 'text'; text: string } | { kind: 'eliminate'; text: string; options: string[] };

/**
 * Monta até 3 dicas progressivas. Usa as dicas da carta e completa as que faltarem com
 * dicas automáticas (eliminar alternativas na múltipla escolha, letras na resposta aberta).
 */
export function buildTriviaHints(card: TriviaCard, rng: Rng): TriviaHint[] {
  const hints: TriviaHint[] = (card.hints ?? []).slice(0, TRIVIA_MAX_HINTS).map((text) => ({ kind: 'text', text }));
  if (hints.length >= TRIVIA_MAX_HINTS) return hints;
  if (card.type === 'multipla' && card.options) {
    const wrong = shuffle(rng, card.options.filter((o) => o !== card.answer));
    let eliminated = 0;
    while (hints.length < TRIVIA_MAX_HINTS && eliminated < 2) {
      const opt = wrong[eliminated++];
      hints.push({ kind: 'eliminate', text: `Não é "${opt}".`, options: [opt] });
    }
    if (hints.length < TRIVIA_MAX_HINTS) {
      hints.push({ kind: 'text', text: `A resposta começa com "${card.answer.trim()[0].toUpperCase()}".` });
    }
  } else {
    const ans = card.answer.trim();
    const auto = [
      `A resposta começa com a letra "${ans[0].toUpperCase()}".`,
      `A resposta tem ${ans.replace(/\s/g, '').length} letras/caracteres.`,
      `Começa com "${ans.slice(0, Math.max(2, Math.ceil(ans.length / 3)))}…".`,
    ];
    for (const text of auto) if (hints.length < TRIVIA_MAX_HINTS) hints.push({ kind: 'text', text });
  }
  return hints;
}

/**
 * Alternativas que o jogador ainda pode escolher na múltipla escolha:
 * tira as eliminadas pelas dicas reveladas e as que ele já errou.
 */
export function remainingOptions(card: TriviaCard, hints: TriviaHint[], used: number, wrong: string[]): string[] {
  if (card.type !== 'multipla' || !card.options) return [];
  const out = new Set([...eliminatedOptions(card, hints, used), ...wrong]);
  return card.options.filter((o) => !out.has(o));
}

/**
 * Regra: na múltipla escolha só vale acertar enquanto houver 2 ou mais alternativas disponíveis.
 * Se os erros (somados às eliminações das dicas) deixarem só 1 alternativa, a carta termina sem andar casas.
 */
export function multipleChoiceExhausted(card: TriviaCard, hints: TriviaHint[], used: number, wrong: string[]): boolean {
  return card.type === 'multipla' && wrong.length > 0 && remainingOptions(card, hints, used, wrong).length <= 1;
}

/** Opções eliminadas pelas dicas já reveladas. Também interpreta "Não é X nem Y." nas dicas de texto. */
export function eliminatedOptions(card: TriviaCard, hints: TriviaHint[], used: number): string[] {
  if (card.type !== 'multipla' || !card.options) return [];
  const out = new Set<string>();
  for (const h of hints.slice(0, used)) {
    if (h.kind === 'eliminate') h.options.forEach((o) => out.add(o));
    else if (/^não é/i.test(h.text.trim())) {
      for (const o of card.options) {
        if (o !== card.answer && normalize(h.text).includes(normalize(o))) out.add(o);
      }
    }
  }
  return [...out];
}
