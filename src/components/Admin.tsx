import { useEffect, useMemo, useRef, useState } from 'react';
import { db, importBank, resetToSeed } from '../db/db';
import {
  DIFFICULTIES, DIFFICULTY_LABEL, normalize, toBankFile, validateCard,
  type Card, type Category, type Difficulty, type PerfilCard, type TriviaCard,
} from '../logic/cards';

type Kind = 'perfil' | 'trivia';

function emptyCard(kind: Kind, category: string): Card {
  return kind === 'perfil'
    ? { kind, category, answer: '', clues: Array(10).fill(''), difficulty: 'medio' }
    : { kind, category, question: '', type: 'multipla', options: ['', '', '', ''], answer: '', hints: [], difficulty: 'medio' };
}

function CardEditor({ initial, categories, onSave, onCancel }: {
  initial: Card; categories: string[]; onSave: (c: Card) => Promise<void>; onCancel: () => void;
}) {
  const [c, setC] = useState<Card>(initial);
  const [errors, setErrors] = useState<string[]>([]);
  const save = async () => {
    const clean: Card = c.kind === 'perfil'
      ? { ...c, answer: c.answer.trim(), clues: c.clues.map((x) => x.trim()) }
      : {
          ...c, question: c.question.trim(), answer: c.answer.trim(), hints: c.hints.map((h) => h.trim()).filter(Boolean),
          options: c.type === 'multipla' ? (c.options ?? []).map((o) => o.trim()) : undefined,
        };
    const e = validateCard(clean);
    setErrors(e);
    if (!e.length) await onSave(clean);
  };
  const set = (patch: Partial<PerfilCard> | Partial<TriviaCard>) => setC({ ...c, ...patch } as Card);

  return (
    <div className="overlay">
      <div className="modal wide editor">
        <h2>{c.id ? 'Editar' : 'Nova'} carta de {c.kind === 'perfil' ? 'Perfil' : 'Trivia'}</h2>
        <div className="form-row">
          <label>Categoria
            <select value={c.category} onChange={(e) => set({ category: e.target.value })}>
              {categories.map((n) => <option key={n}>{n}</option>)}
            </select>
          </label>
          <label>Dificuldade
            <select value={c.difficulty} onChange={(e) => set({ difficulty: e.target.value as Difficulty })}>
              {DIFFICULTIES.map((d) => <option key={d} value={d}>{DIFFICULTY_LABEL[d]}</option>)}
            </select>
          </label>
          {c.kind === 'trivia' && (
            <label>Tipo
              <select value={c.type} onChange={(e) => set({ type: e.target.value as 'multipla' | 'aberta', options: e.target.value === 'multipla' ? (c.options?.length === 4 ? c.options : ['', '', '', '']) : undefined })}>
                <option value="multipla">Múltipla escolha</option>
                <option value="aberta">Resposta aberta</option>
              </select>
            </label>
          )}
        </div>
        {c.kind === 'perfil' ? (
          <>
            <label>Resposta<input value={c.answer} onChange={(e) => set({ answer: e.target.value })} /></label>
            <p className="muted">10 dicas, da mais difícil (1) para a mais fácil (10):</p>
            <ol className="clue-inputs">
              {c.clues.map((cl, i) => (
                <li key={i}><input value={cl} onChange={(e) => { const clues = c.clues.slice(); clues[i] = e.target.value; set({ clues }); }} /></li>
              ))}
            </ol>
          </>
        ) : (
          <>
            <label>Pergunta<textarea rows={2} value={c.question} onChange={(e) => set({ question: e.target.value })} /></label>
            {c.type === 'multipla' ? (
              <div className="options-edit">
                <p className="muted">Alternativas (marque a correta):</p>
                {(c.options ?? []).map((o, i) => (
                  <div key={i} className="option-edit">
                    <input type="radio" name="correct" checked={o !== '' && o === c.answer} onChange={() => set({ answer: o })} />
                    <input value={o} placeholder={`Alternativa ${'ABCD'[i]}`} onChange={(e) => {
                      const options = (c.options ?? []).slice();
                      // só acompanha a resposta se esta alternativa já era a marcada (vazia nunca conta)
                      const wasAnswer = c.answer !== '' && options[i] === c.answer;
                      options[i] = e.target.value;
                      set({ options, ...(wasAnswer ? { answer: e.target.value } : {}) });
                    }} />
                  </div>
                ))}
              </div>
            ) : (
              <label>Resposta<input value={c.answer} onChange={(e) => set({ answer: e.target.value })} /></label>
            )}
            <p className="muted">Até 3 dicas progressivas (vazias são ignoradas; se faltar, o jogo gera dicas automáticas):</p>
            {[0, 1, 2].map((i) => (
              <input key={i} className="hint-input" value={c.hints[i] ?? ''} placeholder={`Dica ${i + 1}`}
                onChange={(e) => { const hints = [0, 1, 2].map((k) => c.hints[k] ?? ''); hints[i] = e.target.value; set({ hints }); }} />
            ))}
          </>
        )}
        {errors.map((e) => <p key={e} className="error">{e}</p>)}
        <div className="row end">
          <button className="btn" onClick={onCancel}>Cancelar</button>
          <button className="btn primary" onClick={save}>Salvar</button>
        </div>
      </div>
    </div>
  );
}

function CategoriesTab({ categories, cards, reload }: { categories: Category[]; cards: Card[]; reload: () => void }) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<Kind>('perfil');
  const add = async () => {
    const n = name.trim();
    if (!n || categories.some((c) => c.kind === kind && normalize(c.name) === normalize(n))) return;
    await db.categories.add({ kind, name: n });
    setName('');
    reload();
  };
  const rename = async (cat: Category) => {
    const n = prompt('Novo nome da categoria:', cat.name)?.trim();
    if (!n || n === cat.name) return;
    await db.transaction('rw', db.cards, db.categories, async () => {
      await db.categories.update(cat.id!, { name: n });
      await db.cards.where({ kind: cat.kind, category: cat.name }).modify({ category: n });
    });
    reload();
  };
  const remove = async (cat: Category) => {
    const count = cards.filter((c) => c.kind === cat.kind && c.category === cat.name).length;
    if (count > 0 && !confirm(`A categoria "${cat.name}" tem ${count} cartas. Apagar a categoria e TODAS essas cartas?`)) return;
    await db.transaction('rw', db.cards, db.categories, async () => {
      await db.cards.where({ kind: cat.kind, category: cat.name }).delete();
      await db.categories.delete(cat.id!);
    });
    reload();
  };
  return (
    <div className="categories-tab">
      {(['perfil', 'trivia'] as Kind[]).map((k) => (
        <section key={k} className="panel">
          <h3>{k === 'perfil' ? 'Perfil' : 'Trivia'}</h3>
          <ul className="cat-list">
            {categories.filter((c) => c.kind === k).map((c) => (
              <li key={c.id}>
                <span>{c.name} <small className="muted">({cards.filter((x) => x.kind === k && x.category === c.name).length})</small></span>
                <span>
                  <button className="btn small" onClick={() => rename(c)}>Renomear</button>
                  <button className="btn small danger" onClick={() => remove(c)}>Apagar</button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <div className="row">
        <select value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
          <option value="perfil">Perfil</option><option value="trivia">Trivia</option>
        </select>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nova categoria" onKeyDown={(e) => e.key === 'Enter' && add()} />
        <button className="btn primary" onClick={add}>Adicionar</button>
      </div>
    </div>
  );
}

export default function Admin({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<Kind | 'categorias'>('perfil');
  const [cards, setCards] = useState<Card[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filterCat, setFilterCat] = useState('');
  const [filterDiff, setFilterDiff] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Card | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reload = () => Promise.all([db.cards.toArray(), db.categories.toArray()]).then(([c, cats]) => { setCards(c); setCategories(cats); });
  useEffect(() => { reload(); }, []);

  const kind = tab === 'categorias' ? 'perfil' : tab;
  const catNames = categories.filter((c) => c.kind === kind).map((c) => c.name);
  const list = useMemo(() => {
    const q = normalize(search);
    return cards.filter((c) => c.kind === kind
      && (!filterCat || c.category === filterCat)
      && (!filterDiff || c.difficulty === filterDiff)
      && (!q || normalize(c.kind === 'perfil' ? `${c.answer} ${c.clues.join(' ')}` : `${c.question} ${c.answer}`).includes(q)));
  }, [cards, kind, filterCat, filterDiff, search]);

  const saveCard = async (c: Card) => {
    if (c.id) await db.cards.put(c); else await db.cards.add(c);
    setEditing(null);
    await reload();
  };
  const deleteCard = async (c: Card) => {
    if (!confirm('Apagar esta carta?')) return;
    await db.cards.delete(c.id!);
    reload();
  };
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(toBankFile(cards, categories), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `perfil-trivia-banco-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const importJson = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      const r = await importBank(data);
      setMessage(`Importação: ${r.added} cartas novas, ${r.skipped} duplicadas ignoradas, ${r.newCategories} categorias novas${r.invalid.length ? `, ${r.invalid.length} inválidas:\n• ${r.invalid.slice(0, 8).join('\n• ')}` : '.'}`);
      reload();
    } catch (e) {
      setMessage(`Arquivo inválido: ${(e as Error).message}`);
    }
  };
  const reset = async () => {
    if (!confirm('Restaurar o banco original? Todas as cartas e categorias criadas/alteradas serão perdidas.')) return;
    await resetToSeed();
    setMessage('Banco restaurado para o seed original.');
    reload();
  };

  return (
    <div className="admin screen">
      <header className="screen-header">
        <button className="btn ghost" onClick={onBack}>← Menu</button>
        <h1>Banco de perguntas</h1>
        <div className="row">
          <button className="btn" onClick={() => fileRef.current?.click()}>⬆ Importar JSON</button>
          <button className="btn" onClick={exportJson}>⬇ Exportar JSON</button>
          <button className="btn ghost" onClick={reset}>↺ Restaurar original</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importJson(f); e.target.value = ''; }} />
        </div>
      </header>
      {message && <pre className="message" onClick={() => setMessage(null)}>{message}</pre>}
      <nav className="tabs">
        {(['perfil', 'trivia', 'categorias'] as const).map((t) => (
          <button key={t} className={tab === t ? 'active' : ''} onClick={() => { setTab(t); setFilterCat(''); }}>
            {t === 'perfil' ? `Perfil (${cards.filter((c) => c.kind === 'perfil').length})` : t === 'trivia' ? `Trivia (${cards.filter((c) => c.kind === 'trivia').length})` : 'Categorias'}
          </button>
        ))}
      </nav>
      {tab === 'categorias' ? (
        <CategoriesTab categories={categories} cards={cards} reload={reload} />
      ) : (
        <>
          <div className="filters row">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar…" />
            <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
              <option value="">Todas as categorias</option>
              {catNames.map((n) => <option key={n}>{n}</option>)}
            </select>
            <select value={filterDiff} onChange={(e) => setFilterDiff(e.target.value)}>
              <option value="">Todas as dificuldades</option>
              {DIFFICULTIES.map((d) => <option key={d} value={d}>{DIFFICULTY_LABEL[d]}</option>)}
            </select>
            <button className="btn primary" disabled={!catNames.length} onClick={() => setEditing(emptyCard(kind, filterCat || catNames[0]))}>+ Nova carta</button>
          </div>
          <table className="card-table">
            <thead>
              <tr><th>Categoria</th><th>{kind === 'perfil' ? 'Resposta' : 'Pergunta'}</th>{kind === 'trivia' && <th>Tipo</th>}<th>Dificuldade</th><th /></tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id}>
                  <td>{c.category}</td>
                  <td>{c.kind === 'perfil' ? <b>{c.answer}</b> : <>{c.question} <small className="muted">→ {c.answer}</small></>}</td>
                  {c.kind === 'trivia' && <td>{c.type === 'multipla' ? 'Múltipla' : 'Aberta'}</td>}
                  <td>{DIFFICULTY_LABEL[c.difficulty]}</td>
                  <td className="nowrap">
                    <button className="btn small" onClick={() => setEditing(c)}>Editar</button>
                    <button className="btn small danger" onClick={() => deleteCard(c)}>Apagar</button>
                  </td>
                </tr>
              ))}
              {!list.length && <tr><td colSpan={5} className="muted center-text">Nenhuma carta encontrada.</td></tr>}
            </tbody>
          </table>
        </>
      )}
      {editing && (
        <CardEditor initial={editing} categories={categories.filter((c) => c.kind === editing.kind).map((c) => c.name)}
          onSave={saveCard} onCancel={() => setEditing(null)} />
      )}
    </div>
  );
}
