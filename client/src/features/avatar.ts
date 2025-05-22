import StreamingAvatar, {
  AvatarQuality,
  StreamingEvents,
} from '@heygen/streaming-avatar';

// Halte Avatar-Instanz und Statusflags für gesteuerte Start-/Stopp-Logik
let avatar: StreamingAvatar | null = null;
let isStarting = false;
let finalCountdownStarted = false;
let isAvatarSpeaking = false;

// UI-Elemente zentral referenzieren
const video    = document.getElementById('avatarVideo')      as HTMLVideoElement;
const speakBtn = document.getElementById('speakButton')     as HTMLButtonElement;
const input    = document.getElementById('userInput')       as HTMLTextAreaElement;
const overlay  = document.getElementById('connecting-overlay')!;
const dotsEl   = document.getElementById('dots')!;

// Konfigurationswerte: API-Pfad, Fortschrittsgrenzen und Wiederholversuche
const API_BASE                = import.meta.env.VITE_API_BASE || 'http://localhost:3000';
const REDIRECT_URL_AVATAR_SOC = import.meta.env.VITE_REDIRECT_URL_AVATAR_SOC || 'https://google.com';
const REDIRECT_URL_AVATAR_INS = import.meta.env.VITE_REDIRECT_URL_AVATAR_INS || 'https://meta.com';

const MAX_PROGRESS        = 5;
const MAX_RETRIES         = 2;
const SESSION_COOLDOWN_MS = 10000;

let progress     = 0;
let dotInterval: number | null = null;

/**
 * Aktualisiert die Fortschrittsanzeige im UI-Kreis basierend auf 'progress'.
 */
function updateAvatarProgress() {
  const el = document.getElementById('avatar-progress');
  if (!el) return;
  const circle = el.querySelector('.circle') as SVGPathElement;
  const text   = el.querySelector('.progress-text')!;
  const percent = (progress / MAX_PROGRESS) * 100;

  text.textContent = progress < MAX_PROGRESS ? `${progress}/${MAX_PROGRESS}` : '✓';
  circle.style.strokeDashoffset = (100 - percent).toString();
}

/**
 * Startet Countdown nach Maximalfortschritt und beendet Experiment mit Weiterleitung.
 * @param currentStyle Der Stil ('soc' oder 'ins'), der die Weiterleitungs-URL bestimmt.
 */
function startFinalCountdown(currentStyle: 'soc' | 'ins') {
  const el = document.getElementById('avatar-progress');
  if (!el || finalCountdownStarted) return; // Prevent multiple starts
  finalCountdownStarted = true;

  const text = el.querySelector('.progress-text')!;
  let seconds = 5; // Countdown duration
  text.textContent = `${seconds}s`;
  speakBtn.disabled = true; // Disable interaction during countdown

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
      
      const redirectUrl = currentStyle === 'soc' ? REDIRECT_URL_AVATAR_SOC : REDIRECT_URL_AVATAR_INS;

      if (experimentCompleteOverlay) {
        experimentCompleteOverlay.style.display = 'flex';
        if (manualRedirectLink) {
            manualRedirectLink.href = redirectUrl;
        }
      }
      
      await stopAvatar(); 

      window.location.href = redirectUrl;
    }
  }, 1000);
}

/**
 * Beendet aktuellen Avatar-Stream und setzt UI-Status zurück.
 */
export async function stopAvatar() {
  if (avatar) {
    try {
      await avatar.stopAvatar();
    } catch (err) {
      console.warn('Fehler beim Stoppen des Avatars:', err);
    }
    avatar = null;
  }
  if (video.srcObject) {
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
  // finalCountdownStarted should be reset when a new session starts in startAvatar
}

/**
 * Initialisiert Avatar-Session.
 */
export async function startAvatar(style: 'soc' | 'ins' = 'soc') {
  if (localStorage.getItem('experimentDone') === 'true') {
    // main.ts handles showing the completion overlay if already done.
    return;
  }

  video.play().catch(e => console.warn("Video play failed:", e)); // Try to play early
  if (isStarting) return;
  isStarting = true;
  progress = 0;
  finalCountdownStarted = false; // Reset for new session
  isAvatarSpeaking = false;
  updateAvatarProgress();
  speakBtn.disabled = true; // Disabled until stream is ready

  overlay.style.display = 'block';
  dotsEl.textContent = '.';
  let dotState = 1;
  if (dotInterval) clearInterval(dotInterval);
  dotInterval = window.setInterval(() => {
    dotState = (dotState % 3) + 1;
    dotsEl.textContent = '.'.repeat(dotState);
  }, 500);

  // Event listeners (ensure they are not duplicated if startAvatar can be called multiple times)
  input.removeEventListener('input', handleAvatarInputResize);
  input.addEventListener('input', handleAvatarInputResize);
  input.removeEventListener('keydown', handleAvatarInputKeydown);
  input.addEventListener('keydown', handleAvatarInputKeydown);
  input.removeEventListener('focus', handleAvatarInputFocus);
  input.addEventListener('focus', handleAvatarInputFocus);
  
  speakBtn.onclick = null; // Clear previous listener
  speakBtn.onclick = async () => {
    if (isAvatarSpeaking || speakBtn.disabled || finalCountdownStarted) return;
    const text = input.value.trim();
    if (!avatar || !text) return;

    isAvatarSpeaking = true;
    speakBtn.disabled = true;
    input.value = '';
    input.style.height = 'auto'; // Reset height

    try {
        await avatar.speak({ text });
        // Progress is incremented here. Countdown triggered when avatar stops.
        if (progress < MAX_PROGRESS && !finalCountdownStarted) {
          progress++;
          updateAvatarProgress();
        }
    } catch (error) {
        console.error("Fehler bei avatar.speak:", error);
        isAvatarSpeaking = false;
        if (!finalCountdownStarted) speakBtn.disabled = false; // Re-enable on error if not in countdown
    }
  };

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

        if (avatar) await stopAvatar(); // Ensure previous instance is fully stopped
        avatar = new StreamingAvatar({ token });

        avatar.on(StreamingEvents.STREAM_READY, async (e) => {
          video.srcObject = (e as any).detail as MediaStream;
          await video.play().catch(err => console.warn("Error playing video on stream_ready:", err));
          overlay.style.display = 'none';
          if (dotInterval) {
            clearInterval(dotInterval);
            dotInterval = null;
          }
          if (!finalCountdownStarted) speakBtn.disabled = false;

          // Speak greeting after stream is ready
          const greeting = style === 'soc'
            ? 'Hallo! Schön, dass du da bist. Ich bin hier um dich zu unterstützen. Was beschäftigt dich gerade am meisten?'
            : 'Willkommen. Bitte geben Sie Ihr Anliegen ein.';
          if (avatar) { // Check if avatar still exists (not stopped by error)
             await avatar.speak({ text: greeting });
          }
        });

        avatar.on(StreamingEvents.AVATAR_START_TALKING, () => {
          isAvatarSpeaking = true;
          speakBtn.disabled = true;
        });
        avatar.on(StreamingEvents.AVATAR_STOP_TALKING, () => {
          isAvatarSpeaking = false;
          if (!finalCountdownStarted) speakBtn.disabled = false;
          
          if (progress >= MAX_PROGRESS && !finalCountdownStarted) {
            startFinalCountdown(style); 
          }
        });
        
        // No need for an explicit delay here, createStartAvatar will establish connection
        knowledgeBase += '\n\nDu bist June, dein Name ist June und du bist ein virtueller HR-Assistent.';
        await avatar.createStartAvatar({
          quality: AvatarQuality.High,
          avatarName: 'June_HR_public', // Replace with your actual avatar ID if different
          language: 'de-DE',
          knowledgeBase,
        });
        // Greeting is now handled in STREAM_READY
        started = true;
      } catch (err: any) {
        console.error(`Avatar attempt ${attempt} failed:`, err);
        const status = err?.status || (err instanceof Error && (err as any).status);
        await stopAvatar(); // Ensure cleanup on error
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
    overlay.textContent = '❌ Verbindung fehlgeschlagen – bitte Seite neu laden';
    overlay.style.display = 'block'; // Make sure overlay is visible
    speakBtn.disabled = true;
  } finally {
    isStarting = false;
  }
}

// Helper functions for event listeners to allow removal
const handleAvatarInputResize = () => {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, window.innerHeight * 0.3) + 'px';
};

const handleAvatarInputKeydown = (ev: KeyboardEvent) => {
  if (ev.key === 'Enter' && !ev.shiftKey) {
    ev.preventDefault();
    if (!speakBtn.disabled && !finalCountdownStarted) speakBtn.click();
  }
};

const handleAvatarInputFocus = () => {
  setTimeout(() => input.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
};