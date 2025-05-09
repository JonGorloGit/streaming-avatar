import './style.css';

type Mode  = 'avatar'|'chat';
type Style = 'soc'|'ins';                     // <-- neu

const avatarUI = document.getElementById('avatar-ui')!;
const chatUI   = document.getElementById('chat-ui')!;

let currentMode : Mode  | null = null;
let currentStyle: Style | null = null;
let cleanup: () => Promise<void> | void = () => {};

/* ─────────── on load ─────────── */
window.addEventListener('DOMContentLoaded', () => {
  const p = new URLSearchParams(location.search);

  const initialMode  = (p.get('mode')  ?? 'avatar') as Mode;
  const initialStyle = (p.get('style') ?? 'soc')    as Style;

  // Formularvoreinstellung
  (document.querySelector<HTMLInputElement>(`input[name=mode ][value=${initialMode }]`)!).checked = true;
  (document.querySelector<HTMLInputElement>(`input[name=style][value=${initialStyle}]`)!).checked = true;

  setMode(initialMode, initialStyle);
});

/* ─────────── Form-Events ─────────── */
document.getElementById('controls')!
        .addEventListener('change', ev => {
  const f   = new FormData(ev.currentTarget as HTMLFormElement);
  const mode  = f.get('mode')  as Mode;
  const style = f.get('style') as Style;

  history.pushState({}, '', `?mode=${mode}&style=${style}`);
  setMode(mode, style);
});

/* ─────────── Umschalten ─────────── */
async function setMode(mode: Mode, style: Style) {
  if (mode === currentMode && style === currentStyle) return;
  await cleanup();                                    // Saisonwechsel

  if (mode === 'chat') {
    avatarUI.classList.add   ('hidden');
    chatUI  .classList.remove('hidden');

    const mod = await import('./features/chatbot');
    cleanup   = mod.stopChatbot;
    mod.startChatbot(style);                          // <-- Stil mitgeben
  } else {
    chatUI  .classList.add   ('hidden');
    avatarUI.classList.remove('hidden');

    const mod = await import('./features/avatar');
    cleanup   = mod.stopAvatar;
    mod.startAvatar(style);                           // <-- Stil mitgeben
  }

  currentMode  = mode;
  currentStyle = style;
}
