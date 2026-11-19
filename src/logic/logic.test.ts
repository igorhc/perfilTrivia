import { describe, expect, it } from 'vitest';
import {
  generateBoard, LAYOUTS, MAX_CELLS, MIN_CELLS, minNonAdjacentDistance, pathSelfIntersects,
  placeSpecials, randomGridPath, SPECIAL_MARGIN, THEMES, UNIT,
} from './board';
import { createRng } from './rng';
import { drawType, fillBag, type CardType } from './typeBag';
import { perfilSteps, triviaSteps, perfilTable } from './scoring';
import { nextTurn, pinOffsets, ranking, resolveMove, type PlayerState } from './game';
import {
  buildTriviaHints, eliminatedOptions, isGenericClue, multipleChoiceExhausted, remainingOptions, matchesAnswer, mergeCards, parseBankFile, syncWithSeed, validateCard,
  type PerfilCard, type TriviaCard,
} from './cards';

describe('scoring', () => {
  it('perfil: anda 11 − N casas', () => {
    expect(perfilSteps(1, true)).toBe(10);
    expect(perfilSteps(5, true)).toBe(6);
    expect(perfilSteps(10, true)).toBe(1);
    expect(perfilSteps(10, false)).toBe(0);
    expect(perfilTable()).toHaveLength(10);
    expect(() => perfilSteps(0, true)).toThrow();
    expect(() => perfilSteps(11, true)).toThrow();
  });
  it('trivia: 6/4/2/1 e 0 se errar', () => {
    expect([0, 1, 2, 3].map((h) => triviaSteps(h, true))).toEqual([6, 4, 2, 1]);
    expect(triviaSteps(0, false)).toBe(0);
    expect(() => triviaSteps(4, true)).toThrow();
  });
});

describe('saco de tipos', () => {
  it('mantém 50/50 exato a cada reabastecimento', () => {
    const rng = createRng('saco');
    let bag = fillBag(rng, 3);
    const drawn: CardType[] = [];
    for (let i = 0; i < 60; i++) {
      const r = drawType(bag, rng);
      drawn.push(r.type);
      bag = r.bag;
    }
    for (let i = 0; i < 60; i += 6) {
      const chunk = drawn.slice(i, i + 6);
      expect(chunk.filter((t) => t === 'perfil')).toHaveLength(3);
    }
  });
  it('não muta o saco original e reabastece quando vazio', () => {
    const rng = createRng('x');
    const bag = { remaining: [] as CardType[], perType: 2 };
    const r = drawType(bag, rng);
    expect(bag.remaining).toHaveLength(0);
    expect(r.bag.remaining).toHaveLength(3);
  });
});

describe('gerador de tabuleiro', () => {
  const seeds = Array.from({ length: 25 }, (_, i) => `seed-${i}`);

  it('é determinístico pela seed', () => {
    const a = generateBoard('tucano-123');
    const b = generateBoard('tucano-123');
    expect(a.cells).toEqual(b.cells);
    expect(a.theme).toBe(b.theme);
  });

  it.each(LAYOUTS)('layout %s: 120–140 casas, sem sobreposição nem cruzamento', (layout) => {
    for (const seed of seeds) {
      const b = generateBoard(seed, { layout });
      expect(b.total).toBeGreaterThanOrEqual(MIN_CELLS);
      expect(b.total).toBeLessThanOrEqual(MAX_CELLS);
      expect(b.cells).toHaveLength(b.total);
      const units = b.cells.map((c) => ({ x: c.x / UNIT, y: c.y / UNIT }));
      expect(minNonAdjacentDistance(units)).toBeGreaterThanOrEqual(0.8);
      expect(pathSelfIntersects(units)).toBe(false);
    }
  });

  it('casas especiais: ~10%, nunca seguidas nem nas pontas', () => {
    for (const seed of seeds) {
      const b = generateBoard(seed);
      const idx = b.cells.filter((c) => c.special).map((c) => c.index);
      expect(idx.length).toBe(Math.round(b.total * 0.1));
      for (let i = 1; i < idx.length; i++) expect(idx[i] - idx[i - 1]).toBeGreaterThan(1);
      expect(Math.min(...idx)).toBeGreaterThan(SPECIAL_MARGIN);
      expect(Math.max(...idx)).toBeLessThan(b.total - 1 - SPECIAL_MARGIN);
    }
  });

  it('placeSpecials usa os 5 tipos', () => {
    const kinds = new Set(placeSpecials(createRng('k'), 130).values());
    expect(kinds.size).toBe(5);
  });

  it('sorteia vários temas e layouts', () => {
    const themes = new Set(seeds.map((s) => generateBoard(s).theme));
    const layouts = new Set(seeds.map((s) => generateBoard(s).layout));
    expect(themes.size).toBeGreaterThan(2);
    expect(layouts.size).toBeGreaterThan(2);
    expect(THEMES.length).toBeGreaterThanOrEqual(5);
  });

  it('caminho em grade visita cada célula uma vez com passos unitários', () => {
    const p = randomGridPath(createRng('g'), 8, 5, 2000);
    expect(new Set(p.map((q) => `${q.x},${q.y}`)).size).toBe(40);
    for (let i = 1; i < p.length; i++) expect(Math.abs(p[i].x - p[i - 1].x) + Math.abs(p[i].y - p[i - 1].y)).toBe(1);
    expect(p[0]).toEqual({ x: 0, y: 0 });
  });
});

describe('movimento', () => {
  const specials = new Map([[10, 'avance3'], [20, 'volte3'], [30, 'perdeVez'], [40, 'jogueNovamente'], [50, 'escolhaLivre'], [13, 'volte3']] as const);
  it('anda casa a casa', () => {
    const r = resolveMove(0, 4, 130, specials);
    expect(r.path).toEqual([1, 2, 3, 4]);
    expect(r.finalPosition).toBe(4);
  });
  it('avance 3 não encadeia efeitos', () => {
    const r = resolveMove(5, 5, 130, specials);
    expect(r.special).toBe('avance3');
    expect(r.specialPath).toEqual([11, 12, 13]);
    expect(r.finalPosition).toBe(13); // casa 13 é "volte 3" mas não é aplicada
  });
  it('volte 3', () => {
    expect(resolveMove(18, 2, 130, specials).finalPosition).toBe(17);
  });
  it('perca a vez / jogue de novo / escolha livre', () => {
    expect(resolveMove(25, 5, 130, specials).skipNext).toBe(true);
    expect(resolveMove(39, 1, 130, specials).extraTurn).toBe(true);
    expect(resolveMove(44, 6, 130, specials).freeChoice).toBe(true);
  });
  it('0 casas não ativa a casa atual', () => {
    const r = resolveMove(30, 0, 130, specials);
    expect(r.special).toBeUndefined();
    expect(r.path).toEqual([]);
  });
  it('vence sem precisar cair exatamente na chegada', () => {
    const r = resolveMove(125, 10, 130, specials);
    expect(r.won).toBe(true);
    expect(r.finalPosition).toBe(129);
  });
});

describe('turnos', () => {
  const mk = (name: string, position = 0, skipNext = false): PlayerState => ({ id: name, name, color: '#000', position, skipNext, freeChoice: false });
  it('passa para o próximo e dá a volta', () => {
    const ps = [mk('A'), mk('B'), mk('C')];
    expect(nextTurn(ps, 0, false).index).toBe(1);
    expect(nextTurn(ps, 2, false).index).toBe(0);
  });
  it('jogue de novo mantém o jogador', () => {
    expect(nextTurn([mk('A'), mk('B')], 1, true).index).toBe(1);
  });
  it('pula quem perdeu a vez uma única vez', () => {
    const r = nextTurn([mk('A'), mk('B', 0, true), mk('C')], 0, false);
    expect(r.index).toBe(2);
    expect(r.skipped).toEqual(['B']);
    expect(r.players[1].skipNext).toBe(false);
  });
  it('ranking por posição', () => {
    expect(ranking([mk('A', 3), mk('B', 9), mk('C', 3)]).map((p) => p.name)).toEqual(['B', 'A', 'C']);
  });
  it('pinos lado a lado não se sobrepõem', () => {
    for (let n = 1; n <= 8; n++) {
      const o = pinOffsets(n, 10);
      expect(new Set(o.map((q) => `${q.dx},${q.dy}`)).size).toBe(n);
    }
  });
});

describe('cartas', () => {
  const perfil: PerfilCard = { kind: 'perfil', category: 'Pessoa', answer: 'Pelé', clues: Array(10).fill('dica'), difficulty: 'facil' };
  const multi: TriviaCard = {
    kind: 'trivia', category: 'Geografia', question: 'Capital da Austrália?', type: 'multipla',
    options: ['Sydney', 'Canberra', 'Melbourne', 'Perth'], answer: 'Canberra', hints: [], difficulty: 'medio',
  };
  it('perfil precisa de exatamente 10 dicas', () => {
    expect(validateCard(perfil)).toEqual([]);
    expect(validateCard({ ...perfil, clues: Array(9).fill('x') }).length).toBeGreaterThan(0);
  });
  it('rejeita dicas que só repetem a categoria', () => {
    expect(isGenericClue('Sou uma pessoa.')).toBe(true);
    expect(isGenericClue('Sou um homem')).toBe(true);
    expect(isGenericClue('Sou um lugar famoso.')).toBe(true);
    expect(isGenericClue('Sou um evento histórico.')).toBe(true);
    expect(isGenericClue('Passei boa parte da vida longe do país onde nasci.')).toBe(false);
    expect(isGenericClue('Sou um animal que dorme 20 horas por dia.')).toBe(true);
    expect(isGenericClue('Fui uma competição esportiva no século XX.')).toBe(true);
    expect(isGenericClue('Fui um evento cultural que escandalizou parte do público.')).toBe(true);
    expect(isGenericClue('Aconteci numa partida de futebol.')).toBe(true);
    expect(isGenericClue('Durmo até 20 horas por dia.')).toBe(false);
    expect(isGenericClue('Sou o animal mais alto do mundo.')).toBe(false);
    expect(isGenericClue('Sou um vulcão adormecido.')).toBe(false);
    const bad = { ...perfil, clues: ['Sou um personagem.', ...Array(9).fill('dica')] };
    expect(validateCard(bad).some((e) => /só repete a categoria/.test(e))).toBe(true);
  });
  it('sincroniza com seed novo sem apagar cartas do usuário', () => {
    const old: PerfilCard = { ...perfil, id: 1, clues: ['Sou um homem.', ...Array(9).fill('x')] };
    const mine: PerfilCard = { ...perfil, id: 2, answer: 'Minha carta', clues: Array(10).fill('boa dica') };
    const edited: PerfilCard = { ...perfil, id: 3, answer: 'Senna', clues: Array(10).fill('dica melhorada') };
    const seedCards: PerfilCard[] = [
      { ...perfil, answer: 'pelé', clues: Array(10).fill('nova') },
      { ...perfil, answer: 'Senna', clues: Array(10).fill('nova') },
      { ...perfil, answer: 'Zico', clues: Array(10).fill('nova') },
    ];
    const r = syncWithSeed([old, mine, edited], seedCards);
    expect(r.updates).toEqual([{ id: 1, changes: { clues: Array(10).fill('nova'), difficulty: 'facil' } }]);
    expect(r.adds.map((c) => (c as PerfilCard).answer)).toEqual(['Zico']);
    expect(r.removes).toEqual([]);
  });
  it('remove cartas aposentadas do seed antigo, mas não as do usuário', () => {
    const oldQ: TriviaCard = { ...multi, id: 7, question: 'Qual é o menor continente?' };
    const userQ: TriviaCard = { ...multi, id: 8, question: 'Pergunta minha' };
    const r = syncWithSeed([oldQ, userQ], [multi], { trivia: ['Qual é o menor continente?'] });
    expect(r.removes).toEqual([7]);
    expect(r.adds).toHaveLength(1);
  });
  it('múltipla escolha precisa ter a resposta entre as alternativas', () => {
    expect(validateCard(multi)).toEqual([]);
    expect(validateCard({ ...multi, answer: 'Brasília' }).length).toBeGreaterThan(0);
  });
  it('merge ignora duplicadas (acentos e caixa)', () => {
    const r = mergeCards([perfil], [{ ...perfil, answer: 'pele' }, { ...perfil, answer: 'Senna' }, { ...perfil, answer: 'SENNA' }]);
    expect(r.added).toHaveLength(1);
    expect(r.skipped).toBe(2);
  });
  it('parseBankFile separa inválidas', () => {
    const r = parseBankFile({ perfil: [{ category: 'Pessoa', answer: 'X', clues: ['a'], difficulty: 'facil' }], trivia: [multi] });
    expect(r.cards).toHaveLength(1);
    expect(r.invalid).toHaveLength(1);
  });
  it('confere palpites com tolerância', () => {
    expect(matchesAnswer('pele', 'Pelé')).toBe(true);
    expect(matchesAnswer('torre eifel', 'Torre Eiffel')).toBe(true);
    expect(matchesAnswer('o rio de janeiro', 'Rio de Janeiro')).toBe(true);
    expect(matchesAnswer('paris', 'Roma')).toBe(false);
  });
  it('múltipla: só vale acertar com 2 ou mais alternativas disponíveis', () => {
    const card: TriviaCard = { ...multi, hints: ['contexto', 'mais contexto', 'Não é Sydney nem Perth.'] };
    const hints = buildTriviaHints(card, createRng('x'));
    // sem erros, mesmo com a dica 3 eliminando 2 opções, sobram 2: ainda vale
    expect(remainingOptions(card, hints, 3, [])).toEqual(['Canberra', 'Melbourne']);
    expect(multipleChoiceExhausted(card, hints, 3, [])).toBe(false);
    // errou 2 alternativas: sobram 2 → ainda pode acertar
    expect(multipleChoiceExhausted(card, hints, 2, ['Sydney', 'Melbourne'])).toBe(false);
    // errou 3 alternativas: sobra só a certa → acabou, não anda
    expect(remainingOptions(card, hints, 2, ['Sydney', 'Melbourne', 'Perth'])).toEqual(['Canberra']);
    expect(multipleChoiceExhausted(card, hints, 2, ['Sydney', 'Melbourne', 'Perth'])).toBe(true);
    // errou 1 e a dica 3 eliminou as outras 2 → sobra 1 → acabou
    expect(multipleChoiceExhausted(card, hints, 3, ['Melbourne'])).toBe(true);
    // aberta nunca se esgota por alternativas
    expect(multipleChoiceExhausted({ ...card, type: 'aberta', options: undefined }, hints, 3, ['x'])).toBe(false);
  });
  it('completa dicas de trivia e elimina alternativas', () => {
    const hints = buildTriviaHints(multi, createRng('h'));
    expect(hints).toHaveLength(3);
    const elim = eliminatedOptions(multi, hints, 2);
    expect(elim).toHaveLength(2);
    expect(elim).not.toContain('Canberra');
    const textElim = eliminatedOptions({ ...multi, hints: ['Não é Sydney nem Perth.'] }, [{ kind: 'text', text: 'Não é Sydney nem Perth.' }], 1);
    expect(textElim.sort()).toEqual(['Perth', 'Sydney']);
  });
});
