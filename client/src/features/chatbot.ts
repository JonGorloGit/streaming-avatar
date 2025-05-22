const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000'; // Fallback for API_BASE

// Chat-specific redirect URLs
const REDIRECT_URL_CHAT_SOC   = import.meta.env.VITE_REDIRECT_URL_CHAT_SOC   || 'https://amazon.com';
const REDIRECT_URL_CHAT_INS   = import.meta.env.VITE_REDIRECT_URL_CHAT_INS   || 'https://youtube.com';

type Style = 'soc' | 'ins';
type Role  = 'user' | 'assistant';

interface ChatMsg {
  role   : Role;
  content: string;
}

let sendBtn : HTMLButtonElement | null = null;
let inputEl : HTMLTextAreaElement | null = null;
let bodyEl  : HTMLElement | null = null;

let currentChatbotStyle : Style;
let conversation: ChatMsg[] = [];

let progress      = 0;
const MAX_PROGRESS = 5;
let chatCountdownInterval: number | null = null;
let chatFinalCountdownStarted = false;

/**
 * Aktualisiert Fortschrittsanzeige und startet Countdown bei MAX_PROGRESS.
 */
function updateChatProgress() {
  const el = document.getElementById('chat-progress');
  if (!el) return;
  const circle = el.querySelector('.circle') as SVGPathElement;
  const text   = el.querySelector('.progress-text')!;

  const percent = (progress / MAX_PROGRESS) * 100;
  text.textContent = progress < MAX_PROGRESS ? `${progress}/${MAX_PROGRESS}` : '✓';
  circle.style.strokeDashoffset = (100 - percent).toString();

  if (progress >= MAX_PROGRESS && !chatFinalCountdownStarted) {
    chatFinalCountdownStarted = true;
    if(sendBtn) sendBtn.disabled = true; // Disable input during countdown
    if(inputEl) inputEl.disabled = true;

    let seconds = 10; // Countdown duration
    text.textContent = `${seconds}s`;

    if (chatCountdownInterval) clearInterval(chatCountdownInterval);

    chatCountdownInterval = window.setInterval(async () => {
      seconds--;
      text.textContent = seconds > 0 ? `${seconds}s` : '✓';

      if (seconds === 0) {
        if (chatCountdownInterval) clearInterval(chatCountdownInterval);
        
        localStorage.setItem('experimentRedirectMode', 'chat');
        localStorage.setItem('experimentRedirectStyle', currentChatbotStyle);
        localStorage.setItem('experimentDone', 'true');
        
        const experimentCompleteOverlay = document.getElementById('experiment-complete-overlay');
        const manualRedirectLink = document.getElementById('manualRedirectLink') as HTMLAnchorElement | null;

        const redirectUrl = currentChatbotStyle === 'soc' ? REDIRECT_URL_CHAT_SOC : REDIRECT_URL_CHAT_INS;

        if (experimentCompleteOverlay) {
          experimentCompleteOverlay.style.display = 'flex';
          if (manualRedirectLink) {
            manualRedirectLink.href = redirectUrl;
          }
        }
        
        // stopChatbot(); // Cleanup is called by main.ts's setMode logic

        window.location.href = redirectUrl;
      }
    }, 1000);
  }
}

/**
 * Initialisiert Chatbot mit ausgewähltem Stil und zeigt Willkommensnachricht.
 */
export function startChatbot(selectedStyle: Style) {
  if (localStorage.getItem('experimentDone') === 'true') {
    return;
  }

  currentChatbotStyle = selectedStyle;
  conversation = [];
  progress     = 0;
  chatFinalCountdownStarted = false;
  if (chatCountdownInterval) {
    clearInterval(chatCountdownInterval);
    chatCountdownInterval = null;
  }
  updateChatProgress();

  sendBtn = document.getElementById('chat-send')  as HTMLButtonElement;
  inputEl = document.getElementById('chat-input') as HTMLTextAreaElement;
  bodyEl  = document.getElementById('chatbot-body')!;

  if (!sendBtn || !inputEl || !bodyEl) {
    console.error("Chatbot UI elements not found!");
    return;
  }
  bodyEl.innerHTML = ''; // Clear previous messages

  // Remove existing listeners before adding new ones to prevent duplication
  ['input','keyup','change'].forEach(evtType => {
    inputEl!.removeEventListener(evtType, autoResize);
    inputEl!.addEventListener(evtType, autoResize);
  });
  inputEl.removeEventListener('keydown', onKeyPress);
  inputEl.addEventListener('keydown', onKeyPress);
  inputEl.removeEventListener('focus', handleChatInputFocus);
  inputEl.addEventListener('focus', handleChatInputFocus);
  
  window.removeEventListener('resize', autoResize); // Add if it was added before
  window.addEventListener('resize', autoResize);
  window.removeEventListener('orientationchange', autoResize); // Add if it was added before
  window.addEventListener('orientationchange', autoResize);
  
  sendBtn.onclick = null; // Clear previous
  sendBtn.onclick = onSend;

  inputEl.disabled = false;
  sendBtn.disabled = false;
  autoResize();

  const welcomeMessage = currentChatbotStyle === 'soc'
    ? 'Hallo! Schön, dass du da bist. Ich bin hier um dich zu unterstützen. Was beschäftigt dich gerade am meisten?'
    : 'Willkommen. Bitte geben Sie Ihr Anliegen ein.';

  showTypingMessage(welcomeMessage, 1000); // Reduced delay for quicker welcome
  conversation.push({ role: 'assistant', content: welcomeMessage });
}

/**
 * Stoppt Chatbot und bereinigt alle Event-Listener.
 */
export function stopChatbot() {
  if (sendBtn) {
    sendBtn.onclick = null;
    sendBtn.disabled = true;
  }
  if (inputEl) {
    inputEl.value = '';
    ['input','keyup','change'].forEach(evtType => inputEl!.removeEventListener(evtType, autoResize));
    inputEl.removeEventListener('keydown', onKeyPress);
    inputEl.removeEventListener('focus', handleChatInputFocus);
    inputEl.disabled = true;
  }
  window.removeEventListener('resize', autoResize);
  window.removeEventListener('orientationchange', autoResize);

  if (chatCountdownInterval) {
    clearInterval(chatCountdownInterval);
    chatCountdownInterval = null;
  }
  // Do not clear bodyEl.innerHTML here, so messages remain if user comes back before redirect.
  console.log("Chatbot stopped");
}

function autoResize() {
  if (!inputEl) return;
  requestAnimationFrame(() => {
    inputEl!.style.height = 'auto';
    const maxH = Math.min(window.innerHeight, document.documentElement.clientHeight) * 0.3;
    const newH = Math.min(inputEl!.scrollHeight, maxH);
    inputEl!.style.height = `${newH}px`;
  });
}

const handleChatInputFocus = () => {
  if (!inputEl) return;
  setTimeout(() => inputEl!.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
};

function onKeyPress(ev: KeyboardEvent) {
  if (ev.key === 'Enter' && !ev.shiftKey) {
    ev.preventDefault();
    if (sendBtn && !sendBtn.disabled && !chatFinalCountdownStarted) sendBtn.click();
  }
}

async function onSend() {
  if (!inputEl || !sendBtn || sendBtn.disabled || chatFinalCountdownStarted) return;

  const txt = inputEl.value.trim();
  if (!txt) return;

  append('user', txt);
  inputEl.value = '';
  autoResize();
  
  // Disable input and button while waiting for the bot's response
  sendBtn.disabled = true;
  // REMOVED: inputEl.blur(); // Helps hide keyboard - This was causing the focus loss

  const [typingEl, stopTyping] = startTypingAnimation();
  const minDelay = new Promise(res => setTimeout(res, 1000));

  try {
    const response = await Promise.all([
      fetch(`${API_BASE}/api/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: txt, history: conversation, style: currentChatbotStyle }),
      }).then(r => {
        if (!r.ok) throw new Error(`Server responded with ${r.status}`);
        return r.json();
      }).then(r => r.response),
      minDelay,
    ]).then(results => results[0]);

    stopTyping();
    stopTypingAnimation(typingEl, response);

    conversation.push({ role: 'user', content: txt });
    conversation.push({ role: 'assistant', content: response });

    // updateChatProgress is called AFTER the message is successfully processed
    // and before the finally block.
    if (progress < MAX_PROGRESS && !chatFinalCountdownStarted) {
      progress++;
      updateChatProgress(); // This will check for MAX_PROGRESS and might start the countdown
    }

    if (conversation.length > 20) {
      conversation.splice(0, conversation.length - 20);
    }
  } catch (err) {
    console.error("Error sending message or processing response:", err);
    stopTyping();
    stopTypingAnimation(typingEl, '⚠️ Entschuldigung, ein Fehler ist aufgetreten.');
  } finally {
    // Re-enable controls and focus input IF the final countdown hasn't started.
    // updateChatProgress (called in try block) would have set chatFinalCountdownStarted
    // and disabled controls if MAX_PROGRESS was reached.
    if (!chatFinalCountdownStarted) {
      if(sendBtn) sendBtn.disabled = false;
      if(inputEl) {
        inputEl.disabled = false;
        inputEl.focus(); // Restore focus to the input element
      }
    }
    // If chatFinalCountdownStarted is true, controls remain disabled (as set by updateChatProgress)
  }
}

function append(sender: Role, text: string) {
  if (!bodyEl) return;
  const el = document.createElement('article');
  el.className = `message ${sender === 'assistant' ? 'bot' : 'user'}`;
  el.textContent = text;
  bodyEl.appendChild(el);
  bodyEl.scrollTo({ top: bodyEl.scrollHeight, behavior: 'smooth' });
}

function startTypingAnimation(): [HTMLElement, () => void] {
  if (!bodyEl) {
      const dummyEl = document.createElement('article'); // Should not happen if elements are checked
      return [dummyEl, () => {}];
  }
  const el = document.createElement('article');
  el.className = 'message bot typing';
  el.textContent = '•';
  bodyEl.appendChild(el);
  bodyEl.scrollTo({ top: bodyEl.scrollHeight, behavior: 'smooth' });

  const symbols = ['•  ', '•• ', '•••']; // Using non-breaking spaces for consistent width
  let i = 0;
  const interval = setInterval(() => {
    el.innerHTML = symbols[i++ % symbols.length]; // Use innerHTML for  
  }, 300);

  return [el, () => clearInterval(interval)];
}

function stopTypingAnimation(el: HTMLElement, finalText: string) {
  if (!el) return;
  el.classList.remove('typing');
  el.textContent = finalText; // Set text content
  el.classList.add('fade-in');
  if (bodyEl) bodyEl.scrollTo({ top: bodyEl.scrollHeight, behavior: 'smooth' });
}

function showTypingMessage(finalText: string, delay = 1500) {
  const [el, stopTyping] = startTypingAnimation();
  setTimeout(() => {
    stopTyping();
    stopTypingAnimation(el, finalText);
  }, delay);
}