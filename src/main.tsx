import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ensureSeedSynced } from './db/db';
import './styles.css';

const render = () =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );

// garante que o banco do navegador está com o seed atual antes de abrir o jogo
ensureSeedSynced()
  .then((r) => { if (r) console.info(`[banco] atualizado: ${r.updated} cartas corrigidas, ${r.added} novas`); })
  .catch((e) => console.warn('[banco] não foi possível sincronizar o seed', e))
  .finally(render);
