import './style.css';

type Mode = 'avatar' | 'chat';
type Style = 'soc' | 'ins';

const avatarUI = document.getElementById('avatar-ui')!;
const chatUI = document.getElementById('chat-ui')!;

let currentMode: Mode | null = null;
let currentStyle: Style | null = null;
let cleanup: () => Promise<void> | void = () => {};

/* ─────────── on load ─────────── */
window.addEventListener('DOMContentLoaded', () => {
  const overlay = document.getElementById('consent-overlay')!;
  const params = new URLSearchParams(window.location.search);

  if (params.get('reset') === '1') {
    localStorage.removeItem('experimentDone');
    console.log('Experiment-Status zurückgesetzt');
  }

  if (localStorage.getItem('experimentDone') === 'true') {
    document.getElementById('experiment-complete-overlay')!.style.display = 'flex';
    return;
  }

  overlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  const floatingTagsContainer = document.getElementById('floatingTagsContainer');
  if (floatingTagsContainer) {
    const tagWrappers = floatingTagsContainer.querySelectorAll<HTMLElement>('.tag-wrapper');
    const closeAllTags = () => tagWrappers.forEach(tw => tw.classList.remove('open'));
    tagWrappers.forEach(wrapper => {
      wrapper.addEventListener('click', (event) => {
        const targetElement = event.currentTarget as HTMLElement;
        const isLink = targetElement.tagName === 'A' && (targetElement as HTMLAnchorElement).href && (targetElement as HTMLAnchorElement).href !== '#';
        if (!isLink || (isLink && (targetElement as HTMLAnchorElement).getAttribute('href') === '#')) {
            event.preventDefault(); event.stopPropagation();
        }
        const wasOpen = wrapper.classList.contains('open');
        closeAllTags();
        if (!wasOpen) wrapper.classList.add('open');
      });
    });
    document.body.addEventListener('click', (event) => {
      if (!Array.from(tagWrappers).some(tw => tw.contains(event.target as Node))) {
        closeAllTags();
      }
    });
  }

  document.getElementById('consent-accept')?.addEventListener('click', () => {
    if (localStorage.getItem('experimentDone') === 'true') {
      document.getElementById('experiment-complete-overlay')!.style.display = 'flex';
      return;
    }
    overlay.remove();
    document.body.style.overflow = '';
    initApp();
  });

  setBrowserAndDeviceSpecificStyles(); // Funktion aufrufen

  const topbarElement = document.querySelector<HTMLElement>('.topbar');
  if (topbarElement) {
    const navWrapper = topbarElement.querySelector<HTMLElement>('.topbar-nav-wrapper');
    const navInner = topbarElement.querySelector<HTMLElement>('.topbar-nav');
    const prevButton = topbarElement.querySelector<HTMLButtonElement>('.topbar-nav-control.prev');
    const nextButton = topbarElement.querySelector<HTMLButtonElement>('.topbar-nav-control.next');

    if (navWrapper && navInner && prevButton && nextButton) {
        let allNavItems: HTMLElement[] = [];
        let itemWidths: number[] = [];
        let visibleWrapperWidth = 0;
        let totalContentWidth = 0;
        let gapBetweenItems = 0;

        let currentStartIndex = 0;
        let lastVisibleItemIndex = -1; // Index des *tatsächlich* letzten sichtbaren Elements
        let currentlyVisibleItemsCount = 0; // Anzahl der aktuell sichtbaren Elemente

        const updateVisibleItems = () => {
            if (allNavItems.length === 0) {
                currentlyVisibleItemsCount = 0;
                return;
            }

            let currentRenderedWidthOnPage = 0;
            let tempLastVisibleIndex = -1;
            currentlyVisibleItemsCount = 0;

            allNavItems.forEach(item => item.style.display = 'none');

            if (currentStartIndex >= allNavItems.length && allNavItems.length > 0) {
                currentStartIndex = Math.max(0, allNavItems.length -1); // Fallback
            }

            for (let i = currentStartIndex; i < allNavItems.length; i++) {
                const item = allNavItems[i];
                const itemActualWidth = itemWidths[i];
                const widthWithGap = itemActualWidth + (currentlyVisibleItemsCount > 0 ? gapBetweenItems : 0);

                if (currentRenderedWidthOnPage + widthWithGap <= visibleWrapperWidth + 2) {
                    item.style.display = '';
                    currentRenderedWidthOnPage += widthWithGap;
                    tempLastVisibleIndex = i;
                    currentlyVisibleItemsCount++;
                } else {
                    break;
                }
            }
            lastVisibleItemIndex = tempLastVisibleIndex; // Aktualisiere den globalen Index
        };

        const calculateDimensionsAndRefreshUI = () => {
            if (!navInner || !navWrapper) return;

            allNavItems = Array.from(navInner.children) as HTMLElement[];
            if (allNavItems.length === 0) {
                totalContentWidth = 0; // Wichtig für updateButtonStates
                updateVisibleItems(); // Setzt currentlyVisibleItemsCount auf 0
                updateButtonStates();
                return;
            }

            gapBetweenItems = parseInt(getComputedStyle(navInner).gap || '0');
            itemWidths = [];
            totalContentWidth = 0;

            allNavItems.forEach((item, index) => {
                const originalDisplay = item.style.display;
                if (originalDisplay === 'none') item.style.display = '';
                itemWidths.push(item.offsetWidth);
                totalContentWidth += item.offsetWidth;
                if (originalDisplay === 'none') item.style.display = 'none';
                if (index < allNavItems.length - 1) {
                    totalContentWidth += gapBetweenItems;
                }
            });
            const innerPaddingLeft = parseInt(getComputedStyle(navInner).paddingLeft || '0');
            const innerPaddingRight = parseInt(getComputedStyle(navInner).paddingRight || '0');
            totalContentWidth += innerPaddingLeft + innerPaddingRight;

            visibleWrapperWidth = navWrapper.offsetWidth;

            if (totalContentWidth <= visibleWrapperWidth) {
                navWrapper.classList.remove('has-overflow');
                currentStartIndex = 0;
            } else {
                navWrapper.classList.add('has-overflow');
                // Beim Resize: Versuchen, currentStartIndex so anzupassen, dass möglichst viele
                // der zuvor sichtbaren Elemente sichtbar bleiben, beginnend mit dem alten currentStartIndex.
                // Diese Logik kann sehr komplex werden. Eine einfache Neuberechnung:
                let newCalculatedStartIndex = currentStartIndex; // Behalte alten Start bei, wenn möglich
                let foundValidStartIndex = false;
                for (let i = currentStartIndex; i < allNavItems.length; i++) {
                    let pageTempWidth = 0;
                    let itemsOnThisPotentialPage = 0;
                    for (let j = i; j < allNavItems.length; j++) {
                        const itemW = itemWidths[j] + (itemsOnThisPotentialPage > 0 ? gapBetweenItems : 0);
                        if (pageTempWidth + itemW <= visibleWrapperWidth +2) {
                            pageTempWidth += itemW;
                            itemsOnThisPotentialPage++;
                        } else {
                            break;
                        }
                    }
                    if (itemsOnThisPotentialPage > 0) { // Es passt mindestens ein Item ab hier
                        newCalculatedStartIndex = i;
                        foundValidStartIndex = true;
                        break;
                    }
                }
                if (!foundValidStartIndex && allNavItems.length > 0) { // Wenn vom alten Start nichts passt, von vorne
                    currentStartIndex = 0;
                } else if (foundValidStartIndex) {
                    currentStartIndex = newCalculatedStartIndex;
                }

            }
             if(currentStartIndex >= allNavItems.length) currentStartIndex = Math.max(0, allNavItems.length -1);


            updateVisibleItems();
            updateButtonStates();
        };

        const updateButtonStates = () => {
            if (!prevButton || !nextButton ) return;
             if (allNavItems.length === 0 || totalContentWidth <= visibleWrapperWidth) {
                prevButton.style.display = 'none';
                nextButton.style.display = 'none';
                prevButton.disabled = true;
                nextButton.disabled = true;
            } else {
                prevButton.style.display = 'flex';
                nextButton.style.display = 'flex';
                prevButton.disabled = currentStartIndex === 0;
                // Next Button ist disabled, wenn das (global) letzte sichtbare Item auch das letzte aller Items ist.
                nextButton.disabled = lastVisibleItemIndex >= allNavItems.length - 1;
            }
        };

        const moveToNext = () => {
            if (nextButton.disabled) return;

            // Neuer Startindex ist der Index des zweiten Elements der aktuellen Ansicht.
            // Wenn nur ein Element sichtbar war, ist der neue Start der Index des Elements
            // direkt nach dem aktuell (einzigen) sichtbaren.
            let newStartIndex = currentStartIndex + 1;

            if (newStartIndex > allNavItems.length - 1) {
                // Sollte durch nextButton.disabled verhindert werden, aber als Sicherheit
                newStartIndex = allNavItems.length - 1;
            }
            // Stelle sicher, dass der newStartIndex nicht dazu führt, dass weniger Items als vorher angezeigt werden,
            // es sei denn, wir sind am Ende.
            // Wir wollen, dass das (ehemals) zweite Element das erste wird.
            // Die Logik wird nun sein, den startIndex so zu wählen, dass das nächste Element
            // rechts vom aktuellen *Sichtbereich* das erste wird.
            // Das ist komplizierter als "nächstes Item".
            // Die einfachere Variante gemäß deiner Beschreibung:
            // Wenn "Wissen A-Z" rausfliegt (war erstes), soll das nächste Element rechts davon das erste werden.
            if (currentlyVisibleItemsCount > 0 && currentStartIndex < allNavItems.length -1) {
                 currentStartIndex = currentStartIndex +1; // Das ehemals zweite (oder erste + 1) wird das neue erste.
            } else if (currentlyVisibleItemsCount === 0 && currentStartIndex < allNavItems.length -1) {
                // Nichts war sichtbar, aber wir sind nicht am Ende -> versuche nächstes
                currentStartIndex++;
            }
            // Am Ende sicherstellen, dass nicht über das Ende hinausgegangen wird
            currentStartIndex = Math.min(currentStartIndex, allNavItems.length - 1);

            updateVisibleItems();

            // Wenn nach dem Verschieben nach rechts keine Elemente mehr angezeigt werden könnten
            // (z.B. das letzte Element ist zu breit), dann müssen wir evtl. zurückspringen.
            // Aber updateButtonStates sollte das eigentlich abfangen.
            if (currentlyVisibleItemsCount === 0 && currentStartIndex > 0) {
                // Dieser Fall sollte idealerweise nicht eintreten, wenn Buttons korrekt sind.
                // Es bedeutet, wir sind nach rechts gesprungen und nichts passt.
                // Versuche, zum letzten möglichen Startpunkt zurückzuspringen.
                let lastPossibleStart = 0;
                for (let i = allNavItems.length - 1; i >= 0; i--) {
                    let tempWidth = 0;
                    let canFit = false;
                    for (let j = i; j < allNavItems.length; j++) {
                        const itemW = itemWidths[j] + ( (j > i) ? gapBetweenItems : 0);
                        if (tempWidth + itemW <= visibleWrapperWidth + 2) {
                            tempWidth += itemW;
                            canFit = true;
                        } else {
                            break;
                        }
                    }
                    if (canFit) {
                        lastPossibleStart = i;
                        break;
                    }
                }
                currentStartIndex = lastPossibleStart;
                updateVisibleItems();
            }
            updateButtonStates();
        };

        const moveToPrev = () => {
            if (prevButton.disabled) return;

            // Ziel: Das Element, das *vor* dem aktuellen currentStartIndex liegt,
            // soll das *erste* Element der neuen Ansicht werden, wenn möglich.
            // Oder, um deine Logik "das rechte Element raus, das ganz linke wieder rein" zu treffen:
            // Wir wollen, dass das Element, das *vor* dem aktuellen currentStartIndex liegt,
            // das neue *erste* sichtbare Element wird.
            if (currentStartIndex > 0) {
                currentStartIndex = currentStartIndex - 1;
            }

            currentStartIndex = Math.max(0, currentStartIndex); // Nicht unter 0 gehen

            updateVisibleItems();
            updateButtonStates();
        };

        nextButton.addEventListener('click', moveToNext);
        prevButton.addEventListener('click', moveToPrev);
        window.addEventListener('resize', calculateDimensionsAndRefreshUI);

        setTimeout(() => {
            calculateDimensionsAndRefreshUI();
        }, 100);
    }
  }

});

function initApp() {
  const p = new URLSearchParams(location.search);
  const initialMode  = (p.get('mode')  ?? 'avatar') as Mode;
  const initialStyle = (p.get('style') ?? 'soc')    as Style;
  if (localStorage.getItem('experimentDone') === 'true') {
    document.getElementById('experiment-complete-overlay')!.style.display = 'flex';
    return;
  }
  setMode(initialMode, initialStyle);
  document.body.classList.toggle('mode-avatar', initialMode === 'avatar');
}

async function setMode(mode: Mode, style: Style) {
  if (mode === currentMode && style === currentStyle) return;
  await cleanup();
  document.body.classList.toggle('mode-avatar', mode === 'avatar');
  document.body.classList.toggle('mode-chat', mode === 'chat');

  if (mode === 'chat') {
    avatarUI.classList.add('hidden');
    chatUI.classList.remove('hidden');
    const mod = await import('./features/chatbot');
    cleanup = mod.stopChatbot;
    mod.startChatbot(style);
  } else {
    chatUI.classList.add('hidden');
    avatarUI.classList.remove('hidden');
    const mod = await import('./features/avatar');
    cleanup = mod.stopAvatar;
    mod.startAvatar(style);
  }
  currentMode  = mode;
  currentStyle = style;
  document.querySelectorAll<HTMLAnchorElement>('.topbar-nav a').forEach(link => {
    const linkMode = link.dataset.mode as Mode | undefined;
    const linkStyle = link.dataset.style as Style | undefined;
    let isActive = false;
    if (linkMode === currentMode) isActive = linkStyle ? linkStyle === currentStyle : true;
    link.classList.toggle('active', isActive);
  });
}

function setBrowserAndDeviceSpecificStyles(): void {
  const userAgent = navigator.userAgent.toLowerCase();
  const rootStyle = document.documentElement.style;

  // Einfache Prüfung auf ein Mobilgerät (nicht 100% narrensicher, aber oft ausreichend)
  // Man könnte auch auf Bildschirmbreite prüfen, aber User Agent ist hier oft gezielter
  // für Browser-spezifische Rendering-Unterschiede auf Mobilgeräten.
  const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);

  let chatbotHeightVhPart: string; // Wir ändern nur den vh-Teil für Smartphones

  if (isMobile) {
    console.log("Mobile device detected.");
    if (userAgent.includes("firefox")) {
      chatbotHeightVhPart = '85vh'; // Firefox auf Smartphone
      console.log("Mobile Firefox, setting height to 80vh");
    } else if (userAgent.includes("edg/") || userAgent.includes("edge/")) {
      chatbotHeightVhPart = '83vh'; // Edge auf Smartphone
      console.log("Mobile Edge, setting height to 80vh");
    } else if (userAgent.includes("safari") && !userAgent.includes("chrome") && !userAgent.includes("crios") && !userAgent.includes("fxios")) {
      // Safari auf iOS (nicht Chrome oder Firefox für iOS, die andere UAs haben)
      chatbotHeightVhPart = '74vh'; // Safari auf Smartphone
      console.log("Mobile Safari, setting height to 75vh");
    } else if (userAgent.includes("chrome") || userAgent.includes("crios")) {
      // Chrome (Android oder iOS - crios)
      chatbotHeightVhPart = '73vh'; // Chrome auf Smartphone
      console.log("Mobile Chrome, setting height to 73vh");
    } else {
      // Fallback für andere mobile Browser, nimm den allgemeinen mobilen Chrome-Wert oder einen Standard
      chatbotHeightVhPart = '73vh';
      console.log("Other mobile browser, defaulting to 73vh");
    }
    // Aktualisiere die CSS-Variable mit dem neuen vh-Wert, behalte min/max bei
    // Wichtig: Die min/max Werte im clamp müssen ggf. auch angepasst werden,
    // wenn die vh-Werte stark abweichen, damit clamp noch sinnvoll funktioniert.
    // Hier vereinfacht, nur den vh-Teil zu ändern:
    rootStyle.setProperty('--chatbot-card-height-mobile', `clamp(400px, ${chatbotHeightVhPart}, 780px)`);

  } else {
    // Für Desktop-Browser könntest du hier eine andere Logik haben
    // oder einfach den Standardwert aus dem CSS :root belassen.
    // Für dieses Beispiel belassen wir es beim CSS-Standard für Desktop.
    console.log("Desktop device or unhandled mobile, using default CSS height.");
    // Optional: Explizit den Standardwert setzen, falls nötig.
    // rootStyle.setProperty('--chatbot-card-height', 'clamp(400px, 73vh, 780px)');
  }
}

document.querySelectorAll<HTMLAnchorElement>('.topbar-nav a[data-mode]').forEach(link => {
  link.addEventListener('click', (e) => {
    const targetMode = link.dataset.mode as Mode | undefined;
    let targetStyle = link.dataset.style as Style | undefined;
    if (targetMode) {
      e.preventDefault();
      if (!targetStyle) targetStyle = (targetMode === currentMode && currentStyle) ? currentStyle : 'soc';
      setMode(targetMode, targetStyle);
    }
  });
});