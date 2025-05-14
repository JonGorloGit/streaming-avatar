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

    // Am Ende deiner main.ts Datei, oder innerhalb des DOMContentLoaded-Listeners

// Floating Tags Functionality
const floatingTagsContainer = document.getElementById('floatingTagsContainer');
if (floatingTagsContainer) {
  const tagWrappers = floatingTagsContainer.querySelectorAll<HTMLElement>('.tag-wrapper');

  const closeAllTags = () => {
    tagWrappers.forEach(tw => tw.classList.remove('open'));
  };

  tagWrappers.forEach(wrapper => {
    wrapper.addEventListener('click', (event) => {
      // Wenn es ein <a> Tag ist und es ein href Ziel hat, nicht stoppen,
      // außer wenn du das Standardverhalten unterbinden willst.
      // Für reine UI-Elemente ist stopPropagation gut.
      const targetElement = event.currentTarget as HTMLElement;
      const isLink = targetElement.tagName === 'A' && (targetElement as HTMLAnchorElement).href && (targetElement as HTMLAnchorElement).href !== '#';

      if (!isLink || (isLink && (targetElement as HTMLAnchorElement).getAttribute('href') === '#')) {
          event.preventDefault(); // Verhindert Springen bei href="#"
          event.stopPropagation();
      }


      const wasOpen = wrapper.classList.contains('open');
      closeAllTags();
      if (!wasOpen) {
        wrapper.classList.add('open');
      }
    });
  });

  document.body.addEventListener('click', (event) => {
    // Schließe nur, wenn der Klick nicht auf einen Tag-Wrapper oder dessen Kinder erfolgte
    let clickedOnTag = false;
    tagWrappers.forEach(tw => {
        if (tw.contains(event.target as Node)) {
            clickedOnTag = true;
        }
    });
    if (!clickedOnTag) {
        closeAllTags();
    }
  });
}

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

// ───────── Floating Tags Functionality ─────────
const floatingTagsContainer = document.getElementById('floatingTagsContainer');
if (floatingTagsContainer) {
  const tagWrappers = floatingTagsContainer.querySelectorAll<HTMLElement>('.tag-wrapper');

  const closeAllTags = () => {
    tagWrappers.forEach(tw => tw.classList.remove('open'));
  };

  tagWrappers.forEach(wrapper => {
    wrapper.addEventListener('click', event => {
      const target = event.currentTarget as HTMLElement;
      const isLink = target.tagName === 'A' &&
                     (target as HTMLAnchorElement).href &&
                     (target as HTMLAnchorElement).getAttribute('href') !== '#';
      if (!isLink) {
        event.preventDefault();
        event.stopPropagation();
      }
      const wasOpen = wrapper.classList.contains('open');
      closeAllTags();
      if (!wasOpen) wrapper.classList.add('open');
    });
  });

  // Klick außerhalb schließt alle Tags
  document.body.addEventListener('click', event => {
    if (![...tagWrappers].some(tw => tw.contains(event.target as Node))) {
      closeAllTags();
    }
  });
}
// ───────────────────────────────────────────────

function initApp() {
  const p = new URLSearchParams(location.search);
  const initialMode  = (p.get('mode')  ?? 'avatar') as Mode;
  const initialStyle = (p.get('style') ?? 'soc')    as Style;
  if (localStorage.getItem('experimentDone') === 'true') {
    document.getElementById('experiment-complete-overlay')!.style.display = 'flex';
    return; // Zugriff blockieren
  }  

  setMode(initialMode, initialStyle);

  // Avatar-Mode → body bekommt Klasse
  if (initialMode === 'avatar') {
    document.body.classList.add('mode-avatar');
  }
  
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
