import './style.css';

type Mode = 'avatar' | 'chat';
type Style = 'soc' | 'ins';

const avatarUI = document.getElementById('avatar-ui')!;
const chatUI = document.getElementById('chat-ui')!;
const consentOverlayGlobal = document.getElementById('consent-overlay')!;

let currentAppMode: Mode | null = null;
let currentAppStyle: Style | null = null;
let cleanup: () => Promise<void> | void = async () => {};

// ----- WICHTIG: Diese URLs müssen jetzt auf deine SoSci Survey Instanz zeigen! -----
// Fallback-URLs, falls VITE-Variablen nicht gesetzt sind.
const FALLBACK_SOSCI_SURVEY_URL = 'https://www.soscisurvey.de/digital_HR_agents/';

const REDIRECT_URL_AVATAR_SOC_MAIN = import.meta.env.VITE_REDIRECT_URL_AVATAR_SOC || FALLBACK_SOSCI_SURVEY_URL;
const REDIRECT_URL_AVATAR_INS_MAIN = import.meta.env.VITE_REDIRECT_URL_AVATAR_INS || FALLBACK_SOSCI_SURVEY_URL;
const REDIRECT_URL_CHAT_SOC_MAIN = import.meta.env.VITE_REDIRECT_URL_CHAT_SOC || FALLBACK_SOSCI_SURVEY_URL;
const REDIRECT_URL_CHAT_INS_MAIN = import.meta.env.VITE_REDIRECT_URL_CHAT_INS || FALLBACK_SOSCI_SURVEY_URL;

// Schlüssel für LocalStorage
const SURVEY_REDIRECT_TOKEN_KEY = 'surveyRedirectToken';
const SURVEY_CASE_NUMBER_KEY = 'surveyCaseNumber'; // NEU

/**
 * Hängt die gespeicherten Survey Parameter (Token und CaseNumber) an eine Basis-URL an.
 */
function appendSurveyParamsToUrl(baseUrlString: string): string {
  const token = localStorage.getItem(SURVEY_REDIRECT_TOKEN_KEY);
  const url = new URL(baseUrlString);
  if (token) url.searchParams.append('i', token); // ✅ korrekt
  return url.toString();
}


function getRedirectUrlForBanner(mode: Mode, style: Style): string {
  let baseUrl: string;
  if (mode === 'avatar') {
    baseUrl = style === 'soc' ? REDIRECT_URL_AVATAR_SOC_MAIN : REDIRECT_URL_AVATAR_INS_MAIN;
  } else { // mode === 'chat'
    baseUrl = style === 'soc' ? REDIRECT_URL_CHAT_SOC_MAIN : REDIRECT_URL_CHAT_INS_MAIN;
  }
  return appendSurveyParamsToUrl(baseUrl);
}

function showExperimentCompleteOverlayAndSetLink() {
  const overlay = document.getElementById('experiment-complete-overlay')!;
  overlay.style.display = 'flex';

  const manualRedirectLink = document.getElementById('manualRedirectLink') as HTMLAnchorElement | null;
  
  const storedMode = localStorage.getItem('experimentRedirectMode') as Mode | null;
  const storedStyle = localStorage.getItem('experimentRedirectStyle') as Style | null;

  if (manualRedirectLink && storedMode && storedStyle) {
    manualRedirectLink.href = getRedirectUrlForBanner(storedMode, storedStyle);
  } else if (manualRedirectLink) {
    console.warn('Experiment done, but redirect mode/style not found for manualRedirectLink. Using default SoSci URL.');
    const fallbackSoSciUrl = FALLBACK_SOSCI_SURVEY_URL; 
    manualRedirectLink.href = appendSurveyParamsToUrl(fallbackSoSciUrl);
  }
  avatarUI.classList.add('hidden');
  chatUI.classList.add('hidden');
  const floatingTags = document.getElementById('floatingTagsContainer');
  if (floatingTags) floatingTags.style.display = 'none';
  if (consentOverlayGlobal) consentOverlayGlobal.classList.add('hidden');
  document.body.style.overflow = '';
}

window.addEventListener('DOMContentLoaded', () => {
  const localConsentOverlay = document.getElementById('consent-overlay')!;
  const params = new URLSearchParams(window.location.search);
  const newUrlInstance = new URL(window.location.href); // Für URL-Bereinigung

  // rid (caseToken) aus URL auslesen und speichern
  const redirectTokenFromUrl = params.get('rid');
  if (redirectTokenFromUrl) {
    localStorage.setItem(SURVEY_REDIRECT_TOKEN_KEY, redirectTokenFromUrl);
    console.log('Survey redirect token (rid) stored:', redirectTokenFromUrl);
    newUrlInstance.searchParams.delete('rid');
  }

  // NEU: num (caseNumber) aus URL auslesen und speichern
  const caseNumberFromUrl = params.get('num');
  if (caseNumberFromUrl) {
    localStorage.setItem(SURVEY_CASE_NUMBER_KEY, caseNumberFromUrl);
    console.log('Survey case number (num) stored:', caseNumberFromUrl);
    newUrlInstance.searchParams.delete('num');
  }

  // URL in der Adressleiste bereinigen, falls Parameter gelesen wurden
  if (redirectTokenFromUrl || caseNumberFromUrl) {
    window.history.replaceState({}, document.title, newUrlInstance.toString());
  }
  

  if (params.get('reset') === '1') {
    localStorage.removeItem('experimentDone');
    localStorage.removeItem('experimentRedirectMode');
    localStorage.removeItem('experimentRedirectStyle');
    localStorage.removeItem(SURVEY_REDIRECT_TOKEN_KEY); // Auch Token entfernen beim Reset
    localStorage.removeItem(SURVEY_CASE_NUMBER_KEY);  // Auch CaseNumber entfernen beim Reset
    console.log('Experiment-Status zurückgesetzt');
    const resetUrl = new URL(window.location.href);
    resetUrl.searchParams.delete('reset');
    // Auch rid und num aus der URL entfernen, falls sie nach dem Reset noch da wären
    resetUrl.searchParams.delete('rid');
    resetUrl.searchParams.delete('num');
    window.history.replaceState({}, document.title, resetUrl.toString());
  }

  if (localStorage.getItem('experimentDone') === 'true') {
    showExperimentCompleteOverlayAndSetLink();
    return;
  }

  localConsentOverlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

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
      if (floatingTagsContainer.contains(event.target as Node)) {
        if (!Array.from(tagWrappers).some(tw => tw.contains(event.target as Node))) {
          closeAllTags();
        }
      } else {
        closeAllTags();
      }
    });
  }

  document.getElementById('consent-accept')?.addEventListener('click', () => {
    if (localStorage.getItem('experimentDone') === 'true') {
      showExperimentCompleteOverlayAndSetLink();
      return;
    }
    localConsentOverlay.remove();
    document.body.style.overflow = '';
    initApp();
  });

  const topbar = document.querySelector<HTMLElement>('.topbar');
  if (topbar) {
    const navWrapper = topbar.querySelector<HTMLElement>('.topbar-nav-wrapper');
    const navInner = topbar.querySelector<HTMLElement>('.topbar-nav');
    const prevBtn = topbar.querySelector<HTMLButtonElement>('.topbar-nav-control.prev');
    const nextBtn = topbar.querySelector<HTMLButtonElement>('.topbar-nav-control.next');

    if (navWrapper && navInner && prevBtn && nextBtn) {
      let allNavItems: HTMLElement[] = [];
      let itemWidths: number[] = [];
      let visibleWidth = 0;
      let totalWidth = 0;
      let gapWidth = 0;
      let startIndex = 0;
      let endIndex = -1;

      const updateVisibleItems = () => {
        if (allNavItems.length === 0) return;
        let renderedWidth = 0;
        let lastIndex = -1;
        allNavItems.forEach(item => item.style.display = 'none');
        if (startIndex >= allNavItems.length) {
          startIndex = Math.max(0, allNavItems.length - 1);
        }
        for (let i = startIndex; i < allNavItems.length; i++) {
          const width = itemWidths[i] + (lastIndex !== -1 ? gapWidth : 0);
          if (renderedWidth + width <= visibleWidth + 2) {
            allNavItems[i].style.display = '';
            renderedWidth += width;
            lastIndex = i;
          } else break;
        }
        endIndex = lastIndex;
      };

      const calculateDimensionsAndRefreshUI = () => {
        allNavItems = Array.from(navInner.children) as HTMLElement[];
        if (allNavItems.length === 0) {
          prevBtn.style.display = 'none';
          nextBtn.style.display = 'none';
          return;
        }
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

        const padLeft = parseInt(getComputedStyle(navInner).paddingLeft) || 0;
        const padRight = parseInt(getComputedStyle(navInner).paddingRight) || 0;
        totalWidth += padLeft + padRight;
        visibleWidth = navWrapper.offsetWidth;

        if (totalWidth <= visibleWidth) {
          navWrapper.classList.remove('has-overflow');
          startIndex = 0;
        } else {
          navWrapper.classList.add('has-overflow');
          let found = false;
          for (let i = startIndex; i < allNavItems.length && !found; i++) {
            let w = 0, count = 0;
            for (let j = i; j < allNavItems.length; j++) {
              const wi = itemWidths[j] + (count > 0 ? gapWidth : 0);
              if (w + wi <= visibleWidth + 2) { w += wi; count++; } else break;
            }
            if (count > 0) { startIndex = i; found = true; }
          }
          if (!found) startIndex = 0;
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
        nextBtn.disabled = endIndex >= allNavItems.length - 1 || endIndex === -1;
      };

      const moveToNext = () => {
        if (nextBtn.disabled) return;
        startIndex = Math.min(startIndex + 1, allNavItems.length - 1);
        updateVisibleItems();
        if (endIndex === -1 && startIndex > 0) {
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
      setTimeout(calculateDimensionsAndRefreshUI, 100);
    }
  }
});

function initApp() {
  const params = new URLSearchParams(location.search);
  const initialMode = (params.get('mode') ?? 'avatar') as Mode;
  const initialStyle = (params.get('style') ?? 'soc') as Style;

  if (localStorage.getItem('experimentDone') === 'true') {
    showExperimentCompleteOverlayAndSetLink();
    return;
  }

  setMode(initialMode, initialStyle);
}

async function setMode(mode: Mode, style: Style) {
  if (localStorage.getItem('experimentDone') === 'true') {
    showExperimentCompleteOverlayAndSetLink();
    return;
  }

  if (mode === currentAppMode && style === currentAppStyle) return;
  
  if (typeof cleanup === 'function') {
    await cleanup();
  }

  document.body.classList.toggle('mode-avatar', mode === 'avatar');
  document.body.classList.toggle('mode-chat', mode === 'chat');

  if (mode === 'chat') {
    avatarUI.classList.add('hidden');
    chatUI.classList.remove('hidden');
    const { startChatbot, stopChatbot } = await import('./features/chatbot');
    cleanup = stopChatbot;
    startChatbot(style);
  } else {
    chatUI.classList.add('hidden');
    avatarUI.classList.remove('hidden');
    const { startAvatar, stopAvatar } = await import('./features/avatar');
    cleanup = stopAvatar;
    startAvatar(style);
  }

  currentAppMode = mode;
  currentAppStyle = style;

  document.querySelectorAll<HTMLAnchorElement>('.topbar-nav a').forEach(link => {
    const linkMode = link.dataset.mode as Mode | undefined;
    const linkStyleFromData = link.dataset.style as Style | undefined;
    let isActive = false;
    if (linkMode === currentAppMode) {
      isActive = linkStyleFromData ? linkStyleFromData === currentAppStyle : true;
    }
    link.classList.toggle('active', isActive);
  });
}

document.querySelectorAll<HTMLAnchorElement>('.topbar-nav a[data-mode]').forEach(link => {
  link.addEventListener('click', (e) => {
    const targetMode = link.dataset.mode as Mode | undefined;
    let targetStyle = link.dataset.style as Style | undefined;
    if (!targetMode) return;
    e.preventDefault();
    if (!targetStyle) {
      targetStyle = (targetMode === currentAppMode && currentAppStyle) ? currentAppStyle : 'soc';
    }
    setMode(targetMode, targetStyle);
  });
});

function vibrate() {
  if ('vibrate' in navigator) {
    const success = navigator.vibrate(100);
    console.log("Vibration gestartet:", success);
  } else {
    console.warn("Vibration wird nicht unterstützt");
  }
}
(window as any).vibrate = vibrate;