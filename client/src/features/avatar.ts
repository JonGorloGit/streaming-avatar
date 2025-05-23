// avatar.ts
import StreamingAvatar, {
  AvatarQuality,
  StreamingEvents,
} from '@heygen/streaming-avatar';

let avatar: StreamingAvatar | null = null;
let isStarting = false;
let finalCountdownStarted = false;
let isAvatarSpeaking = false;

const video = document.getElementById('avatarVideo') as HTMLVideoElement;
const speakBtn = document.getElementById('speakButton') as HTMLButtonElement;
const input = document.getElementById('userInput') as HTMLTextAreaElement;
const overlay = document.getElementById('connecting-overlay')!;
const dotsEl = document.getElementById('dots')!;

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';

// ----- WICHTIG: Diese URLs müssen jetzt auf deine SoSci Survey Instanz zeigen! -----
const FALLBACK_SOSCI_SURVEY_URL = 'https://www.soscisurvey.de/digital_HR_agents/';

const REDIRECT_URL_AVATAR_SOC_BASE = import.meta.env.VITE_REDIRECT_URL_AVATAR_SOC || FALLBACK_SOSCI_SURVEY_URL;
const REDIRECT_URL_AVATAR_INS_BASE = import.meta.env.VITE_REDIRECT_URL_AVATAR_INS || FALLBACK_SOSCI_SURVEY_URL;

const MAX_PROGRESS = 5;
const MAX_RETRIES = 2;
const SESSION_COOLDOWN_MS = 10000;

let progress = 0;
let dotInterval: number | null = null;

// Schlüssel für LocalStorage (sollten mit main.ts übereinstimmen)
const SURVEY_REDIRECT_TOKEN_KEY = 'surveyRedirectToken';
const SURVEY_CASE_NUMBER_KEY = 'surveyCaseNumber'; // NEU


/**
 * Hängt die gespeicherten Survey Parameter (Token und CaseNumber) an eine Basis-URL an.
 */
function appendSurveyParamsToUrl(baseUrlString: string): string {
    const token = localStorage.getItem(SURVEY_REDIRECT_TOKEN_KEY); // caseToken
    const caseNum = localStorage.getItem(SURVEY_CASE_NUMBER_KEY); // caseNumber

    try {
        const url = new URL(baseUrlString);

        if (token) {
            url.searchParams.append('l', token); // SoSci erwartet den Token oft als 'l'
        }
        if (caseNum) {
            url.searchParams.append('sosci_casenumber', caseNum);
        }
        url.searchParams.append('ext_complete', '1'); 

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

function updateAvatarProgress() {
  const el = document.getElementById('avatar-progress');
  if (!el) return;
  const circle = el.querySelector('.circle') as SVGPathElement;
  const text = el.querySelector('.progress-text')!;
  const percent = (progress / MAX_PROGRESS) * 100;

  text.textContent = progress < MAX_PROGRESS ? `${progress}/${MAX_PROGRESS}` : '✓';
  circle.style.strokeDashoffset = (100 - percent).toString();
}

function startFinalCountdown(currentStyle: 'soc' | 'ins') {
  const el = document.getElementById('avatar-progress');
  if (!el || finalCountdownStarted) return;
  finalCountdownStarted = true;

  const text = el.querySelector('.progress-text')!;
  let seconds = 5;
  text.textContent = `${seconds}s`;
  if(speakBtn) speakBtn.disabled = true;

  const countdown = setInterval(async () => {
    seconds--;
    text.textContent = seconds > 0 ? `${seconds}s` : '✓';
    if (seconds === 0) {
      clearInterval(countdown);
      
      localStorage.setItem('experimentRedirectMode', 'avatar');
      localStorage.setItem('experimentRedirectStyle', currentStyle);
      localStorage.setItem('experimentDone', 'true');
      
      const experimentCompleteOverlay = document.getElementById('experiment-complete-overlay');
      const manualRedirectLink = document.getElementById('manualRedirectLink') as HTMLAnchorElement | null;
      
      const baseRedirectUrl = currentStyle === 'soc' ? REDIRECT_URL_AVATAR_SOC_BASE : REDIRECT_URL_AVATAR_INS_BASE;
      const finalRedirectUrl = appendSurveyParamsToUrl(baseRedirectUrl); // ANPASSUNG

      if (experimentCompleteOverlay) {
        experimentCompleteOverlay.style.display = 'flex';
        if (manualRedirectLink) {
          manualRedirectLink.href = finalRedirectUrl;
        }
      }
      
      await stopAvatar(); 
      window.location.href = finalRedirectUrl;
    }
  }, 1000);
}

export async function stopAvatar() {
  if (avatar) {
    try {
      await avatar.stopAvatar();
    } catch (err) {
      console.warn('Fehler beim Stoppen des Avatars:', err);
    }
    avatar = null;
  }
  if (video && video.srcObject) { // Check if video exists
    const stream = video.srcObject as MediaStream;
    stream.getTracks().forEach(track => track.stop());
    video.srcObject = null;
  }
  isStarting = false;
  isAvatarSpeaking = false;
  if (speakBtn) speakBtn.disabled = true;
  if (dotInterval) {
    clearInterval(dotInterval);
    dotInterval = null;
  }
}

export async function startAvatar(style: 'soc' | 'ins' = 'soc') {
  if (localStorage.getItem('experimentDone') === 'true') {
    // Potentially call showExperimentCompleteOverlayAndSetLink from main.ts if it's accessible
    // For now, we assume main.ts handles this on DOMContentLoaded
    return;
  }

  if (video) video.play().catch(e => console.warn("Video play failed:", e)); // Check if video exists
  if (isStarting) return;
  isStarting = true;
  progress = 0;
  finalCountdownStarted = false; 
  isAvatarSpeaking = false;
  updateAvatarProgress();
  if (speakBtn) speakBtn.disabled = true; 

  if (overlay) overlay.style.display = 'block'; // Check if overlay exists
  if (dotsEl) dotsEl.textContent = '.'; // Check if dotsEl exists
  let dotState = 1;
  if (dotInterval) clearInterval(dotInterval);
  dotInterval = window.setInterval(() => {
    dotState = (dotState % 3) + 1;
    if (dotsEl) dotsEl.textContent = '.'.repeat(dotState);
  }, 500);

  if (input) { // Check if input exists
    input.removeEventListener('input', handleAvatarInputResize);
    input.addEventListener('input', handleAvatarInputResize);
    input.removeEventListener('keydown', handleAvatarInputKeydown);
    input.addEventListener('keydown', handleAvatarInputKeydown);
    input.removeEventListener('focus', handleAvatarInputFocus);
    input.addEventListener('focus', handleAvatarInputFocus);
  }
  
  if (speakBtn) { // Check if speakBtn exists
    speakBtn.onclick = null; 
    speakBtn.onclick = async () => {
      if (isAvatarSpeaking || speakBtn.disabled || finalCountdownStarted) return;
      const text = input ? input.value.trim() : ""; // Check if input exists
      if (!avatar || !text) return;

      isAvatarSpeaking = true;
      speakBtn.disabled = true;
      if (input) { // Check if input exists
          input.value = '';
          input.style.height = 'auto'; 
      }

      try {
          await avatar.speak({ text });
          if (progress < MAX_PROGRESS && !finalCountdownStarted) {
            progress++;
            updateAvatarProgress();
          }
      } catch (error) {
          console.error("Fehler bei avatar.speak:", error);
          isAvatarSpeaking = false;
          if (!finalCountdownStarted && speakBtn) speakBtn.disabled = false; 
      }
    };
  }

  try {
    let { knowledgeBase } = await fetch(
      `${API_BASE}/api/hr-prompt?style=${style}`
    ).then(res => {
        if (!res.ok) throw new Error(`Fehler beim Abrufen von hr-prompt: ${res.status}`);
        return res.json();
    });

    let started = false;
    for (let attempt = 1; attempt <= MAX_RETRIES && !started; attempt++) {
      try {
        const tokenRes = await fetch(`${API_BASE}/api/get-access-token`);
        if (!tokenRes.ok) throw new Error(`Fehler beim Abrufen des Tokens: ${tokenRes.status}`);
        const { token } = await tokenRes.json();
        if (!token) throw new Error('Ungültiger oder fehlender Token');

        if (avatar) await stopAvatar(); 
        avatar = new StreamingAvatar({ token });

        avatar.on(StreamingEvents.STREAM_READY, async (e: any) => { 
          if (video) { // Check if video exists
            video.srcObject = e.detail as MediaStream;
            await video.play().catch(err => console.warn("Error playing video on stream_ready:", err));
          }
          if (overlay) overlay.style.display = 'none';
          if (dotInterval) {
            clearInterval(dotInterval);
            dotInterval = null;
          }
          if (!finalCountdownStarted && speakBtn) speakBtn.disabled = false;

          const greeting = style === 'soc'
            ? 'Hallo! Schön, dass du da bist. Ich bin hier um dich zu unterstützen. Was beschäftigt dich gerade am meisten?'
            : 'Willkommen. Bitte geben Sie Ihr Anliegen ein.';
          if (avatar) { 
             await avatar.speak({ text: greeting });
          }
        });

        avatar.on(StreamingEvents.AVATAR_START_TALKING, () => {
          isAvatarSpeaking = true;
          if (speakBtn) speakBtn.disabled = true;
        });
        avatar.on(StreamingEvents.AVATAR_STOP_TALKING, () => {
          isAvatarSpeaking = false;
          if (!finalCountdownStarted && speakBtn) speakBtn.disabled = false;
          
          if (progress >= MAX_PROGRESS && !finalCountdownStarted) {
            startFinalCountdown(style); 
          }
        });
        
        knowledgeBase += '\n\nDu bist June, dein Name ist June und du bist ein virtueller HR-Assistent.';
        await avatar.createStartAvatar({
          quality: AvatarQuality.High,
          avatarName: 'June_HR_public', 
          language: 'de-DE',
          knowledgeBase,
        });
        started = true;
      } catch (err: any) {
        console.error(`Avatar attempt ${attempt} failed:`, err);
        const status = err?.status || (err instanceof Error && (err as any).status);
        await stopAvatar(); 
        if (status === 400 && attempt < MAX_RETRIES) {
          await new Promise(res => setTimeout(res, SESSION_COOLDOWN_MS));
        } else if (attempt === MAX_RETRIES) {
            throw err; 
        }
      }
    }
    if (!started) throw new Error(`Avatar konnte nach ${MAX_RETRIES} Versuchen nicht gestartet werden`);
  } catch (err) {
    console.error('Avatar-Start endgültig fehlgeschlagen:', err);
    if (dotInterval) clearInterval(dotInterval);
    if (overlay) { // Check if overlay exists
        overlay.textContent = '❌ Verbindung fehlgeschlagen – bitte Seite neu laden';
        overlay.style.display = 'block'; 
    }
    if (speakBtn) speakBtn.disabled = true;
  } finally {
    isStarting = false;
  }
}

const handleAvatarInputResize = () => {
  if (!input) return; // Check if input exists
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, window.innerHeight * 0.3) + 'px';
};

const handleAvatarInputKeydown = (ev: KeyboardEvent) => {
  if (ev.key === 'Enter' && !ev.shiftKey) {
    ev.preventDefault();
    if (speakBtn && !speakBtn.disabled && !finalCountdownStarted) speakBtn.click(); // Check if speakBtn exists
  }
};

const handleAvatarInputFocus = () => {
  if (!input) return; // Check if input exists
  setTimeout(() => input.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
};