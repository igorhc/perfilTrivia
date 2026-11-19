import Dexie, { type Table } from 'dexie';
import type { Card, Category, QuestionBankFile } from '../logic/cards';
import { isGenericClue, mergeCards, parseBankFile, syncWithSeed } from '../logic/cards';
import seed from '../data/seed.json';

class BankDB extends Dexie {
  cards!: Table<Card, number>;
  categories!: Table<Category, number>;

  constructor() {
    super('perfil-trivia');
    const schema = {
      cards: '++id, kind, category, difficulty',
      categories: '++id, kind, [kind+name]',
    };
    this.version(1).stores(schema);
    this.version(2).stores(schema);
    // primeira execução: carrega o seed
    this.on('populate', async (tx) => {
      const { cards, categories } = parseBankFile(seed as QuestionBankFile);
      await tx.table('categories').bulkAdd(categories);
      await tx.table('cards').bulkAdd(cards);
    });
  }
}

export const db = new BankDB();

const SEED_VERSION_KEY = 'pt-seed-version';

/**
 * Roda a cada abertura do jogo. Se o seed mudou (versão nova) ou se ainda existe alguma carta
 * de perfil com dica genérica ("Sou uma pessoa."…), atualiza o banco com o seed atual:
 * cartas novas são adicionadas e perfis com dicas genéricas recebem as dicas novas.
 * Cartas criadas pelo usuário nunca são apagadas.
 */
export async function ensureSeedSynced(): Promise<{ updated: number; added: number } | null> {
  const seedVersion = Number((seed as QuestionBankFile).version ?? 1);
  let stored = 0;
  try { stored = Number(localStorage.getItem(SEED_VERSION_KEY) ?? 0); } catch { /* sem storage */ }
  const existing = await db.cards.toArray();
  const hasGeneric = existing.some((c) => c.kind === 'perfil' && c.clues.some(isGenericClue));
  if (stored >= seedVersion && !hasGeneric) return null;

  const { cards, categories } = parseBankFile(seed as QuestionBankFile);
  const result = await db.transaction('rw', db.cards, db.categories, async () => {
    const current = await db.cards.toArray();
    const { updates, adds, removes } = syncWithSeed(current, cards, (seed as QuestionBankFile).retired);
    await db.cards.bulkDelete(removes);
    for (const u of updates) await db.cards.update(u.id, u.changes);
    await db.cards.bulkAdd(adds);
    const cats = await db.categories.toArray();
    const have = new Set(cats.map((c) => `${c.kind}|${c.name}`));
    await db.categories.bulkAdd(categories.filter((c) => !have.has(`${c.kind}|${c.name}`)));
    return { updated: updates.length, added: adds.length };
  });
  try { localStorage.setItem(SEED_VERSION_KEY, String(seedVersion)); } catch { /* sem storage */ }
  return result;
}

export async function importBank(data: QuestionBankFile): Promise<{ added: number; skipped: number; invalid: string[]; newCategories: number }> {
  const parsed = parseBankFile(data);
  return db.transaction('rw', db.cards, db.categories, async () => {
    const existing = await db.cards.toArray();
    const { added, skipped } = mergeCards(existing, parsed.cards);
    await db.cards.bulkAdd(added);
    const cats = await db.categories.toArray();
    const have = new Set(cats.map((c) => `${c.kind}|${c.name}`));
    const newCats = parsed.categories.filter((c) => !have.has(`${c.kind}|${c.name}`));
    await db.categories.bulkAdd(newCats);
    return { added: added.length, skipped, invalid: parsed.invalid, newCategories: newCats.length };
  });
}

export async function resetToSeed(): Promise<void> {
  await db.transaction('rw', db.cards, db.categories, async () => {
    await db.cards.clear();
    await db.categories.clear();
    const { cards, categories } = parseBankFile(seed as QuestionBankFile);
    await db.categories.bulkAdd(categories);
    await db.cards.bulkAdd(cards);
  });
}
