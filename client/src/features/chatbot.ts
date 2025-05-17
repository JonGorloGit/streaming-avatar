const API_BASE = import.meta.env.VITE_API_BASE || '';

type Style = 'soc' | 'ins';
type Role  = 'user' | 'assistant';

interface ChatMsg {
  role   : Role;
  content: string;
}

// Behalte Referenzen auf UI-Elemente und aktuellen Zustand für Neustarts
let sendBtn : HTMLButtonElement;
let inputEl : HTMLTextAreaElement;
let bodyEl  : HTMLElement;

let style       : Style;
let conversation: ChatMsg[] = [];

let progress      = 0;
const MAX_PROGRESS = 5;

/**
 * Aktualisiert Fortschrittsanzeige mit Kreis und Text.
 * Zeigt nach Erreichen des Limits einen Countdown bis Abschluss.
 */
function updateChatProgress() {
  const el = document.getElementById('chat-progress');
  if (!el) return;
  const circle = el.querySelector('.circle') as SVGPathElement;
  const text   = el.querySelector('.progress-text')!;

  // Prozentuelle Darstellung basierend auf aktuellem Fortschritt
  const percent = (progress / MAX_PROGRESS) * 100;
  text.textContent = progress < MAX_PROGRESS ? `${progress}/${MAX_PROGRESS}` : '✓';
  circle.style.strokeDashoffset = (100 - percent).toString();

  // Sobald volles Fortschrittsziel erreicht ist, starte Timer bis Experimentabschluss
  if (progress === MAX_PROGRESS) {
    let seconds = 15;
    text.textContent = `${seconds}s`;

    const countdown = setInterval(() => {
      seconds--;
      text.textContent = seconds > 0 ? `${seconds}s` : '✓';

      if (seconds === 0) {
        clearInterval(countdown);
        // Markiere Experiment als abgeschlossen und zeige Abschluss-Overlay
        localStorage.setItem('experimentDone', 'true');
        document.getElementById('experiment-complete-overlay')!.style.display = 'flex';
      }
    }, 1000);
  }
}

/**
 * Initialisiert Chatbot mit ausgewähltem Stil und zeigt Willkommensnachricht.
 */
export function startChatbot(selectedStyle: Style) {
  style        = selectedStyle;
  conversation = [];
  progress     = 0;
  updateChatProgress();  // Setze Fortschrittsanzeige zurück

  // Element-Referenzen aufbauen
  sendBtn = document.getElementById('chat-send')  as HTMLButtonElement;
  inputEl = document.getElementById('chat-input') as HTMLTextAreaElement;
  bodyEl  = document.getElementById('chatbot-body')!;

  // Auto-Resize aktivieren, um Textarea-Höhe dynamisch an Inhalt anzupassen
  ['input','keyup','change'].forEach(evt =>
    inputEl.addEventListener(evt as any, autoResize)
  );
  inputEl.addEventListener('keydown', onKeyPress);
  window.addEventListener('resize', autoResize);
  window.addEventListener('orientationchange', autoResize);
  sendBtn.onclick = onSend;

  // Mobile: Scroll-Inputfeld in Sicht bringen, wenn Fokus
  inputEl.addEventListener('focus', () => {
    setTimeout(() => inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
  });

  autoResize();

  // Unterschiedliche Begrüßung je nach Stil
  const welcomeMessage = style === 'soc'
    ? 'Hallo! Schön, dass du da bist. Ich bin hier um dich zu unterstützen. Was beschäftigt dich gerade am meisten?'
    : 'Willkommen. Bitte geben Sie Ihr Anliegen ein.';

  showTypingMessage(welcomeMessage);
  conversation.push({ role: 'assistant', content: welcomeMessage });
}

/**
 * Stoppt Chatbot und bereinigt alle Event-Listener und Nachrichten.
 */
export function stopChatbot() {
  sendBtn.onclick = null;
  inputEl.value = '';
  inputEl.removeEventListener('input', autoResize);
  inputEl.removeEventListener('keydown', onKeyPress);
  bodyEl.innerHTML = '';

  conversation = [];
  progress = 0;
  updateChatProgress();
}

/**
 * Passt Höhe des Eingabefeldes an, um Text vollständig anzuzeigen.
 */
function autoResize() {
  requestAnimationFrame(() => {
    inputEl.style.height = 'auto';
    // Begrenze Höhe auf 30% des Viewports, um Platz für Chatverlauf zu sichern
    const maxH = Math.min(window.innerHeight, document.documentElement.clientHeight) * 0.3;
    const newH = Math.min(inputEl.scrollHeight, maxH);
    inputEl.style.height = `${newH}px`;
  });
}

/**
 * Sendet Nachricht bei Enter (ohne Shift), verhindert Zeilenumbruch.
 */
function onKeyPress(ev: KeyboardEvent) {
  if (ev.key === 'Enter' && !ev.shiftKey) {
    ev.preventDefault();
    sendBtn.click();
  }
}

/**
 * Sendet Eingabe an API, steuert Typing-Animation und Fortschritt.
 */
async function onSend() {
  const txt = inputEl.value.trim();
  if (!txt) return;

  append('user', txt);
  inputEl.value = '';
  autoResize();
  inputEl.focus();
  sendBtn.disabled = true;

  // Mobile UX: Keyboard verstecken und Chat nach oben scrollen
  inputEl.blur();
  window.scrollTo({ top: 0, behavior: 'smooth' });

  const [typingEl, stopTyping] = startTypingAnimation();
  const minDelay = new Promise(res => setTimeout(res, 2000));

  try {
    // Simultanes Warten auf API-Antwort und Mindestwartezeit
    const [response] = await Promise.all([
      fetch(`${API_BASE}/api/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: txt, history: conversation, style }),
      }).then(r => r.json()).then(r => r.response),
      minDelay,
    ]);

    stopTyping();
    stopTypingAnimation(typingEl, response);

    // Protokolliere Benutzer- und Bot-Nachricht
    conversation.push({ role: 'user', content: txt });
    conversation.push({ role: 'assistant', content: response });

    // Erhöhe Fortschritt bis Limit und aktualisiere Anzeige
    if (progress < MAX_PROGRESS) {
      progress++;
      updateChatProgress();
    }

    // Begrenze Gesprächslänge, um Speicherbedarf zu kontrollieren
    if (conversation.length > 10) {
      conversation.splice(0, conversation.length - 10);
    }
  } catch (err) {
    console.error(err);
    stopTyping();
    stopTypingAnimation(typingEl, '⚠️ Server-Fehler');
  } finally {
    sendBtn.disabled = false;
  }
}

/**
 * Fügt neue Nachricht zum Chat-Container und scrollt nach unten.
 */
function append(sender: Role, text: string) {
  const el = document.createElement('article');
  el.className = `message ${sender === 'assistant' ? 'bot' : 'user'}`;
  el.textContent = text;
  bodyEl.appendChild(el);
  // Stelle sicher, dass neueste Nachricht sichtbar ist
  bodyEl.scrollTo({ top: bodyEl.scrollHeight, behavior: 'smooth' });
}

/**
 * Zeigt anhaltende Tipp-Animation mit Punkten, bis stop-Funktion aufgerufen wird.
 */
function startTypingAnimation(): [HTMLElement, () => void] {
  const el = document.createElement('article');
  el.className = 'message bot typing';
  el.textContent = '•';
  bodyEl.appendChild(el);
  bodyEl.scrollTo({ top: bodyEl.scrollHeight, behavior: 'smooth' });

  const symbols = ['•  ', '•• ', '•••'];
  let i = 0;
  const interval = setInterval(() => {
    el.textContent = symbols[i % symbols.length];
    i++;
  }, 300);

  return [el, () => clearInterval(interval)];
}

/**
 * Ersetzt Tipp-Animation durch endgültigen Text und blendet ihn ein.
 */
function stopTypingAnimation(el: HTMLElement, finalText: string) {
  el.classList.remove('typing');
  el.textContent = finalText;
  el.classList.add('fade-in');
  bodyEl.scrollTo({ top: bodyEl.scrollHeight, behavior: 'smooth' });
}

/**
 * Kombiniert Typing-Animation und verzögertes Anzeigen einer festen Nachricht.
 */
function showTypingMessage(finalText: string, delay = 2000) {
  const [el, stopTyping] = startTypingAnimation();
  setTimeout(() => {
    stopTyping();
    stopTypingAnimation(el, finalText);
  }, delay);
}