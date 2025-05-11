const API_BASE = import.meta.env.VITE_API_BASE || '';

type Style = 'soc' | 'ins';
type Role  = 'user' | 'assistant';

interface ChatMsg {
  role   : Role;
  content: string;
}

let sendBtn : HTMLButtonElement;
let inputEl : HTMLTextAreaElement;
let bodyEl  : HTMLElement;

let style       : Style;
let conversation: ChatMsg[] = [];

let progress = 0;
const MAX_PROGRESS = 5;

function updateChatProgress() {
  const el = document.getElementById('chat-progress');
  if (!el) return;
  const circle = el.querySelector('.circle') as SVGPathElement;
  const text = el.querySelector('.progress-text')!;
  const percent = (progress / MAX_PROGRESS) * 100;
  text.textContent = progress < MAX_PROGRESS ? `${progress}/5` : '✓';
  circle.style.strokeDashoffset = (100 - percent).toString();
  if (progress === MAX_PROGRESS) {
    let seconds = 10;
    text.textContent = `${seconds}s`;
  
    const countdown = setInterval(() => {
      seconds--;
      text.textContent = seconds > 0 ? `${seconds}s` : '✓';
  
      if (seconds === 0) {
        clearInterval(countdown);
        localStorage.setItem('experimentDone', 'true');
        document.getElementById('experiment-complete-overlay')!.style.display = 'flex';
      }
    }, 1000); // alle 1 Sekunde
  }
    
}

export function startChatbot(selectedStyle: Style) {
  style        = selectedStyle;
  conversation = [];
  progress     = 0;
  updateChatProgress();

  sendBtn = document.getElementById('chat-send')  as HTMLButtonElement;
  inputEl = document.getElementById('chat-input') as HTMLTextAreaElement;
  bodyEl  = document.getElementById('chatbot-body')!;

  inputEl.addEventListener('input', autoResize);
  inputEl.addEventListener('keyup',   autoResize);
  inputEl.addEventListener('change',  autoResize);

  // Beim Screen-Rotate und Resize nochmal prüfen
  window.addEventListener('resize',           autoResize);
  window.addEventListener('orientationchange', autoResize);
  sendBtn.onclick = onSend;

  // iOS/Android: Fokus automatisch hochscrollen
  inputEl.addEventListener('focus', () => {
    setTimeout(() => {
      inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
  });
  

  autoResize();

  const welcomeMessage = style === 'soc'
    ? 'Hallo! Ich bin dein HR-Assistent. Schön, dass du da bist. Wie kann ich dich unterstützen?'
    : 'Willkommen. Bitte geben Sie Ihr Anliegen ein.';

  showTypingMessage(welcomeMessage);
  conversation.push({ role: 'assistant', content: welcomeMessage });
}

export function stopChatbot() {
  if (sendBtn) sendBtn.onclick = null;

  if (inputEl) {
    inputEl.value = '';
    inputEl.removeEventListener('input', autoResize);
    inputEl.removeEventListener('keydown', onKeyPress);
  }

  if (bodyEl) bodyEl.innerHTML = '';

  conversation = [];
  progress = 0;
  updateChatProgress();
}

function autoResize() {
    requestAnimationFrame(() => {
      inputEl.style.height = 'auto';
      // Berechne Maximalhöhe nach Viewport während Keyboard offen ist
      const maxH = Math.min(window.innerHeight, document.documentElement.clientHeight) * 0.3;
      const newH = Math.min(inputEl.scrollHeight, maxH);
      inputEl.style.height = `${newH}px`;
    });
  }
  

function onKeyPress(ev: KeyboardEvent) {
  if (ev.key === 'Enter' && !ev.shiftKey) {
    ev.preventDefault();
    sendBtn.click();
  }
}

async function onSend() {
  const txt = inputEl.value.trim();
  if (!txt) return;

  append('user', txt);
  inputEl.value = '';
  autoResize();
  inputEl.focus();
  sendBtn.disabled = true;

    // Tastatur schließen und an Anfang scrollen (mobile UX)
      inputEl.blur();
      window.scrollTo({ top: 0, behavior: 'smooth' });

  const [typingEl, stopTyping] = startTypingAnimation();
  const minDelay = new Promise(res => setTimeout(res, 2000));

  try {
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

    conversation.push({ role: 'user', content: txt });
    conversation.push({ role: 'assistant', content: response });

    if (progress < MAX_PROGRESS) {
      progress++;
      updateChatProgress();
    }

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

function append(sender: Role, text: string) {
  const el = document.createElement('article');
  el.className = `message ${sender === 'assistant' ? 'bot' : 'user'}`;
  el.textContent = text;
  bodyEl.appendChild(el);
  bodyEl.scrollTo({ top: bodyEl.scrollHeight, behavior: 'smooth' });
}

function startTypingAnimation(): [HTMLElement, () => void] {
  const el = document.createElement('article');
  el.className = 'message bot typing';
  el.textContent = '•';
  bodyEl.appendChild(el);
  bodyEl.scrollTo({ top: bodyEl.scrollHeight, behavior: 'smooth' });
  //el.scrollIntoView({ behavior: 'smooth', block: 'end' });
  const symbols = ['•  ', '•• ', '•••'];
  let i = 0;

  const interval = setInterval(() => {
    el.textContent = symbols[i % symbols.length];
    i++;
  }, 300);

  const stop = () => clearInterval(interval);
  return [el, stop];
}

function stopTypingAnimation(el: HTMLElement, finalText: string) {
  el.classList.remove('typing');
  el.textContent = finalText;
  el.classList.add('fade-in');
  bodyEl.scrollTo({ top: bodyEl.scrollHeight, behavior: 'smooth' });
}

function showTypingMessage(finalText: string, delay = 2000) {
  const [el, stopTyping] = startTypingAnimation();
  setTimeout(() => {
    stopTyping();
    stopTypingAnimation(el, finalText);
  }, delay);
}
