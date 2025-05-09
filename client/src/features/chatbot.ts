/**
 * Chat-Frontend für den HR-Bot
 * ---------------------------
 * – speichert den Dialog im Browser (conversation[])
 * – zeigt Tippanimation für alle Bot-Antworten
 * – passt Eingabefeld automatisch an
 */

const API_BASE = import.meta.env.VITE_API_BASE || '';

type Style = 'soc' | 'ins';
type Role  = 'user' | 'assistant';

interface ChatMsg {
  role   : Role;
  content: string;
}

/* ---------- Modul-Scoped Variablen ---------- */
let sendBtn : HTMLButtonElement;
let inputEl : HTMLTextAreaElement;
let bodyEl  : HTMLElement;

let style       : Style;
let conversation: ChatMsg[] = [];

/* =========================================================
   Public API
   ========================================================= */
export function startChatbot(selectedStyle: Style) {
  style        = selectedStyle;
  conversation = [];                           // Verlauf leeren

  sendBtn = document.getElementById('chat-send')  as HTMLButtonElement;
  inputEl = document.getElementById('chat-input') as HTMLTextAreaElement;
  bodyEl  = document.getElementById('chatbot-body')!;

  inputEl.addEventListener('input', autoResize);
  inputEl.addEventListener('keydown', onKeyPress);
  sendBtn.onclick = onSend;

  autoResize();

  // Begrüßung je nach Stil
  const welcomeMessage = style === 'soc'
    ? '👋 Hallo! Ich bin dein HR-Assistent. Was kann ich für dich tun?'
    : 'Willkommen. Bitte geben Sie Ihr Anliegen ein.';

  showTypingMessage(welcomeMessage, 1000); // 1 Sekunde Verzögerung
  conversation.push({ role: 'assistant', content: welcomeMessage });
}

export function stopChatbot() {
  if (sendBtn) sendBtn.onclick = null;

  if (inputEl) {
    inputEl.value = '';
    inputEl.removeEventListener('input',   autoResize);
    inputEl.removeEventListener('keydown', onKeyPress);
  }

  if (bodyEl) bodyEl.innerHTML = '';

  conversation = [];
}

/* =========================================================
   Internals
   ========================================================= */
function autoResize() {
  inputEl.style.height = 'auto';
  inputEl.style.height =
    Math.min(inputEl.scrollHeight, window.innerHeight * 0.3) + 'px';
}

function onKeyPress(ev: KeyboardEvent) {
  if (ev.key === 'Enter' && !ev.shiftKey) {
    ev.preventDefault();
    sendBtn.click();
  }
}

/* =========================================================
   Senden + Bot-Antwort mit animiertem „Tippen…“
   ========================================================= */
async function onSend() {
  const txt = inputEl.value.trim();
  if (!txt) return;

  append('user', txt);
  inputEl.value = '';
  autoResize();
  inputEl.focus();
  sendBtn.disabled = true;

  // Tippanimation sofort starten
  const typingEl = startTypingAnimation();

  try {
    const { response } = await fetch(`${API_BASE}/api/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        message : txt,
        history : conversation,
        style,
      }),
    }).then(r => r.json());

    // Animation stoppen & echte Antwort einsetzen
    stopTypingAnimation(typingEl, response);

    conversation.push({ role: 'user',      content: txt });
    conversation.push({ role: 'assistant', content: response });

    if (conversation.length > 10) {
      conversation.splice(0, conversation.length - 10);
    }
  } catch (err) {
    console.error(err);
    stopTypingAnimation(typingEl, '⚠️ Server-Fehler');
  } finally {
    sendBtn.disabled = false;
  }
}

/* =========================================================
   Tippanimationen (Bot tippt: … → .. → . → …)
   ========================================================= */
function startTypingAnimation(): HTMLElement {
  const el = document.createElement('article');
  el.className = 'message bot typing';
  el.textContent = '.';
  bodyEl.appendChild(el);
  bodyEl.scrollTop = bodyEl.scrollHeight;

  let dots = 1;
  const interval = setInterval(() => {
    dots = (dots % 3) + 1;
    el.textContent = '.'.repeat(dots);
  }, 300); // ~1,5s für den gesamten Durchlauf

  // Stop-Funktion als Eigenschaft speichern
  (el as any)._stopTyping = () => clearInterval(interval);
  return el;
}

function stopTypingAnimation(el: HTMLElement, finalText: string) {
  (el as any)._stopTyping?.();
  el.classList.remove('typing');
  el.textContent = finalText;
}

/* =========================================================
   Initiale Begrüßung mit Delay und Animation
   ========================================================= */
function showTypingMessage(finalText: string, delay = 1000) {
  const el = startTypingAnimation();
  setTimeout(() => {
    stopTypingAnimation(el, finalText);
  }, delay);
}

function append(sender: Role, text: string) {
    const el = document.createElement('article');
    el.className = `message ${sender === 'assistant' ? 'bot' : 'user'}`;
    el.textContent = text;
    bodyEl.appendChild(el);
    bodyEl.scrollTop = bodyEl.scrollHeight;
  }
  
