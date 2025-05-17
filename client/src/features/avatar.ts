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
const API_BASE            = import.meta.env.VITE_API_BASE || 'http://localhost:3000';
const MAX_PROGRESS        = 5;
const MAX_RETRIES         = 2;
const SESSION_COOLDOWN_MS = 10000;

let progress     = 0;
let dotInterval: number | null = null;

/**
 * Aktualisiert die Fortschrittsanzeige im UI-Kreis basierend auf 'progress'.
 * Warum: Nutzer sieht visuelles Feedback zu bereits geführten Unterhaltungen.
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
 * Startet Countdown nach Maximalfortschritt und beendet Experiment.
 * Warum: Automatischer Abschluss bei Erreichen aller Interaktionen.
 */
function startFinalCountdown() {
  const el = document.getElementById('avatar-progress');
  if (!el) return;
  const text = el.querySelector('.progress-text')!;
  let seconds = 5;
  text.textContent = `${seconds}s`;

  const countdown = setInterval(async () => {
    seconds--;
    text.textContent = seconds > 0 ? `${seconds}s` : '✓';
    if (seconds === 0) {
      clearInterval(countdown);
      localStorage.setItem('experimentDone', 'true');
      document.getElementById('experiment-complete-overlay')!.style.display = 'flex';
      await stopAvatar(); // Aufräumen nach Countdown
    }
  }, 1000);
}

/**
 * Beendet aktuellen Avatar-Stream und setzt UI-Status zurück.
 * Warum: Sauberes Hochfahren für nächsten Start und Speicherfreigabe.
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
    video.srcObject = null;
  }
  isStarting = false;
  isAvatarSpeaking = false;
  speakBtn.disabled = true;
}

/**
 * Initialisiert Avatar-Session: Bereinigt Zustand, zeigt Lade-Overlay und konfiguriert Events.
 * Warum: Sicherstellen, dass nur eine Instanz läuft und UI korrekt reagiert.
 */
export async function startAvatar(style: 'soc' | 'ins' = 'soc') {
  video.play();
  if (isStarting) return; // Verhindere parallele Starts
  isStarting = true;
  progress = 0;
  finalCountdownStarted = false;
  isAvatarSpeaking = false;
  updateAvatarProgress(); // Fortschrittsanzeige zurücksetzen
  speakBtn.disabled = true; // Interaktion bis Ready blockieren

  overlay.style.display = 'block';
  let dotState = 1;
  // Ladeanimation mit Punkten anzeigen
  dotInterval = window.setInterval(() => {
    dotState = (dotState % 3) + 1;
    dotsEl.textContent = '.'.repeat(dotState);
  }, 500);

  // Eingabefeld dynamisch anpassen um mobile UX sicherzustellen
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, window.innerHeight * 0.3) + 'px';
  });
  input.addEventListener('keydown', ev => {
    if (ev.key === 'Enter' && !ev.shiftKey) {
      ev.preventDefault();
      if (!speakBtn.disabled) speakBtn.click();
    }
  });
  input.addEventListener('focus', () => {
    setTimeout(() => input.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
  });

  // Sprechtaste löst Avatar-sprachprozess aus
  speakBtn.onclick = async () => {
    if (isAvatarSpeaking) return;
    const text = input.value.trim();
    if (!avatar || !text) return;

    isAvatarSpeaking = true;
    speakBtn.disabled = true;
    input.value = '';
    input.style.height = 'auto';

    await avatar.speak({ text });

    // Fortlaufendes Zählen der Gesprächsrunden
    if (progress < MAX_PROGRESS) {
      progress++;
      updateAvatarProgress();
    }
    // Reaktivierung erfolgt im AVATAR_STOP_TALKING-Event
  };

  try {
    // Prompt-Daten vom Backend abrufen
    let { knowledgeBase } = await fetch(
      `${API_BASE}/api/hr-prompt?style=${style}`
    ).then(res => res.json());

    let started = false;
    for (let attempt = 1; attempt <= MAX_RETRIES && !started; attempt++) {
      try {
        // Zugriffstoken für Streaming-Service holen
        const tokenRes = await fetch(`${API_BASE}/api/get-access-token`);
        const { token } = await tokenRes.json();
        if (!tokenRes.ok || !token) throw new Error('Ungültiger Token');

        if (avatar) await stopAvatar();
        avatar = new StreamingAvatar({ token });

        // Medien-Stream einbinden sobald bereit
        avatar.on(StreamingEvents.STREAM_READY, e => {
          video.srcObject = (e as any).detail as MediaStream;
          video.play();
          overlay.style.display = 'none';
        });

        // Sprech-Events für UI-Interaktivität
        avatar.on(StreamingEvents.AVATAR_START_TALKING, () => {
          isAvatarSpeaking = true;
          speakBtn.disabled = true;
        });
        avatar.on(StreamingEvents.AVATAR_STOP_TALKING, () => {
          isAvatarSpeaking = false;
          speakBtn.disabled = false;
          // Wenn alle Runden gelaufen: End-Countdown starten
          if (progress === MAX_PROGRESS && !finalCountdownStarted) {
            finalCountdownStarted = true;
            startFinalCountdown();
          }
        });

        await new Promise(res => setTimeout(res, 300)); // Kurze Pause vor Start

        // Kenntnisbasis erweitern und Avatar erzeugen
        knowledgeBase += '\n\nDu bist June, dein Name ist June und du bist ein virtueller HR-Assistent. Deine Begrüßung: ';
        await avatar.createStartAvatar({
          quality: AvatarQuality.High,
          avatarName: 'June_HR_public',
          language: 'de-DE',
          knowledgeBase,
        });

        // Begrüßung basierend auf Stil ausgeben
        const greeting = style === 'soc'
          ? 'Deine Begrüßung: Hallo! Schön, dass du da bist. Ich bin hier um dich zu unterstützen. Was beschäftigt dich gerade am meisten? (Stelle dich mit Namen vor)'
          : 'Willkommen. Bitte geben Sie Ihr Anliegen ein.';
        await avatar.speak({ text: greeting });

        started = true;
      } catch (err: any) {
        const status = err?.status || (err instanceof Error && (err as any).status);
        if (avatar) await stopAvatar();
        // Bei BadRequest: kurze Abkühlung, sonst Fehler weiterwerfen
        if (status === 400) await new Promise(res => setTimeout(res, SESSION_COOLDOWN_MS));
        else throw err;
      }
    }
    if (!started) throw new Error(`Avatar konnte nach ${MAX_RETRIES} Versuchen nicht gestartet werden`);
  } catch (err) {
    console.error('Avatar-Start endgültig fehlgeschlagen:', err);
    if (dotInterval) clearInterval(dotInterval);
    overlay.textContent = '❌ Verbindung fehlgeschlagen – bitte warten und Seite neu laden';
    speakBtn.disabled = true;
  } finally {
    isStarting = false; // Startvorgang beendet
  }
}
