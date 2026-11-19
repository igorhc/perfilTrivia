import { describe, expect, it } from 'vitest';
import seed from '../data/seed.json';
import { isGenericClue, parseBankFile, type QuestionBankFile } from './cards';

describe('seed.json', () => {
  const parsed = parseBankFile(seed as QuestionBankFile);
  const perfil = parsed.cards.filter((c) => c.kind === 'perfil');
  const trivia = parsed.cards.filter((c) => c.kind === 'trivia');

  it('todas as cartas passam na validação do jogo', () => {
    expect(parsed.invalid).toEqual([]);
  });
  it('tem pelo menos 400 perfis e 350 trivias', () => {
    expect(perfil.length).toBeGreaterThanOrEqual(400);
    expect(trivia.length).toBeGreaterThanOrEqual(350);
  });
  it('nenhuma dica de perfil só repete a categoria', () => {
    const bad = perfil.flatMap((c) => (c.kind === 'perfil' ? c.clues.filter(isGenericClue).map((cl) => `${c.answer}: ${cl}`) : []));
    expect(bad).toEqual([]);
  });
  it('todas as categorias têm cartas suficientes', () => {
    for (const cat of seed.categories.perfil) expect(perfil.filter((c) => c.category === cat).length).toBeGreaterThanOrEqual(50);
    for (const cat of seed.categories.trivia) expect(trivia.filter((c) => c.category === cat).length).toBeGreaterThanOrEqual(40);
  });
  it('sem duplicadas', () => {
    const keys = parsed.cards.map((c) => (c.kind === 'perfil' ? c.answer : c.question).toLowerCase());
    expect(new Set(keys).size).toBe(keys.length);
  });
});
