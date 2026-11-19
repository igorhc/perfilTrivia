import { useEffect, useMemo, useRef, useState } from 'react';
import { db } from '../db/db';
import { generateBoard, type SpecialKind } from '../logic/board';
import type { Card, Category, PerfilCard, TriviaCard } from '../logic/cards';
import { nextTurn, ranking, resolveMove } from '../logic/game';
import { perfilSteps, perfilTable, triviaSteps, triviaTable } from '../logic/scoring';
import { drawType, type CardType } from '../logic/typeBag';
import { availableByCategory, drawCard, newTurn, saveGame, type GameState } from '../gameState';
import { isSoundOn, setSoundOn, sfx } from '../sound';
import BoardView from './BoardView';
import { PerfilPanel, TriviaPanel } from './CardPanels';
import { SPECIAL_INFO } from './themes';

const TYPE_LABEL: Record<CardType, string> = { perfil: 'PERFIL', trivia: 'TRIVIA' };

function Roulette({ type, onDone }: { type: CardType; onDone: () => void }) {
  const [shown, setShown] = useState<CardType>('perfil');
  const [done, setDone] = useState(false);
  useEffect(() => {
    // desacelera alternando entre os tipos e para no sorteado
    const delays: number[] = [];
    let d = 60;
    while (d < 320) { delays.push(d); d *= 1.18; }
    if ((delays.length % 2 === 0) !== (type === 'perfil')) delays.push(d);
    const timers: number[] = [];
    let acc = 0;
    delays.forEach((ms, i) => {
      acc += ms;
      timers.push(window.setTimeout(() => { setShown(i % 2 === 0 ? 'trivia' : 'perfil'); sfx.tick(); }, acc));
    });
    timers.push(window.setTimeout(() => { setShown(type); setDone(true); sfx.reveal(); }, acc + 30));
    timers.push(window.setTimeout(onDone, acc + 1100));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="roulette">
      <div className={`roulette-card ${shown} ${done ? 'done' : ''}`}>{TYPE_LABEL[shown]}</div>
      <p className="muted">{done ? 'Escolha a categoria…' : 'Sorteando o tipo da carta…'}</p>
    </div>
  );
}

function StepsTable({ highlight }: { highlight?: { type: CardType; n: number } }) {
  return (
    <div className="steps-table">
      <h3>Dicas → casas</h3>
      <div className="tables">
        <table>
          <thead><tr><th colSpan={2}>Perfil</th></tr></thead>
          <tbody>
            {perfilTable().map((r) => (
              <tr key={r.clues} className={highlight?.type === 'perfil' && highlight.n === r.clues ? 'hl' : ''}>
                <td>{r.clues} {r.clues === 1 ? 'dica' : 'dicas'}</td><td>{r.steps}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <table>
          <thead><tr><th colSpan={2}>Trivia</th></tr></thead>
          <tbody>
            {triviaTable().map((r) => (
              <tr key={r.hints} className={highlight?.type === 'trivia' && highlight.n === r.hints ? 'hl' : ''}>
                <td>{r.hints === 0 ? 'sem dica' : `${r.hints} ${r.hints === 1 ? 'dica' : 'dicas'}`}</td><td>{r.steps}</td>
              </tr>
            ))}
            <tr><td>errou</td><td>0</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Game({ initial, onExit, onNewGame }: { initial: GameState; onExit: () => void; onNewGame: () => void }) {
  const [g, setG] = useState<GameState>(() => {
    const finish = generateBoard(initial.seed).total - 1;
    return { ...initial, players: initial.players.map((p) => ({ ...p, position: Math.max(0, Math.min(finish, p.position)) })) };
  });
  const [cards, setCards] = useState<Card[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [camera, setCamera] = useState<'follow' | 'all'>('follow');
  const [anim, setAnim] = useState<{ playerId: string; cell: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [sound, setSound] = useState(isSoundOn());
  const toastTimer = useRef<number>();

  const board = useMemo(() => generateBoard(g.seed), [g.seed]);
  const specials = useMemo(() => {
    const m = new Map<number, SpecialKind>();
    board.cells.forEach((c) => c.special && m.set(c.index, c.special));
    return m;
  }, [board]);

  useEffect(() => {
    Promise.all([db.cards.toArray(), db.categories.toArray()]).then(([c, cats]) => { setCards(c); setCategories(cats); });
  }, []);
  useEffect(() => saveGame(g), [g]);

  const showToast = (msg: string, ms = 2600) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), ms);
  };

  const player = g.players[g.current];
  const turn = g.turn;
  const setTurn = (patch: Partial<GameState['turn']>) => setG((s) => ({ ...s, turn: { ...s.turn, ...patch } }));
  const card = cards?.find((c) => c.id === turn.cardId);

  // ---- ações do turno ----
  const startRoulette = () => {
    const r = drawType(g.bag, Math.random);
    setG((s) => ({ ...s, bag: r.bag, turn: { ...s.turn, phase: 'roulette', type: r.type } }));
  };
  const chooseFreeType = (type: CardType) => {
    setG((s) => ({
      ...s,
      players: s.players.map((p, i) => (i === s.current ? { ...p, freeChoice: false } : p)),
      turn: { ...s.turn, phase: 'category', type, free: true },
    }));
  };
  const pickCategory = (name: string | null) => {
    if (!cards || !turn.type) return;
    const avail = availableByCategory(cards, g.used, turn.type, categoryNames(turn.type)).filter((c) => c.count > 0);
    const fallback = categoryNames(turn.type).filter((n) => cards.some((c) => c.kind === turn.type && c.category === n));
    const pool = avail.length ? avail.map((a) => a.name) : fallback;
    const cat = name ?? pool[Math.floor(Math.random() * pool.length)];
    const c = cat ? drawCard(cards, g.used, turn.type, cat) : null;
    if (!c) { showToast('Não há cartas nessa categoria.'); return; }
    sfx.click();
    if (name === null) showToast(`Surpresa: ${cat}!`, 1600);
    setG((s) => ({
      ...s,
      used: s.used.includes(c.id!) ? s.used : [...s.used, c.id!],
      turn: { ...s.turn, phase: 'card', cardId: c.id, shown: turn.type === 'perfil' ? 1 : 0, revealed: false },
    }));
  };
  const finishCard = (correct: boolean, picked?: string, reason?: string) => {
    if (turn.phase !== 'card') return; // evita finalizar duas vezes
    const steps = turn.type === 'perfil' ? perfilSteps(Math.max(1, turn.shown), correct) : triviaSteps(turn.shown, correct);
    if (correct) sfx.correct(); else sfx.wrong();
    setTurn({ phase: 'result', outcome: { correct, steps, reason }, picked, revealed: true });
  };
  const startMove = () => {
    const steps = turn.outcome?.steps ?? 0;
    const move = resolveMove(player.position, steps, board.total, specials);
    setTurn({ phase: 'moving', move });
  };

  // ---- animação do movimento + fim de turno ----
  useEffect(() => {
    if (turn.phase !== 'moving' || !turn.move) return;
    const move = turn.move;
    const pid = player.id;
    const timers: number[] = [];
    let t = 150;
    const STEP = 260;
    move.path.forEach((cell) => { t += STEP; timers.push(window.setTimeout(() => { setAnim({ playerId: pid, cell }); sfx.step(); }, t)); });
    if (move.special) {
      t += 350;
      const info = SPECIAL_INFO[move.special];
      timers.push(window.setTimeout(() => { sfx.special(); showToast(`${info.icon} ${info.label}! ${info.desc}`, 3000); }, t));
      t += 900;
      move.specialPath.forEach((cell) => { t += STEP; timers.push(window.setTimeout(() => { setAnim({ playerId: pid, cell }); sfx.step(); }, t)); });
    }
    timers.push(window.setTimeout(() => {
      setAnim(null);
      const s = g; // durante o movimento nada mais altera o estado
      const players = s.players.map((p, i) => (i === s.current
        ? { ...p, position: move.finalPosition, skipNext: p.skipNext || move.skipNext, freeChoice: p.freeChoice || move.freeChoice }
        : p));
      if (move.won) {
        sfx.win();
        setG({ ...s, players, winnerId: players[s.current].id, turn: { ...s.turn, phase: 'victory' } });
        return;
      }
      const nt = nextTurn(players, s.current, move.extraTurn);
      if (nt.skipped.length) showToast(`⛔ ${nt.skipped.join(', ')} perdeu a vez.`, 3000);
      else if (move.extraTurn) showToast(`🔁 ${players[s.current].name} joga de novo!`, 2200);
      setG({ ...s, players: nt.players, current: nt.index, turn: newTurn() });
    }, t + 400));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn.phase, turn.hintSeed]);

  const categoryNames = (type: CardType) => categories.filter((c) => c.kind === type).map((c) => c.name);

  const pins = g.players.map((p) => ({ id: p.id, name: p.name, color: p.color, cell: anim?.playerId === p.id ? anim.cell : p.position }));
  const focus = anim?.playerId === player.id ? anim.cell : player.position;

  // ---- vitória ----
  if (turn.phase === 'victory') {
    const winner = g.players.find((p) => p.id === g.winnerId)!;
    return (
      <div className="victory screen">
        <div className="confetti" aria-hidden>{Array.from({ length: 40 }, (_, i) => <span key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 10) * 0.25}s`, background: g.players[i % g.players.length].color }} />)}</div>
        <h1>🏆 {winner.name} venceu!</h1>
        <ol className="ranking">
          {ranking(g.players).map((p, i) => (
            <li key={p.id} style={{ borderColor: p.color }}>
              <span className="medal">{['🥇', '🥈', '🥉'][i] ?? `${i + 1}º`}</span>
              <span className="dot" style={{ background: p.color }} />
              <span className="name">{p.name}</span>
              <span className="pos">{p.position >= board.total - 1 ? 'CHEGADA' : `casa ${p.position}`}</span>
            </li>
          ))}
        </ol>
        <p className="muted">Tabuleiro: seed <code>{g.seed}</code></p>
        <div className="row center">
          <button className="btn primary big" onClick={onNewGame}>Nova partida</button>
          <button className="btn big" onClick={onExit}>Menu</button>
        </div>
      </div>
    );
  }

  const highlight = turn.phase === 'card' && turn.type ? { type: turn.type, n: turn.shown } : undefined;

  return (
    <div className="game">
      <main className="board-area">
        <BoardView board={board} pins={pins} currentId={player.id} camera={camera} focusCell={focus} />
        <div className="turn-banner" style={{ background: player.color }}>Vez de <b>{player.name}</b></div>

        {turn.phase === 'start' && (
          <div className="overlay">
            <div className="modal center-text">
              <h2>Vez de <span style={{ color: player.color }}>{player.name}</span></h2>
              {player.freeChoice ? (
                <>
                  <p>⭐ Escolha livre! Que tipo de carta você quer?</p>
                  <div className="row center">
                    <button className="btn big type-perfil" onClick={() => chooseFreeType('perfil')}>PERFIL</button>
                    <button className="btn big type-trivia" onClick={() => chooseFreeType('trivia')}>TRIVIA</button>
                  </div>
                </>
              ) : (
                <button className="btn primary big" onClick={startRoulette} disabled={!cards}>🎰 Sortear carta</button>
              )}
            </div>
          </div>
        )}

        {turn.phase === 'roulette' && turn.type && (
          <div className="overlay"><div className="modal"><Roulette type={turn.type} onDone={() => setTurn({ phase: 'category' })} /></div></div>
        )}

        {turn.phase === 'category' && turn.type && cards && (
          <div className="overlay">
            <div className="modal">
              <h2 className="center-text"><span className={`tag ${turn.type}`}>{TYPE_LABEL[turn.type]}</span> Escolha a categoria</h2>
              <div className="category-grid">
                {availableByCategory(cards, g.used, turn.type, categoryNames(turn.type)).map((c) => (
                  <button key={c.name} className="btn category" disabled={c.count === 0} onClick={() => pickCategory(c.name)}>
                    {c.name}<small>{c.count} {c.count === 1 ? 'carta' : 'cartas'}</small>
                  </button>
                ))}
                <button className="btn category surprise" onClick={() => pickCategory(null)}>🎲 Surpresa</button>
              </div>
            </div>
          </div>
        )}

        {turn.phase === 'card' && card && (
          <div className="overlay">
            <div className="modal wide">
              {card.kind === 'perfil' ? (
                <PerfilPanel card={card as PerfilCard} shown={turn.shown} onShow={(n) => setTurn({ shown: n })} onResult={finishCard} />
              ) : (
                <TriviaPanel card={card as TriviaCard} used={turn.shown} hintSeed={turn.hintSeed} wrong={turn.wrong ?? []}
                  onUse={(n) => setTurn({ shown: n })}
                  onWrongOption={(o) => setG((s) => ({ ...s, turn: { ...s.turn, wrong: [...(s.turn.wrong ?? []), o] } }))}
                  onResult={finishCard} />
              )}
            </div>
          </div>
        )}

        {turn.phase === 'result' && turn.outcome && card && (
          <div className="overlay">
            <div className={`modal center-text result ${turn.outcome.correct ? 'ok' : 'bad'}`}>
              <h2>{turn.outcome.correct ? '🎉 Acertou!' : '😬 Não foi dessa vez'}</h2>
              {card.kind === 'trivia' && turn.picked && !turn.outcome.correct && <p>Você marcou: <s>{turn.picked}</s></p>}
              {turn.outcome.reason && <p className="result-reason">{turn.outcome.reason}</p>}
              <p className="answer-big">{card.answer}</p>
              <p className="steps-big">{turn.outcome.steps > 0 ? `Anda ${turn.outcome.steps} ${turn.outcome.steps === 1 ? 'casa' : 'casas'}` : 'Fica onde está'}</p>
              <button className="btn primary big" onClick={startMove} autoFocus>
                {turn.outcome.steps > 0 ? '▶ Andar' : '▶ Passar a vez'}
              </button>
            </div>
          </div>
        )}

        {toast && <div className="toast">{toast}</div>}
      </main>

      <aside className="sidebar">
        <div className="sidebar-top">
          <button className="btn small" onClick={onExit} title="Voltar ao menu (a partida fica salva)">☰ Menu</button>
          <button className="btn small" onClick={() => setCamera(camera === 'all' ? 'follow' : 'all')}>
            {camera === 'all' ? '🎯 Seguir jogador' : '🗺️ Ver tabuleiro'}
          </button>
          <button className="btn small" onClick={() => { setSoundOn(!sound); setSound(!sound); }} title="Sons">{sound ? '🔊' : '🔇'}</button>
        </div>
        <h3>Placar</h3>
        <ol className="scoreboard">
          {g.players.map((p, i) => {
            const pos = anim?.playerId === p.id ? anim.cell : p.position;
            return (
              <li key={p.id} className={i === g.current ? 'current' : ''} style={{ borderColor: p.color }}>
                <span className="dot" style={{ background: p.color }}>{p.name.charAt(0).toUpperCase()}</span>
                <div className="info">
                  <div className="name">{p.name} {i === g.current && <span className="your-turn">VEZ</span>}</div>
                  <div className="bar"><span style={{ width: `${(pos / (board.total - 1)) * 100}%`, background: p.color }} /></div>
                </div>
                <div className="pos">
                  {pos}<small>/{board.total - 1}</small>
                  {p.skipNext && <span title="Perde a próxima vez">⛔</span>}
                  {p.freeChoice && <span title="Escolha livre na próxima jogada">⭐</span>}
                </div>
              </li>
            );
          })}
        </ol>
        <StepsTable highlight={highlight} />
        <details className="legend">
          <summary>Casas especiais</summary>
          <ul>{Object.values(SPECIAL_INFO).map((s) => <li key={s.label}><span className="sp" style={{ background: s.color }}>{s.short}</span>{s.label}: {s.desc}</li>)}</ul>
        </details>
      </aside>
    </div>
  );
}
