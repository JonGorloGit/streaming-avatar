import './style.css';

type Mode = 'avatar' | 'chat';
type Style = 'soc' | 'ins';

const avatarUI = document.getElementById('avatar-ui')!;
const chatUI = document.getElementById('chat-ui')!;
const consentOverlayGlobal = document.getElementById('consent-overlay')!; // For global access if needed

let currentAppMode: Mode | null = null; // Renamed to avoid conflict with local 'currentMode'
let currentAppStyle: Style | null = null; // Renamed to avoid conflict with local 'currentStyle'
let cleanup: () => Promise<void> | void = async () => {};

// Define all four redirect URL constants from .env, with fallbacks
const REDIRECT_URL_AVATAR_SOC_MAIN = import.meta.env.VITE_REDIRECT_URL_AVATAR_SOC || 'https://google.com';
const REDIRECT_URL_AVATAR_INS_MAIN = import.meta.env.VITE_REDIRECT_URL_AVATAR_INS || 'https://meta.com';
const REDIRECT_URL_CHAT_SOC_MAIN   = import.meta.env.VITE_REDIRECT_URL_CHAT_SOC   || 'https://amazon.com';
const REDIRECT_URL_CHAT_INS_MAIN   = import.meta.env.VITE_REDIRECT_URL_CHAT_INS   || 'https://youtube.com';


function getRedirectUrlForBanner(mode: Mode, style: Style): string {
    if (mode === 'avatar') {
        return style === 'soc' ? REDIRECT_URL_AVATAR_SOC_MAIN : REDIRECT_URL_AVATAR_INS_MAIN;
    } else { // mode === 'chat'
        return style === 'soc' ? REDIRECT_URL_CHAT_SOC_MAIN : REDIRECT_URL_CHAT_INS_MAIN;
    }
}

/**
 * Shows the experiment complete overlay and sets the manual redirect link.
 */
function showExperimentCompleteOverlayAndSetLink() {
  const overlay = document.getElementById('experiment-complete-overlay')!;
  overlay.style.display = 'flex'; // Ensure it's visible

  const manualRedirectLink = document.getElementById('manualRedirectLink') as HTMLAnchorElement | null;
  
  const storedMode  = localStorage.getItem('experimentRedirectMode') as Mode | null;
  const storedStyle = localStorage.getItem('experimentRedirectStyle') as Style | null;

  if (manualRedirectLink && storedMode && storedStyle) {
    manualRedirectLink.href = getRedirectUrlForBanner(storedMode, storedStyle);
  } else if (manualRedirectLink) {
    console.warn('Experiment done, but redirect mode/style not found for manualRedirectLink. Using default href (#).');
    manualRedirectLink.href = '#'; // Fallback
  }
  // Hide main UI sections to prevent interaction
  avatarUI.classList.add('hidden');
  chatUI.classList.add('hidden');
  const floatingTags = document.getElementById('floatingTagsContainer');
  if (floatingTags) floatingTags.style.display = 'none'; // Hide floating tags too
  if (consentOverlayGlobal) consentOverlayGlobal.classList.add('hidden'); // Ensure consent is hidden if it wasn't removed
  document.body.style.overflow = ''; // Allow scrolling if needed for the banner's content
}


/* ─────────── on load ─────────── */
// Behalte die ursprüngliche Struktur von DOMContentLoaded bei
window.addEventListener('DOMContentLoaded', () => {
  // Holen Sie sich das Consent-Overlay-Element hier, falls es nicht global ist
  const localConsentOverlay = document.getElementById('consent-overlay')!; // Verwenden Sie localConsentOverlay
  const params = new URLSearchParams(window.location.search);

  if (params.get('reset') === '1') {
    localStorage.removeItem('experimentDone');
    localStorage.removeItem('experimentRedirectMode');
    localStorage.removeItem('experimentRedirectStyle');
    console.log('Experiment-Status zurückgesetzt');
    // window.history.replaceState({}, document.title, window.location.pathname); // Optional
  }

  if (localStorage.getItem('experimentDone') === 'true') {
    showExperimentCompleteOverlayAndSetLink();
    return; // Wichtig: Stoppt weitere Initialisierung, wenn Experiment abgeschlossen ist
  }

  // Ursprüngliche Consent-Logik
  localConsentOverlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  // Ursprüngliche Floating-Tags-Logik
  const floatingTagsContainer = document.getElementById('floatingTagsContainer');
  if (floatingTagsContainer) {
    const tagWrappers = floatingTagsContainer.querySelectorAll<HTMLElement>('.tag-wrapper');
    const closeAllTags = () => tagWrappers.forEach(tw => tw.classList.remove('open'));

    tagWrappers.forEach(wrapper => {
      wrapper.addEventListener('click', (event) => {
        const target = event.currentTarget as HTMLElement;
        const isLink = target.tagName === 'A' && (target as HTMLAnchorElement).href !== '#' && !!(target as HTMLAnchorElement).href;
        if (!isLink || (isLink && (target as HTMLAnchorElement).getAttribute('href') === '#')) {
          event.preventDefault();
          event.stopPropagation();
        }
        const wasOpen = wrapper.classList.contains('open');
        closeAllTags();
        if (!wasOpen) wrapper.classList.add('open');
      });
    });

    document.body.addEventListener('click', (event) => {
       // Überprüfen, ob der Klick außerhalb des gesamten Containers für schwebende Tags oder auf einem Tag-Wrapper erfolgt ist
      if (floatingTagsContainer.contains(event.target as Node)) {
          if (!Array.from(tagWrappers).some(tw => tw.contains(event.target as Node))) {
            // Klick ist im Container, aber nicht auf einem Wrapper (z.B. zwischen den Tags)
            closeAllTags();
          }
      } else {
          // Klick ist vollständig außerhalb des Containers
          closeAllTags();
      }
    });
  }

  // Ursprüngliche Consent-Accept-Logik
  document.getElementById('consent-accept')?.addEventListener('click', () => {
    if (localStorage.getItem('experimentDone') === 'true') { // Double check
      showExperimentCompleteOverlayAndSetLink();
      return;
    }
    localConsentOverlay.remove(); // Oder localConsentOverlay.classList.add('hidden');
    document.body.style.overflow = '';
    initApp();
  });

  // Ursprüngliche Topbar-Logik
  const topbar = document.querySelector<HTMLElement>('.topbar');
  if (topbar) {
    const navWrapper = topbar.querySelector<HTMLElement>('.topbar-nav-wrapper');
    const navInner   = topbar.querySelector<HTMLElement>('.topbar-nav');
    const prevBtn    = topbar.querySelector<HTMLButtonElement>('.topbar-nav-control.prev');
    const nextBtn    = topbar.querySelector<HTMLButtonElement>('.topbar-nav-control.next');

    if (navWrapper && navInner && prevBtn && nextBtn) {
      let allNavItems: HTMLElement[] = [];
      let itemWidths:   number[]    = [];
      let visibleWidth = 0;
      let totalWidth   = 0;
      let gapWidth     = 0;
      let startIndex = 0;
      let endIndex   = -1;

      const updateVisibleItems = () => {
        if (allNavItems.length === 0) { /*visibleCount = 0;*/ return; } // visibleCount nicht verwendet
        let renderedWidth = 0;
        let lastIndex = -1;
        // visibleCount = 0; // visibleCount nicht verwendet
        allNavItems.forEach(item => item.style.display = 'none');
        if (startIndex >= allNavItems.length) {
          startIndex = Math.max(0, allNavItems.length - 1);
        }
        for (let i = startIndex; i < allNavItems.length; i++) {
          // Ihre Original-Logik verwendet visibleCount, um den Abstand für das erste Element zu behandeln
          const width = itemWidths[i] + (lastIndex !== -1 ? gapWidth : 0); // Angepasst, um `visibleCount` zu ähneln
          if (renderedWidth + width <= visibleWidth + 2) {
            allNavItems[i].style.display = '';
            renderedWidth += width;
            lastIndex = i;
            // visibleCount++; // visibleCount nicht verwendet
          } else break;
        }
        endIndex = lastIndex;
      };

      const calculateDimensionsAndRefreshUI = () => {
        allNavItems = Array.from(navInner.children) as HTMLElement[];
        if(allNavItems.length === 0) { // Guard, falls keine Elemente vorhanden sind
            prevBtn.style.display = 'none';
            nextBtn.style.display = 'none';
            return;
        }
        gapWidth = parseInt(getComputedStyle(navInner).gap) || 0;
        itemWidths = []; // Zurücksetzen vor Neuberechnung
        totalWidth = 0; // Zurücksetzen vor Neuberechnung

        allNavItems.forEach((item, idx) => {
          const prevDisplay = item.style.display;
          item.style.display = '';
          itemWidths[idx] = item.offsetWidth;
          // Ihre Original-Logik für totalWidth
          totalWidth += item.offsetWidth + (idx < allNavItems.length - 1 ? gapWidth : 0);
          item.style.display = prevDisplay;
        });

        const padLeft  = parseInt(getComputedStyle(navInner).paddingLeft)  || 0;
        const padRight = parseInt(getComputedStyle(navInner).paddingRight) || 0;
        totalWidth += padLeft + padRight;
        visibleWidth = navWrapper.offsetWidth;

        if (totalWidth <= visibleWidth) {
          navWrapper.classList.remove('has-overflow');
          startIndex = 0;
        } else {
          navWrapper.classList.add('has-overflow');
          // Ihre Original-Logik für startIndex bei Überlauf
          let found = false;
          for (let i = startIndex; i < allNavItems.length && !found; i++) {
            let w = 0, count = 0;
            for (let j = i; j < allNavItems.length; j++) {
              const wi = itemWidths[j] + (count > 0 ? gapWidth : 0); // count > 0 für gap
              if (w + wi <= visibleWidth + 2) { w += wi; count++; }
              else break;
            }
            if (count > 0) { startIndex = i; found = true; }
          }
          if (!found) startIndex = 0; // Fallback
          // Stellen Sie sicher, dass der StartIndex gültig ist, falls die obige Logik ihn außerhalb der Grenzen setzt
           if (startIndex >= allNavItems.length && allNavItems.length > 0) {
             startIndex = allNavItems.length - 1;
           } else if (startIndex < 0) {
               startIndex = 0;
           }
        }
        updateVisibleItems();
        updateButtonStates();
      };

      const updateButtonStates = () => {
        const noOverflow = totalWidth <= visibleWidth;
        prevBtn.style.display = noOverflow ? 'none' : 'flex';
        nextBtn.style.display = noOverflow ? 'none' : 'flex';
        prevBtn.disabled = startIndex === 0;
        nextBtn.disabled = endIndex >= allNavItems.length - 1 || endIndex === -1; // endIndex === -1 bedeutet, dass nichts sichtbar ist
      };

      const moveToNext = () => {
        if (nextBtn.disabled) return;
        // Ihre Original-Logik für moveToNext
        startIndex = Math.min(startIndex + 1, allNavItems.length - 1);
        updateVisibleItems();
        // Die folgende Logik ist aus Ihrer Originaldatei, wenn visibleCount 0 ist
        if (endIndex === -1 && startIndex > 0) { // Angepasst, um endIndex zu verwenden
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

      const moveToPrev = () => {
        if (prevBtn.disabled) return;
        startIndex = Math.max(0, startIndex - 1);
        updateVisibleItems();
        updateButtonStates();
      };

      nextBtn.addEventListener('click', moveToNext);
      prevBtn.addEventListener('click', moveToPrev);
      window.addEventListener('resize', calculateDimensionsAndRefreshUI);
      setTimeout(calculateDimensionsAndRefreshUI, 100); // Ihre Original-Verzögerung
    }
  }
});

/**
 * Starte Anwendung nach Zustimmung des Nutzers
 */
function initApp() {
  const params = new URLSearchParams(location.search);
  // Beachten Sie, dass currentMode/currentStyle hier currentAppMode/currentAppStyle heißen
  const initialMode  = (params.get('mode')  ?? 'avatar') as Mode;
  const initialStyle = (params.get('style') ?? 'soc')    as Style;

  if (localStorage.getItem('experimentDone') === 'true') {
    showExperimentCompleteOverlayAndSetLink();
    return;
  }

  setMode(initialMode, initialStyle);
  // Die mode-avatar-Klasse wird jetzt in setMode umgeschaltet
  // document.body.classList.toggle('mode-avatar', initialMode === 'avatar');
}

/**
 * Wechsel zwischen Avatar- und Chat-Modus und lade benötigte Module
 */
async function setMode(mode: Mode, style: Style) {
  // Überprüfen, ob das Experiment abgeschlossen ist, bevor der Modus geändert wird
  if (localStorage.getItem('experimentDone') === 'true') {
      showExperimentCompleteOverlayAndSetLink();
      return;
  }

  if (mode === currentAppMode && style === currentAppStyle) return;
  
  if (typeof cleanup === 'function') {
    await cleanup();
  }

  document.body.classList.toggle('mode-avatar', mode === 'avatar');
  document.body.classList.toggle('mode-chat',   mode === 'chat');

  if (mode === 'chat') {
    avatarUI.classList.add('hidden');
    chatUI.classList.remove('hidden');
    const { startChatbot, stopChatbot } = await import('./features/chatbot');
    cleanup = stopChatbot;
    startChatbot(style);
  } else { // mode === 'avatar'
    chatUI.classList.add('hidden');
    avatarUI.classList.remove('hidden');
    const { startAvatar, stopAvatar } = await import('./features/avatar');
    cleanup = stopAvatar;
    startAvatar(style);
  }

  currentAppMode  = mode;
  currentAppStyle = style;

  // Update active link in topbar (Original-Logik)
  document.querySelectorAll<HTMLAnchorElement>('.topbar-nav a').forEach(link => {
    const linkMode  = link.dataset.mode as Mode | undefined;
    const linkStyleFromData = link.dataset.style as Style| undefined; // Verwenden Sie einen anderen Namen als 'style'
    let isActive = false;
    // Ihre Original-Logik für isActive
    if (linkMode === currentAppMode) {
        isActive = linkStyleFromData ? linkStyleFromData === currentAppStyle : true;
    }
    link.classList.toggle('active', isActive);
  });
}

// Event listener für Topbar-Links (Original-Logik)
document.querySelectorAll<HTMLAnchorElement>('.topbar-nav a[data-mode]').forEach(link => {
  link.addEventListener('click', (e) => {
    const targetMode = link.dataset.mode as Mode | undefined;
    let targetStyle  = link.dataset.style as Style| undefined; // Hier ist 'style' okay, da es lokal ist
    if (!targetMode) return;
    e.preventDefault();
    // Ihre Original-Fallback-Logik für targetStyle
    if (!targetStyle) {
        targetStyle = (targetMode === currentAppMode && currentAppStyle) ? currentAppStyle : 'soc';
    }
    setMode(targetMode, targetStyle);
  });
});

// Globale Vibrate-Funktion (Original-Logik)
function vibrate() {
  if ('vibrate' in navigator) {
    const success = navigator.vibrate(100); // success wird in Ihrer Originaldatei verwendet
    console.log("Vibration gestartet:", success); // Behalten Sie dies bei, wenn Sie es verwenden
  } else {
    console.warn("Vibration wird nicht unterstützt");
  }
}
(window as any).vibrate = vibrate;