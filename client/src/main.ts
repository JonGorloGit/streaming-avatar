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
  const overlay = document.getElementById('consent-overlay')!;
  // const accepted = localStorage.getItem('consent-given');

  const params = new URLSearchParams(window.location.search);

  // ✅ Reset über z.B. ?reset=1
  if (params.get('reset') === '1') {
    localStorage.removeItem('experimentDone');
    console.log('Experiment-Status zurückgesetzt');
  }


  if (localStorage.getItem('experimentDone') === 'true') {
    document.getElementById('experiment-complete-overlay')!.style.display = 'flex';
    return; // Zugriff blockieren
  }  

  // if (!accepted) {
  overlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden'; // Scrollen blockieren
  // } else {
  //   initApp(); // sofort starten
  // }

  document.getElementById('consent-accept')?.addEventListener('click', () => {
    // localStorage.setItem('consent-given', 'true'); // ← auskommentiert
    if (localStorage.getItem('experimentDone') === 'true') {
      document.getElementById('experiment-complete-overlay')!.style.display = 'flex';
      return; // Zugriff blockieren
    }  
    overlay.remove();
    document.body.style.overflow = ''; // Scrollen wieder aktivieren
    initApp(); // nach Zustimmung starten
  });
});

/**
 * Initialisiert die Anwendung (Avatar/Chat-Start)
 */
function initApp() {
  const p = new URLSearchParams(location.search);
  const initialMode  = (p.get('mode')  ?? 'avatar') as Mode;
  const initialStyle = (p.get('style') ?? 'soc')    as Style;
  if (localStorage.getItem('experimentDone') === 'true') {
    document.getElementById('experiment-complete-overlay')!.style.display = 'flex';
    return; // Zugriff blockieren
  }  
  
  setMode(initialMode, initialStyle);
  
}

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
