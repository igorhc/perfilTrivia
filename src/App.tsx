import { useState } from 'react';
import Admin from './components/Admin';
import Game from './components/Game';
import Setup from './components/Setup';
import { loadGame, newGame, saveGame, type GameState } from './gameState';
import { isSoundOn, setSoundOn } from './sound';
import { perfilTable, triviaTable } from './logic/scoring';

type Screen = { name: 'menu' } | { name: 'setup' } | { name: 'game'; game: GameState } | { name: 'admin' };

function Menu({ go }: { go: (s: Screen) => void }) {
  const saved = loadGame();
  const [sound, setSound] = useState(isSoundOn());
  return (
    <div className="menu screen">
      <div className="logo">
        <span className="q">?</span>
        <h1>Perfil <span>Trivia</span></h1>
        <p>Adivinhe com menos dicas e ande mais casas!</p>
      </div>
      <div className="menu-buttons">
        {saved && (
          <button className="btn primary big" onClick={() => go({ name: 'game', game: saved })}>
            ▶ Continuar partida <small>({saved.players.map((p) => p.name).join(', ')})</small>
          </button>
        )}
        <button className={`btn big ${saved ? '' : 'primary'}`} onClick={() => {
          if (saved && !confirm('Começar uma nova partida descarta a partida salva. Continuar?')) return;
          go({ name: 'setup' });
        }}>🎲 Nova partida</button>
        <button className="btn big" onClick={() => go({ name: 'admin' })}>📚 Banco de perguntas</button>
        <button className="btn" onClick={() => { setSoundOn(!sound); setSound(!sound); }}>{sound ? '🔊 Som ligado' : '🔇 Som desligado'}</button>
      </div>
      <details className="rules panel">
        <summary>Como jogar</summary>
        <ul>
          <li>Não tem dado: a cada vez sorteia-se uma carta <b>PERFIL</b> ou <b>TRIVIA</b> (metade de cada).</li>
          <li>O jogador escolhe a categoria (ou “Surpresa”).</li>
          <li><b>Perfil:</b> as dicas aparecem uma a uma. Acertou vendo N dicas → anda 11 − N casas ({perfilTable()[0].steps} com 1 dica, {perfilTable()[9].steps} com 10). Palpite errado não custa nada; passou das 10 dicas, fica parado.</li>
          <li><b>Trivia:</b> responda sem ajuda ou peça até 3 dicas: {triviaTable().map((r) => r.steps).join(' / ')} casas. Errou? Vem a próxima dica; errou depois da 3ª, fica parado.</li>
          <li><b>Quem confere:</b> outro participante segura “Segure para ver a resposta” (a resposta só aparece enquanto o botão está pressionado) e decide se vale: pronúncia parecida ou resposta parcial podem ser aceitas.</li>
          <li>Casas especiais: avance 3, volte 3, perca a vez, jogue de novo e escolha livre. Ganha quem chegar primeiro à CHEGADA.</li>
        </ul>
      </details>
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'menu' });
  switch (screen.name) {
    case 'setup':
      return <Setup onBack={() => setScreen({ name: 'menu' })} onStart={(players, seed) => {
        const g = newGame(players, seed);
        saveGame(g);
        setScreen({ name: 'game', game: g });
      }} />;
    case 'game':
      return <Game key={screen.game.seed + screen.game.players.map((p) => p.id).join()} initial={screen.game}
        onExit={() => setScreen({ name: 'menu' })} onNewGame={() => setScreen({ name: 'setup' })} />;
    case 'admin':
      return <Admin onBack={() => setScreen({ name: 'menu' })} />;
    default:
      return <Menu go={setScreen} />;
  }
}
