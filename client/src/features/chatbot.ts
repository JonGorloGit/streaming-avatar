/**
 * Chat-Frontend für den HR-Bot
 * ---------------------------
 * – speichert den Dialog im Browser (conversation[])
 * – schickt Verlauf + Stil bei jedem Aufruf an /api/message
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

  const welcomeMessage = style === 'soc'
  ? 'Hallo! Herzlich Wilkommen! Ich bin dein HR-Assistent. Was kann ich für dich tun?'
  : 'Willkommen. Bitte geben Sie Ihr Anliegen ein.';

    append('assistant', welcomeMessage);
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
      ev.preventDefault();        // verhindert Zeilenumbruch
      sendBtn.click();            // löst Senden aus
    }
    // Shift + Enter → normaler Zeilenumbruch (kein preventDefault)
  }  
  

async function onSend() {
  const txt = inputEl.value.trim();
  if (!txt) return;

  append('user', txt);
  inputEl.value = '';
  autoResize();
  inputEl.focus();
  sendBtn.disabled = true;

  try {
    /* Verlauf ohne aktuelle Frage schicken */
    const { response } = await fetch(`${API_BASE}/api/message`, {
      method      : 'POST',
      headers     : { 'Content-Type': 'application/json' },
      credentials : 'include',            // falls Cross-Origin
      body        : JSON.stringify({
        message : txt,
        history : conversation,
        style,
      }),
    }).then(r => r.json());

    append('assistant', response);

    /* Verlauf updaten und ggf. begrenzen */
    conversation.push({ role: 'user',      content: txt      });
    conversation.push({ role: 'assistant', content: response });
    if (conversation.length > 10) conversation.splice(0, conversation.length - 10);
  } catch (err) {
    console.error(err);
    append('assistant', '⚠️ Server-Fehler');
  } finally {
    sendBtn.disabled = false;
  }
}

function append(sender: Role, text: string) {
  const el = document.createElement('article');
  el.className = `message ${sender === 'assistant' ? 'bot' : 'user'}`; // für CSS
  el.textContent = text;
  bodyEl.appendChild(el);
  bodyEl.scrollTop = bodyEl.scrollHeight;
}
