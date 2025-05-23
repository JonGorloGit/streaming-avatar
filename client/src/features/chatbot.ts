// chatbot.ts

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';

// ----- WICHTIG: Diese URLs müssen jetzt auf deine SoSci Survey Instanz zeigen! -----
const FALLBACK_SOSCI_SURVEY_URL = 'https://www.soscisurvey.de/digital_HR_agents/';

const REDIRECT_URL_CHAT_SOC_BASE = import.meta.env.VITE_REDIRECT_URL_CHAT_SOC || FALLBACK_SOSCI_SURVEY_URL;
const REDIRECT_URL_CHAT_INS_BASE = import.meta.env.VITE_REDIRECT_URL_CHAT_INS || FALLBACK_SOSCI_SURVEY_URL;

// Schlüssel für LocalStorage (sollten mit main.ts übereinstimmen)
const SURVEY_REDIRECT_TOKEN_KEY = 'surveyRedirectToken'; 
const SURVEY_CASE_NUMBER_KEY = 'surveyCaseNumber'; // NEU

type Style = 'soc' | 'ins';
type Role = 'user' | 'assistant';

interface ChatMsg {
  role: Role;
  content: string;
}

let sendBtn: HTMLButtonElement | null = null;
let inputEl: HTMLTextAreaElement | null = null;
let bodyEl: HTMLElement | null = null;

let currentChatbotStyle: Style;
let conversation: ChatMsg[] = [];

let progress = 0;
const MAX_PROGRESS = 5;
let chatCountdownInterval: number | null = null;
let chatFinalCountdownStarted = false;

/**
 * Hängt die gespeicherten Survey Parameter (Token und CaseNumber) an eine Basis-URL an.
 */
function appendSurveyParamsToUrl(baseUrlString: string): string {
    const token = localStorage.getItem(SURVEY_REDIRECT_TOKEN_KEY); // caseToken
    const caseNum = localStorage.getItem(SURVEY_CASE_NUMBER_KEY); // caseNumber

    try {
        const url = new URL(baseUrlString);

        if (token) {
            url.searchParams.append('i', token); // SoSci erwartet den Token oft als 'l'
        }
        if (caseNum) {
            url.searchParams.append('sosci_casenumber', caseNum);
        }
        return url.toString();
    } catch (error) {
        console.error("Error constructing URL with params:", error, "Base URL was:", baseUrlString);
        let fallbackUrl = baseUrlString;
        const params: string[] = [];
        if (token) params.push(`l=${encodeURIComponent(token)}`);
        if (caseNum) params.push(`sosci_casenumber=${encodeURIComponent(caseNum)}`);
        params.push(`ext_complete=1`);

        if (params.length > 0) {
            fallbackUrl += (fallbackUrl.includes('?') ? '&' : '?') + params.join('&');
        }
        return fallbackUrl;
    }
}


function updateChatProgress() {
  const el = document.getElementById('chat-progress');
  if (!el) return;
  const circle = el.querySelector('.circle') as SVGPathElement;
  const text = el.querySelector('.progress-text')!;

  const percent = (progress / MAX_PROGRESS) * 100;
  text.textContent = progress < MAX_PROGRESS ? `${progress}/${MAX_PROGRESS}` : '✓';
  circle.style.strokeDashoffset = (100 - percent).toString();

  if (progress >= MAX_PROGRESS && !chatFinalCountdownStarted) {
    chatFinalCountdownStarted = true;
    if (sendBtn) sendBtn.disabled = true;
    if (inputEl) inputEl.disabled = true;

    let seconds = 10;
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

        const baseRedirectUrl = currentChatbotStyle === 'soc' ? REDIRECT_URL_CHAT_SOC_BASE : REDIRECT_URL_CHAT_INS_BASE;
        const finalRedirectUrl = appendSurveyParamsToUrl(baseRedirectUrl); // ANPASSUNG

        if (experimentCompleteOverlay) {
          experimentCompleteOverlay.style.display = 'flex';
          if (manualRedirectLink) {
            manualRedirectLink.href = finalRedirectUrl; 
          }
        }
        
        window.location.href = finalRedirectUrl;
      }
    }, 1000);
  }
}

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
  bodyEl.innerHTML = ''; 

  ['input','keyup','change'].forEach(evtType => {
    inputEl!.removeEventListener(evtType, autoResize);
    inputEl!.addEventListener(evtType, autoResize);
  });
  inputEl.removeEventListener('keydown', onKeyPress);
  inputEl.addEventListener('keydown', onKeyPress);
  inputEl.removeEventListener('focus', handleChatInputFocus);
  inputEl.addEventListener('focus', handleChatInputFocus);
  
  window.removeEventListener('resize', autoResize); 
  window.addEventListener('resize', autoResize);
  window.removeEventListener('orientationchange', autoResize); 
  window.addEventListener('orientationchange', autoResize);
  
  sendBtn.onclick = null; 
  sendBtn.onclick = onSend;

  inputEl.disabled = false;
  sendBtn.disabled = false;
  autoResize();

  const welcomeMessage = currentChatbotStyle === 'soc'
    ? 'Hallo! Schön, dass du da bist. Ich bin hier um dich zu unterstützen. Was beschäftigt dich gerade am meisten?'
    : 'Willkommen. Bitte geben Sie Ihr Anliegen ein.';

  showTypingMessage(welcomeMessage, 1000);
  conversation.push({ role: 'assistant', content: welcomeMessage });
}

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
  
  sendBtn.disabled = true;

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

    if (progress < MAX_PROGRESS && !chatFinalCountdownStarted) {
      progress++;
      updateChatProgress(); 
    }

    if (conversation.length > 20) {
      conversation.splice(0, conversation.length - 20);
    }
  } catch (err) {
    console.error("Error sending message or processing response:", err);
    stopTyping();
    stopTypingAnimation(typingEl, '⚠️ Entschuldigung, ein Fehler ist aufgetreten.');
  } finally {
    if (!chatFinalCountdownStarted) {
      if(sendBtn) sendBtn.disabled = false;
      if(inputEl) {
        inputEl.disabled = false;
        inputEl.focus(); 
      }
    }
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
      const dummyEl = document.createElement('article'); 
      return [dummyEl, () => {}];
  }
  const el = document.createElement('article');
  el.className = 'message bot typing';
  el.textContent = '•';
  bodyEl.appendChild(el);
  bodyEl.scrollTo({ top: bodyEl.scrollHeight, behavior: 'smooth' });

  const symbols = ['•  ', '•• ', '•••']; 
  let i = 0;
  const interval = setInterval(() => {
    el.innerHTML = symbols[i++ % symbols.length]; 
  }, 300);

  return [el, () => clearInterval(interval)];
}

function stopTypingAnimation(el: HTMLElement, finalText: string) {
  if (!el) return;
  el.classList.remove('typing');
  el.textContent = finalText; 
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