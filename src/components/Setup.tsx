import { useMemo, useState } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { generateBoard } from '../logic/board';
import { randomSeed, shuffle } from '../logic/rng';
import BoardView from './BoardView';
import { THEME_STYLES } from './themes';

export interface SetupPlayer { id: string; name: string; color: string }

const PALETTE = ['#e63946', '#1d7bd8', '#2a9d8f', '#f4a261', '#8e44ad', '#f1c40f', '#ff6fb5', '#34495e', '#27ae60', '#d35400', '#00bcd4', '#795548'];
const LAYOUT_NAMES: Record<string, string> = { serpente: 'Serpente', colunas: 'Colunas', sinuoso: 'Trilha sinuosa', espiral: 'Espiral', ilhas: 'Ilhas e pontes' };

let nextId = 1;
const newId = () => `p${Date.now().toString(36)}${nextId++}`;

function SortableRow({ p, index, players, onChange, onRemove, canRemove }: {
  p: SetupPlayer; index: number; players: SetupPlayer[];
  onChange: (p: SetupPlayer) => void; onRemove: () => void; canRemove: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: p.id });
  const [colorError, setColorError] = useState(false);
  const taken = new Set(players.filter((o) => o.id !== p.id).map((o) => o.color.toLowerCase()));
  const setColor = (color: string) => {
    if (taken.has(color.toLowerCase())) { setColorError(true); return; }
    setColorError(false);
    onChange({ ...p, color });
  };
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`player-row ${isDragging ? 'dragging' : ''}`}>
      <button className="drag-handle" {...attributes} {...listeners} aria-label="Arrastar para reordenar" title="Arraste para mudar a ordem">⠿</button>
      <span className="order-badge">{index + 1}º</span>
      <input className="name-input" value={p.name} maxLength={16} placeholder={`Jogador ${index + 1}`}
        onChange={(e) => onChange({ ...p, name: e.target.value })} />
      <div className="swatches">
        {PALETTE.map((c) => (
          <button key={c} className={`swatch ${p.color === c ? 'sel' : ''}`} style={{ background: c }} disabled={taken.has(c)}
            onClick={() => setColor(c)} aria-label={`Cor ${c}`} />
        ))}
        <input type="color" value={p.color} onChange={(e) => setColor(e.target.value)} title="Outra cor" />
      </div>
      {colorError && <span className="error small">Cor já usada</span>}
      <button className="icon-btn" onClick={onRemove} disabled={!canRemove} aria-label="Remover">✕</button>
    </li>
  );
}

export default function Setup({ onStart, onBack }: { onStart: (players: SetupPlayer[], seed: string) => void; onBack: () => void }) {
  const [players, setPlayers] = useState<SetupPlayer[]>(() => [
    { id: newId(), name: '', color: PALETTE[0] },
    { id: newId(), name: '', color: PALETTE[1] },
  ]);
  const [seed, setSeed] = useState<string | null>(null);
  const [seedInput, setSeedInput] = useState('');
  const board = useMemo(() => (seed ? generateBoard(seed) : null), [seed]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    setPlayers((ps) => arrayMove(ps, ps.findIndex((p) => p.id === e.active.id), ps.findIndex((p) => p.id === e.over!.id)));
  };
  const addPlayer = () => {
    const used = new Set(players.map((p) => p.color));
    setPlayers([...players, { id: newId(), name: '', color: PALETTE.find((c) => !used.has(c)) ?? '#000000' }]);
  };

  const names = players.map((p) => p.name.trim());
  const errors: string[] = [];
  if (names.some((n) => !n)) errors.push('Dê um nome a todos os participantes.');
  if (new Set(names.map((n) => n.toLowerCase())).size !== names.length) errors.push('Os nomes não podem se repetir.');
  if (new Set(players.map((p) => p.color.toLowerCase())).size !== players.length) errors.push('As cores não podem se repetir.');

  return (
    <div className="setup screen">
      <header className="screen-header">
        <button className="btn ghost" onClick={onBack}>← Menu</button>
        <h1>Nova partida</h1>
      </header>
      <div className="setup-grid">
        <section className="panel">
          <h2>Participantes <small>({players.length}/8)</small></h2>
          <p className="muted">Arraste para seguir a ordem de quem está sentado à mesa.</p>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={players.map((p) => p.id)} strategy={verticalListSortingStrategy}>
              <ul className="player-list">
                {players.map((p, i) => (
                  <SortableRow key={p.id} p={p} index={i} players={players} canRemove={players.length > 2}
                    onChange={(np) => setPlayers(players.map((o) => (o.id === p.id ? np : o)))}
                    onRemove={() => setPlayers(players.filter((o) => o.id !== p.id))} />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
          <div className="row">
            <button className="btn" onClick={addPlayer} disabled={players.length >= 8}>+ Adicionar</button>
            <button className="btn" onClick={() => setPlayers(shuffle(Math.random, players))}>🔀 Embaralhar ordem</button>
          </div>
          {errors.map((e) => <p key={e} className="error">{e}</p>)}
        </section>

        <section className="panel">
          <h2>Tabuleiro</h2>
          {board ? (
            <>
              <div className="preview"><BoardView board={board} pins={players.map((p) => ({ ...p, cell: 0 }))} /></div>
              <p className="board-meta">
                <b>{board.total}</b> casas · {LAYOUT_NAMES[board.layout]} · tema {THEME_STYLES[board.theme].name} · seed <code>{board.seed}</code>
              </p>
              <div className="row">
                <button className="btn" onClick={() => setSeed(randomSeed())}>🎲 Gerar outro</button>
                <button className="btn primary big" disabled={errors.length > 0}
                  onClick={() => onStart(players.map((p) => ({ ...p, name: p.name.trim() })), board.seed)}>
                  ▶ Iniciar partida
                </button>
              </div>
            </>
          ) : (
            <button className="btn primary big" onClick={() => setSeed(randomSeed())}>🗺️ Gerar tabuleiro</button>
          )}
          <form className="row seed-form" onSubmit={(e) => { e.preventDefault(); if (seedInput.trim()) setSeed(seedInput.trim()); }}>
            <input value={seedInput} onChange={(e) => setSeedInput(e.target.value)} placeholder="Repetir uma seed (ex.: tucano-482)" />
            <button className="btn" type="submit">Usar seed</button>
          </form>
        </section>
      </div>
    </div>
  );
}
