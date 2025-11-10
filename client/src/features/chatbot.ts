// chatbot.ts

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';

// ----- SoSci Survey URLs -----
const FALLBACK_SOSCI_SURVEY_URL = 'https://www.soscisurvey.de/digital_HR_agents/'; // Deine Basis-URL

// URLs für normalen Abschluss
const REDIRECT_URL_CHAT_SOC_NORMAL_BASE = import.meta.env.VITE_REDIRECT_URL_CHAT_SOC || FALLBACK_SOSCI_SURVEY_URL;
const REDIRECT_URL_CHAT_INS_NORMAL_BASE = import.meta.env.VITE_REDIRECT_URL_CHAT_INS || FALLBACK_SOSCI_SURVEY_URL;

// URLs für "Connect to Human" Abschluss
const REDIRECT_URL_CHAT_SOC_HUMAN_BASE = import.meta.env.VITE_REDIRECT_URL_CHAT_SOC_HUMAN || FALLBACK_SOSCI_SURVEY_URL;
const REDIRECT_URL_CHAT_INS_HUMAN_BASE = import.meta.env.VITE_REDIRECT_URL_CHAT_INS_HUMAN || FALLBACK_SOSCI_SURVEY_URL;

// Schlüssel für LocalStorage (sollten mit main.ts übereinstimmen)
const SURVEY_REDIRECT_TOKEN_KEY = 'surveyRedirectToken'; 
const EXPERIMENT_HUMAN_CONNECT_KEY = 'experimentHumanConnect';
const USER_MESSAGES_LOG_KEY = 'userMessagesLog'; // NEU: Für gesammelte Nachrichten

type Style = 'soc' | 'ins';
type Role = 'user' | 'assistant';

interface ChatMsg {
  role: Role;
  content: string;
  isHumanConnectPrompt?: boolean;
}

let sendBtn: HTMLButtonElement | null = null;
let inputEl: HTMLTextAreaElement | null = null;
let bodyEl: HTMLElement | null = null;

let currentChatbotStyle: Style;
let conversation: ChatMsg[] = [];
let userMessagesLog: string[] = []; // NEU: Array zum Speichern von User-Nachrichten

let progress = 0;
const MAX_PROGRESS = 3;
const HUMAN_CONNECT_PROMPT_THRESHOLD = 3;
let humanConnectPromptShownThisSession = false;

let chatCountdownInterval: number | null = null;
let chatFinalCountdownStarted = false;

/**
 * Hängt die gespeicherten Survey Parameter an eine Basis-URL an.
 * @param baseUrlString Die Basis-URL zur SoSci Survey.
 * @param optedForHumanConnect Gibt an, ob der User mit einem Menschen verbunden werden wollte.
 */
function appendSurveyParamsToUrlLocal(baseUrlString: string, optedForHumanConnect: boolean): string {
  const token = localStorage.getItem(SURVEY_REDIRECT_TOKEN_KEY);
  const messages = localStorage.getItem(USER_MESSAGES_LOG_KEY); // NEU
  try {
    const url = new URL(baseUrlString);
    if (token) {
      url.searchParams.append('i', token);
    }
    url.searchParams.append('hc', optedForHumanConnect ? '1' : '0');
    if (messages) { // NEU
      url.searchParams.append('msgs', messages);
    }
    return url.toString();
  } catch (error) {
    console.error("Error constructing URL with params in chatbot.ts:", error, "Base URL was:", baseUrlString);
    let fallbackUrl = baseUrlString;
    const params: string[] = [];
    if (token) params.push(`i=${encodeURIComponent(token)}`);
    params.push(`hc=${optedForHumanConnect ? '1' : '0'}`);
    if (messages) params.push(`msgs=${encodeURIComponent(messages)}`); // NEU
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
    console.log("CHAT: MAX_PROGRESS erreicht, starte finalen Countdown.");
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
        localStorage.removeItem(EXPERIMENT_HUMAN_CONNECT_KEY); // Normaler Abschluss
        
        // NEU: Gesammelte Nachrichten im localStorage speichern
        localStorage.setItem(USER_MESSAGES_LOG_KEY, userMessagesLog.join('$'));

        const baseRedirectUrl = currentChatbotStyle === 'soc' ? REDIRECT_URL_CHAT_SOC_NORMAL_BASE : REDIRECT_URL_CHAT_INS_NORMAL_BASE;
        const finalRedirectUrl = appendSurveyParamsToUrlLocal(baseRedirectUrl, false); // optedForHumanConnect ist false
        
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
  userMessagesLog = []; // NEU: Nachrichten-Log zurücksetzen
  progress     = 0;
  humanConnectPromptShownThisSession = false;
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
    ? 'Hallo, es freut mich, dass du hier bist. Ich nehme wahr, dass dich die aktuellen Veränderungen bei den Regelungen zu Elternzeit, Teilzeit oder dem Rückkehrprozess nach einer Auszeit beschäftigen. Das ist vollkommen verständlich – solche Anpassungen können viele Fragen aufwerfen. Was beschäftigt dich im Moment am meisten?'
    : 'Willkommen, ich stehe gerne für Fragen zu Ansprüchen auf Elternzeit, Teilzeit oder zum Rückkehrprozess nach einer Auszeit zur Verfügung. Bitte gib dein Anliegen ein.';

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
  const humanConnectPromptEl = document.getElementById('chat-human-connect-prompt-container');
  if (humanConnectPromptEl) humanConnectPromptEl.remove();
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
    if (sendBtn && !sendBtn.disabled && !chatFinalCountdownStarted) {
      sendBtn.click();
    }
  }
}

async function onSend() {
  if (!inputEl || !sendBtn || sendBtn.disabled || chatFinalCountdownStarted) {
    return;
  }

  const txt = inputEl.value.trim();
  if (!txt) return;

  userMessagesLog.push(txt); // NEU: User-Nachricht zum Log hinzufügen

  appendMessage('user', txt);
  inputEl.value = '';
  autoResize();
  
  sendBtn.disabled = true;
  if(inputEl) inputEl.disabled = true;

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
    
    const promptContainerIsActive = !!document.getElementById('chat-human-connect-prompt-container');

    if (progress === HUMAN_CONNECT_PROMPT_THRESHOLD && !humanConnectPromptShownThisSession && !chatFinalCountdownStarted) {
      askForHumanConnection(); 
    } else if (!chatFinalCountdownStarted && !promptContainerIsActive) {
      if(sendBtn) sendBtn.disabled = false;
      if(inputEl) {
        inputEl.disabled = false;
        inputEl.focus();
      }
    }

    if (conversation.length > 20) {
      conversation.splice(0, conversation.length - 20);
    }
  } catch (err) {
    console.error("Error sending message or processing response:", err);
    stopTyping();
    stopTypingAnimation(typingEl, '⚠️ Entschuldigung, ein Fehler ist aufgetreten.');
    
    const promptContainerIsActive = !!document.getElementById('chat-human-connect-prompt-container');
    if (!chatFinalCountdownStarted && !promptContainerIsActive) {
      if(sendBtn) sendBtn.disabled = false;
      if(inputEl) {
        inputEl.disabled = false;
        inputEl.focus();
      }
    }
  }
}

function appendMessage(sender: Role, text: string, isPrompt: boolean = false) {
  if (!bodyEl) return;
  const el = document.createElement('article');
  el.className = `message ${sender === 'assistant' ? 'bot' : 'user'} ${isPrompt ? 'human-connect-prompt' : ''}`;
  
  if (isPrompt) {
    el.id = 'chat-human-connect-prompt-container';
    const questionP = document.createElement('p');
    questionP.textContent = text;
    el.appendChild(questionP);

    const buttonDiv = document.createElement('div');
    buttonDiv.className = 'buttons';

    const yesButton = document.createElement('button');
    yesButton.textContent = 'Ja, ich möchte mit einem menschlichen HR-Mitarbeiter verbunden werden';
    yesButton.onclick = () => handleHumanConnectionChoice(true);
    
    const noButton = document.createElement('button');
    noButton.textContent = 'Nein, danke';
    noButton.onclick = () => handleHumanConnectionChoice(false);
    
    buttonDiv.appendChild(yesButton);
    buttonDiv.appendChild(noButton);
    el.appendChild(buttonDiv);
  } else {
    el.textContent = text;
  }
  
  bodyEl.appendChild(el);
  bodyEl.scrollTo({ top: bodyEl.scrollHeight, behavior: 'smooth' });
}

function askForHumanConnection() {
  if (!bodyEl || humanConnectPromptShownThisSession || chatFinalCountdownStarted) return;
  humanConnectPromptShownThisSession = true;
  appendMessage('assistant', 'Möchten Sie jetzt mit einem menschlichen HR-Mitarbeiter verbunden werden?', true);
}

function handleHumanConnectionChoice(choice: boolean) {
  const promptContainer = document.getElementById('chat-human-connect-prompt-container');
  if (promptContainer) {
    promptContainer.remove();
  }

  if (choice) { // User chose "Yes"
    localStorage.setItem('experimentRedirectMode', 'chat');
    localStorage.setItem('experimentRedirectStyle', currentChatbotStyle);
    localStorage.setItem(EXPERIMENT_HUMAN_CONNECT_KEY, 'yes'); 
    localStorage.setItem('experimentDone', 'true');

    // NEU: Gesammelte Nachrichten im localStorage speichern
    localStorage.setItem(USER_MESSAGES_LOG_KEY, userMessagesLog.join('$'));

    const baseRedirectUrl = currentChatbotStyle === 'soc' 
      ? REDIRECT_URL_CHAT_SOC_HUMAN_BASE 
      : REDIRECT_URL_CHAT_INS_HUMAN_BASE;
    const finalRedirectUrl = appendSurveyParamsToUrlLocal(baseRedirectUrl, true); // optedForHumanConnect ist true
    
    window.location.href = finalRedirectUrl;

  } else { // User chose "No"
    localStorage.removeItem(EXPERIMENT_HUMAN_CONNECT_KEY); 
    if(sendBtn && !chatFinalCountdownStarted) sendBtn.disabled = false;
    if(inputEl && !chatFinalCountdownStarted) {
      inputEl.disabled = false;
      inputEl.focus();
    }
  }
}

// ... (startTypingAnimation, stopTypingAnimation, showTypingMessage bleiben gleich) ...
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
  const intervalId = setInterval(() => {
    el.innerHTML = symbols[i++ % symbols.length];
  }, 300);
  return [el, () => clearInterval(intervalId)];
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
