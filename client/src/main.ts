import './style.css';

type Mode = 'avatar' | 'chat';
type Style = 'soc' | 'ins';

const avatarUI = document.getElementById('avatar-ui')!;
const chatUI = document.getElementById('chat-ui')!;

let currentMode: Mode | null = null;
let currentStyle: Style | null = null;
let cleanup: () => Promise<void> | void = () => {};

/* ─────────── on load ─────────── */
// Initialisiere Zustände und Nutzer-Overlay nur einmal nach vollständigem Laden des DOMs
window.addEventListener('DOMContentLoaded', () => {
  const overlay = document.getElementById('consent-overlay')!;
  const params = new URLSearchParams(window.location.search);

  // Ermöglicht Entwicklern, den Experiment-Status gezielt zurückzusetzen
  if (params.get('reset') === '1') {
    localStorage.removeItem('experimentDone');
    console.log('Experiment-Status zurückgesetzt');
  }

  // Zeige Abschluss-Overlay, wenn Experiment bereits beendet wurde
  if (localStorage.getItem('experimentDone') === 'true') {
    document.getElementById('experiment-complete-overlay')!.style.display = 'flex';
    return;
  }

  // Verhindere Scrollen bis zur Zustimmung des Nutzers
  overlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  // Setze Interaktionen für schwebende Tags auf, um Benutzerfeedback zu steuern
  const floatingTagsContainer = document.getElementById('floatingTagsContainer');
  if (floatingTagsContainer) {
    const tagWrappers = floatingTagsContainer.querySelectorAll<HTMLElement>('.tag-wrapper');
    const closeAllTags = () => tagWrappers.forEach(tw => tw.classList.remove('open'));

    tagWrappers.forEach(wrapper => {
      wrapper.addEventListener('click', (event) => {
        const target = event.currentTarget as HTMLElement;
        // Unterdrücke Standardverhalten nur für Pseudo-Links ohne echten href
        const isLink = target.tagName === 'A' && (target as HTMLAnchorElement).href !== '#' && !!(target as HTMLAnchorElement).href;
        if (!isLink || (isLink && (target as HTMLAnchorElement).getAttribute('href') === '#')) {
          event.preventDefault();
          event.stopPropagation();
        }
        // Öffne oder schließe das Tag basierend auf vorherigem Zustand
        const wasOpen = wrapper.classList.contains('open');
        closeAllTags();
        if (!wasOpen) wrapper.classList.add('open');
      });
    });

    // Schließe Tags bei Klick außerhalb
    document.body.addEventListener('click', (event) => {
      if (!Array.from(tagWrappers).some(tw => tw.contains(event.target as Node))) {
        closeAllTags();
      }
    });
  }

  // Setze Einverständnis und starte App bei Zustimmung des Nutzers
  document.getElementById('consent-accept')?.addEventListener('click', () => {
    if (localStorage.getItem('experimentDone') === 'true') {
      document.getElementById('experiment-complete-overlay')!.style.display = 'flex';
      return;
    }
    overlay.remove();
    document.body.style.overflow = '';
    initApp();
  });

  // Initialisiere Topbar-Navigation, um Überlauf und Scroll-Controls zu verwalten
  const topbar = document.querySelector<HTMLElement>('.topbar');
  if (topbar) {
    const navWrapper = topbar.querySelector<HTMLElement>('.topbar-nav-wrapper');
    const navInner   = topbar.querySelector<HTMLElement>('.topbar-nav');
    const prevBtn    = topbar.querySelector<HTMLButtonElement>('.topbar-nav-control.prev');
    const nextBtn    = topbar.querySelector<HTMLButtonElement>('.topbar-nav-control.next');

    if (navWrapper && navInner && prevBtn && nextBtn) {
      // Warum: Wir benötigen Dimensionsdaten, um Überlauf und Sichtbarkeit dynamisch anzupassen
      let allNavItems: HTMLElement[] = [];
      let itemWidths:   number[]    = [];
      let visibleWidth = 0;
      let totalWidth   = 0;
      let gapWidth     = 0;

      let startIndex = 0;
      let endIndex   = -1;
      let visibleCount = 0;

      // Aktiviere/Deaktiviere aufeinanderfolgende Navigationselemente
      const updateVisibleItems = () => {
        if (allNavItems.length === 0) { visibleCount = 0; return; }
        let renderedWidth = 0;
        let lastIndex = -1;
        visibleCount = 0;
        allNavItems.forEach(item => item.style.display = 'none');

        // Sicherstellung des Startindex innerhalb gültiger Grenzen
        if (startIndex >= allNavItems.length) {
          startIndex = Math.max(0, allNavItems.length - 1);
        }

        // Berechne, welche Elemente angezeigt werden können
        for (let i = startIndex; i < allNavItems.length; i++) {
          const width = itemWidths[i] + (visibleCount ? gapWidth : 0);
          if (renderedWidth + width <= visibleWidth + 2) {
            allNavItems[i].style.display = '';
            renderedWidth += width;
            lastIndex = i;
            visibleCount++;
          } else break;
        }
        endIndex = lastIndex;
      };

      // Ermittle und speichere Dimensionen für alle Navigationselemente
      const calculateDimensionsAndRefreshUI = () => {
        allNavItems = Array.from(navInner.children) as HTMLElement[];
        gapWidth = parseInt(getComputedStyle(navInner).gap) || 0;
        itemWidths = [];
        totalWidth = 0;

        allNavItems.forEach((item, idx) => {
          const prevDisplay = item.style.display;
          item.style.display = '';
          itemWidths[idx] = item.offsetWidth;
          totalWidth += item.offsetWidth + (idx < allNavItems.length - 1 ? gapWidth : 0);
          item.style.display = prevDisplay;
        });

        const padLeft  = parseInt(getComputedStyle(navInner).paddingLeft)  || 0;
        const padRight = parseInt(getComputedStyle(navInner).paddingRight) || 0;
        totalWidth += padLeft + padRight;
        visibleWidth = navWrapper.offsetWidth;

        // Warum: Lege Overflow-Zustand fest und berechne sinnvollen Startindex neu
        if (totalWidth <= visibleWidth) {
          navWrapper.classList.remove('has-overflow');
          startIndex = 0;
        } else {
          navWrapper.classList.add('has-overflow');
          // Vereinfachte Logik, um möglichst viele alte sichtbare Items beizubehalten
          let found = false;
          for (let i = startIndex; i < allNavItems.length && !found; i++) {
            let w = 0, count = 0;
            for (let j = i; j < allNavItems.length; j++) {
              const wi = itemWidths[j] + (count ? gapWidth : 0);
              if (w + wi <= visibleWidth + 2) { w += wi; count++; }
              else break;
            }
            if (count) { startIndex = i; found = true; }
          }
          if (!found) startIndex = 0;
          if (startIndex >= allNavItems.length) startIndex = allNavItems.length - 1;
        }

        updateVisibleItems();
        updateButtonStates();
      };

      // Steuerung der Aktiv-/Inaktiv-Zustände der Scroll-Buttons
      const updateButtonStates = () => {
        const noOverflow = totalWidth <= visibleWidth;
        prevBtn.style.display = noOverflow ? 'none' : 'flex';
        nextBtn.style.display = noOverflow ? 'none' : 'flex';
        prevBtn.disabled = startIndex === 0;
        nextBtn.disabled = endIndex >= allNavItems.length - 1;
      };

      // Verschiebe Ansicht nach rechts, sodass nächstes Nav-Item vorne steht
      const moveToNext = () => {
        if (nextBtn.disabled) return;
        startIndex = Math.min(startIndex + 1, allNavItems.length - 1);
        updateVisibleItems();
        if (!visibleCount && startIndex > 0) {
          // Fallback: finde letzten möglichen Start, falls nichts passt
          for (let i = allNavItems.length - 1; i >= 0; i--) {
            let w = 0, canFit = false;
            for (let j = i; j < allNavItems.length; j++) {
              const wi = itemWidths[j] + (j > i ? gapWidth : 0);
              if (w + wi <= visibleWidth + 2) { w += wi; canFit = true; } else break;
            }
            if (canFit) { startIndex = i; break; }
          }
          updateVisibleItems();
        }
        updateButtonStates();
      };

      // Verschiebe Ansicht nach links, sodass vorheriges Nav-Item vorne steht
      const moveToPrev = () => {
        if (prevBtn.disabled) return;
        startIndex = Math.max(0, startIndex - 1);
        updateVisibleItems();
        updateButtonStates();
      };

      nextBtn.addEventListener('click', moveToNext);
      prevBtn.addEventListener('click', moveToPrev);
      window.addEventListener('resize', calculateDimensionsAndRefreshUI);

      // Initiale Größenberechnung nach kurzer Verzögerung
      setTimeout(calculateDimensionsAndRefreshUI, 100);
    }
  }
});

/**
 * Starte Anwendung nach Zustimmung des Nutzers
 */
function initApp() {
  const params = new URLSearchParams(location.search);
  const initialMode  = (params.get('mode')  ?? 'avatar') as Mode;
  const initialStyle = (params.get('style') ?? 'soc')    as Style;

  if (localStorage.getItem('experimentDone') === 'true') {
    document.getElementById('experiment-complete-overlay')!.style.display = 'flex';
    return;
  }

  // Setze UI-Klasse basierend auf Modus
  setMode(initialMode, initialStyle);
  document.body.classList.toggle('mode-avatar', initialMode === 'avatar');
}

/**
 * Wechsel zwischen Avatar- und Chat-Modus und lade benötigte Module
 */
async function setMode(mode: Mode, style: Style) {
  if (mode === currentMode && style === currentStyle) return; // Kein Wechsel nötig
  await cleanup();                                   // Bereinige vorherigen Zustand
  document.body.classList.toggle('mode-avatar', mode === 'avatar');
  document.body.classList.toggle('mode-chat',   mode === 'chat');

  if (mode === 'chat') {
    avatarUI.classList.add('hidden');               // Blende Avatar-UI aus
    chatUI.classList.remove('hidden');              // Zeige Chat-UI
    const mod = await import('./features/chatbot'); // Lade Chatbot-Modul dynamisch
    cleanup = mod.stopChatbot;
    mod.startChatbot(style);
  } else {
    chatUI.classList.add('hidden');
    avatarUI.classList.remove('hidden');            // Zeige Avatar-UI
    const mod = await import('./features/avatar');  // Lade Avatar-Modul dynamisch
    cleanup = mod.stopAvatar;
    mod.startAvatar(style);
  }

  currentMode  = mode;
  currentStyle = style;

  // Markiere aktiven Link in Topbar basierend auf Mode/Style
  document.querySelectorAll<HTMLAnchorElement>('.topbar-nav a').forEach(link => {
    const linkMode  = link.dataset.mode as Mode | undefined;
    const linkStyle = link.dataset.style as Style| undefined;
    let isActive = false;
    if (linkMode === currentMode) isActive = linkStyle ? linkStyle === currentStyle : true;
    link.classList.toggle('active', isActive);
  });
}

// Registriere Klick-Handler für Topbar-Links, um Modus-Wechsel zu ermöglichen
document.querySelectorAll<HTMLAnchorElement>('.topbar-nav a[data-mode]').forEach(link => {
  link.addEventListener('click', (e) => {
    const targetMode = link.dataset.mode as Mode | undefined;
    let targetStyle  = link.dataset.style as Style| undefined;
    if (!targetMode) return;
    e.preventDefault();
    // Fallback: Erhalte aktuellen Style, wenn keiner im Link definiert
    if (!targetStyle) targetStyle = (targetMode === currentMode && currentStyle) ? currentStyle : 'soc';
    setMode(targetMode, targetStyle);
  });
});

// Vibrieren auf unterstützten Geräten zur haptischen Rückmeldung
function vibrate() {
  if ('vibrate' in navigator) {
    const success = navigator.vibrate(100);
    console.log("Vibration gestartet:", success);
  } else {
    console.warn("Vibration wird nicht unterstützt");
  }
}
// Globale Exposition für HTML onclick-Handler
(window as any).vibrate = vibrate;
