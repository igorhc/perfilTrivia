import { useEffect, useMemo, useState } from 'react';
import type { PerfilCard, TriviaCard } from '../logic/cards';
import { buildTriviaHints, eliminatedOptions } from '../logic/cards';
import { createRng } from '../logic/rng';
import { PERFIL_MAX_CLUES, TRIVIA_MAX_HINTS, perfilSteps, triviaSteps } from '../logic/scoring';
import { sfx } from '../sound';

const casas = (n: number) => `${n} ${n === 1 ? 'casa' : 'casas'}`;

/** Botão "segure para ver": mostra a resposta só enquanto está pressionado (mouse, toque ou teclado). */
export function HoldToReveal({ answer }: { answer: string }) {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (!held) return;
    const release = () => setHeld(false);
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    window.addEventListener('blur', release);
    return () => {
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
      window.removeEventListener('blur', release);
    };
  }, [held]);
  return (
    <button
      type="button"
      className={`hold-reveal ${held ? 'on' : ''}`}
      onPointerDown={(e) => { e.preventDefault(); setHeld(true); }}
      onPointerUp={() => setHeld(false)}
      onPointerLeave={() => setHeld(false)}
      onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setHeld(true); } }}
      onKeyUp={() => setHeld(false)}
      onContextMenu={(e) => e.preventDefault()}
      aria-label="Segure para ver a resposta"
    >
      {held ? (
        <span className="hold-answer">{answer}</span>
      ) : (
        <>
          <span className="hold-title">👁 Segure para ver a resposta</span>
          <span className="hold-sub">Só para quem confere. Quem está respondendo não pode olhar!</span>
        </>
      )}
    </button>
  );
}

/** Área de quem confere: revelar (segurando) + acertou / próxima dica / errou. */
function JudgeArea({ answer, nextLabel, onCorrect, onNext, onWrong }: {
  answer: string;
  /** Texto do botão de próxima dica; ausente quando não há mais dicas. */
  nextLabel?: string;
  onCorrect: () => void;
  onNext: () => void;
  onWrong: () => void;
}) {
  return (
    <div className="judge">
      <p className="judge-help">
        O jogador responde em voz alta. Outro participante segura o botão, confere a resposta (vale pronúncia parecida
        ou resposta parcial, se o grupo achar justo) e decide:
      </p>
      <HoldToReveal answer={answer} />
      <div className="actions">
        <button className="btn big success" onClick={onCorrect}>✔ Respondeu corretamente</button>
        {nextLabel ? (
          <button className="btn big" onClick={onNext}>➡ {nextLabel}</button>
        ) : (
          <button className="btn big danger" onClick={onWrong}>✖ Errou: ninguém acertou</button>
        )}
      </div>
    </div>
  );
}

interface PerfilProps {
  card: PerfilCard;
  shown: number;
  onShow: (n: number) => void;
  onResult: (correct: boolean) => void;
}

export function PerfilPanel({ card, shown, onShow, onResult }: PerfilProps) {
  const last = shown >= PERFIL_MAX_CLUES;
  return (
    <div className="card-panel perfil">
      <div className="card-head">
        <span className="tag perfil">PERFIL</span>
        <span className="tag cat">{card.category}</span>
        <span className="worth">Acertando agora: <b>{perfilSteps(shown, true)}</b> {perfilSteps(shown, true) === 1 ? 'casa' : 'casas'}</span>
      </div>
      <ol className="clues">
        {card.clues.slice(0, shown).map((c, i) => (
          <li key={i} className={i === shown - 1 ? 'latest' : ''}><span className="num">{i + 1}</span>{c}</li>
        ))}
      </ol>
      <div className="clue-progress">{Array.from({ length: PERFIL_MAX_CLUES }, (_, i) => <span key={i} className={i < shown ? 'on' : ''} />)}</div>
      <JudgeArea
        answer={card.answer}
        nextLabel={last ? undefined : `Próxima dica (passa a valer ${casas(perfilSteps(shown + 1, true))})`}
        onCorrect={() => onResult(true)}
        onNext={() => { sfx.click(); onShow(shown + 1); }}
        onWrong={() => onResult(false)}
      />
    </div>
  );
}

interface TriviaProps {
  card: TriviaCard;
  used: number;
  hintSeed: string;
  /** Alternativas já marcadas erradas nesta carta. */
  wrong: string[];
  onUse: (n: number) => void;
  onWrongOption: (option: string) => void;
  onResult: (correct: boolean, picked?: string) => void;
}

export function TriviaPanel({ card, used, hintSeed, wrong, onUse, onWrongOption, onResult }: TriviaProps) {
  const hints = useMemo(() => buildTriviaHints(card, createRng(hintSeed)), [card, hintSeed]);
  const eliminated = eliminatedOptions(card, hints, used);
  const max = Math.min(TRIVIA_MAX_HINTS, hints.length);
  const hasNext = used < max;
  const next = () => { sfx.click(); onUse(used + 1); };

  const pickOption = (o: string) => {
    if (o === card.answer) { onResult(true, o); return; }
    // errou a alternativa: ela fica riscada e vem a próxima dica (ou acaba, se não houver mais)
    sfx.wrong();
    if (hasNext) { onWrongOption(o); onUse(used + 1); } else onResult(false, o);
  };

  return (
    <div className="card-panel trivia">
      <div className="card-head">
        <span className="tag trivia">TRIVIA</span>
        <span className="tag cat">{card.category}</span>
        <span className="worth">Acertando agora: <b>{triviaSteps(used, true)}</b> {triviaSteps(used, true) === 1 ? 'casa' : 'casas'}</span>
      </div>
      <p className="question">{card.question}</p>
      {used > 0 && (
        <ul className="hints">
          {hints.slice(0, used).map((h, i) => <li key={i}><span className="num">💡{i + 1}</span>{h.text}</li>)}
        </ul>
      )}
      {card.type === 'multipla' && card.options && (
        <div className="options">
          {card.options.map((o, i) => (
            <button key={o} className={`option ${wrong.includes(o) ? 'wrong' : ''}`} disabled={eliminated.includes(o) || wrong.includes(o)}
              onClick={() => pickOption(o)}>
              <span className="letter">{'ABCD'[i]}</span>{o}
            </button>
          ))}
        </div>
      )}
      <JudgeArea
        answer={card.answer}
        nextLabel={hasNext ? `Próxima dica (${used + 1}/${max}, passa a valer ${casas(triviaSteps(used + 1, true))})` : undefined}
        onCorrect={() => onResult(true)}
        onNext={next}
        onWrong={() => onResult(false)}
      />
    </div>
  );
}
