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
    ? 'Hallo! Ich bin dein HR-Assistent. Was kann ich für dich tun?'
    : 'Willkommen. Bitte geben Sie Ihr Anliegen ein.';

    showTypingMessage(welcomeMessage); // jetzt korrekt getimt & gestoppt
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
    const [typingEl, stopTyping] = startTypingAnimation();
    const minDelay = new Promise(res => setTimeout(res, 2000)); // min. 2s
  
    try {
      // Parallel: Antwort + Mindestzeit
      const [response] = await Promise.all([
        fetch(`${API_BASE}/api/message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ message: txt, history: conversation, style }),
        }).then(r => r.json()).then(r => r.response),
        minDelay,
      ]);
  
      stopTyping(); // Animation beenden
      stopTypingAnimation(typingEl, response);
  
      conversation.push({ role: 'user', content: txt });
      conversation.push({ role: 'assistant', content: response });
      if (conversation.length > 10) conversation.splice(0, conversation.length - 10);
    } catch (err) {
      console.error(err);
      stopTyping();
      stopTypingAnimation(typingEl, '⚠️ Server-Fehler');
    } finally {
      sendBtn.disabled = false;
    }
  }
  

/* =========================================================
   Tippanimationen (Bot tippt: … → .. → . → …)
   ========================================================= */
function startTypingAnimation(): [HTMLElement, () => void] {
    const el = document.createElement('article');
    el.className = 'message bot typing';
    el.textContent = '•'; // ruhigerer Typindikator
    bodyEl.appendChild(el);
    bodyEl.scrollTop = bodyEl.scrollHeight;
  
    const symbols = ['•  ', '•• ', '•••'];
    let i = 0;
  
    const interval = setInterval(() => {
      el.textContent = symbols[i % symbols.length];
      i++;
    }, 300); // weicher Rhythmus
  
    const stop = () => clearInterval(interval);
    return [el, stop];
  }
  
  

  function stopTypingAnimation(el: HTMLElement, finalText: string) {
    el.classList.remove('typing');
    el.textContent = finalText;
    el.classList.add('fade-in');
  }
  

/* =========================================================
   Initiale Begrüßung mit Delay und Animation
   ========================================================= */
   function showTypingMessage(finalText: string, delay = 2000) {
    const [el, stopTyping] = startTypingAnimation();
    setTimeout(() => {
      stopTyping();
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
  
