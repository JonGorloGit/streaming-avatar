import StreamingAvatar, {
    AvatarQuality,
    StreamingEvents,
  } from '@heygen/streaming-avatar';
  
  let avatar: StreamingAvatar | null = null;
  let isStarting = false;
  
  const video    = document.getElementById('avatarVideo') as HTMLVideoElement;
  const speakBtn = document.getElementById('speakButton') as HTMLButtonElement;
  const input    = document.getElementById('userInput') as HTMLTextAreaElement;
  const overlay  = document.getElementById('connecting-overlay')!;
  const dotsEl   = document.getElementById('dots')!;
  
  const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';
  const MAX_PROGRESS = 5;
  const MAX_RETRIES = 5;

  speakBtn.disabled = true;
  
  // Free-Plan: mindestens 10 Sekunden Cooldown nur bei 400 Fehlern
  const SESSION_COOLDOWN_MS = 10000;
  
  let progress = 0;
  let dotInterval: number | null = null;
  
  /**
   * Aktualisiert den Fortschrittskreis
   */
  function updateAvatarProgress() {
    const el = document.getElementById('avatar-progress');
    if (!el) return;
    const circle = el.querySelector('.circle') as SVGPathElement;
    const text   = el.querySelector('.progress-text')!;
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
          stopAvatar();
        }
      }, 1000);
    }
  }
  
  /**
   * Stoppt und bereinigt die Avatar-Session
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
    video.srcObject = null;
    isStarting = false;
  }
  
  /**
   * Startet den Avatar mit Retry und spezifischem Fehler-Handling
   */
  export async function startAvatar(style: 'soc' | 'ins' = 'soc') {
    if (isStarting) {
      console.warn('Avatar-Start läuft bereits');
      return;
    }
    isStarting = true;
    speakBtn.disabled = true;
    progress = 0;
    updateAvatarProgress();
  
    // Overlay & animierte Punkte
    overlay.style.display = 'block';
    let dotState = 1;
    dotInterval = window.setInterval(() => {
      dotState = (dotState % 3) + 1;
      dotsEl.textContent = '.'.repeat(dotState);
    }, 500);
  
    // Input-Handler einmalig setzen
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, window.innerHeight * 0.3) + 'px';
    });
    input.addEventListener('keydown', ev => {
      if (ev.key === 'Enter' && !ev.shiftKey) {
        ev.preventDefault();
        speakBtn.click();
      }
    });
    input.addEventListener('focus', () => {
      setTimeout(() => input.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
    });
  
    speakBtn.onclick = async () => {
      const text = input.value.trim();
      if (avatar && text) {
        await avatar.speak({ text });
        input.value = '';
        input.style.height = 'auto';
        input.blur();
        document.querySelector('.chatbot-card, .glass-card')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (progress < MAX_PROGRESS) {
          progress++;
          updateAvatarProgress();
        }
      }
    };
  
    try {
      // KnowledgeBase abrufen
      const { knowledgeBase } = await fetch(
        `${API_BASE}/api/hr-prompt?style=${style}`
      ).then(res => res.json());
  
      let started = false;
      for (let attempt = 1; attempt <= MAX_RETRIES && !started; attempt++) {
        try {
          // Token abrufen
          const tokenRes = await fetch(`${API_BASE}/api/get-access-token`);
          const { token } = await tokenRes.json();
          if (!tokenRes.ok || !token) throw new Error('Ungültiger Token');
          console.log(`Startversuch ${attempt} mit Token`, token);
  
          // Alte Session bereinigen
          if (avatar) await stopAvatar();
  
          avatar = new StreamingAvatar({ token });
          avatar.on(StreamingEvents.STREAM_READY, e => {
            video.srcObject = (e as any).detail as MediaStream;
            video.play();
            speakBtn.disabled = false;
            overlay.style.display = 'none';
            clearInterval(dotInterval!);
          });
  
          // Kurze Verzögerung
          await new Promise(res => setTimeout(res, 300));
  
          // Session starten
          await avatar.createStartAvatar({
            quality: AvatarQuality.High,
            avatarName: 'June_HR_public',
            language: 'de-DE',
            knowledgeBase,
          });
  
          // Begrüßung senden
          const greeting = style === 'soc'
            ? 'Hallo, ich bin June! Schön, dass du da bist. Wie kann ich dich unterstützen?'
            : 'Willkommen. Was ist Ihr Anliegen?';
          await avatar.speak({ text: greeting });
  
          started = true;
        } catch (err: any) {
          // Spezifische Behandlung für 400 Bad Request vom Free-Plan
          const status = err?.status || (err instanceof Error && (err as any).status);
          const isBadRequest = status === 400;
          console.warn(`Versuch ${attempt} fehlgeschlagen:`, err);
          if (!isBadRequest) {
            throw err;
          }
          // Nur bei 400 warten
          if (avatar) await stopAvatar();
          await new Promise(res => setTimeout(res, SESSION_COOLDOWN_MS));
        }
      }
  
      if (!started) {
        throw new Error(`Avatar konnte nach ${MAX_RETRIES} Versuchen nicht gestartet werden`);
      }
    } catch (err) {
      console.error('Avatar-Start endgültig fehlgeschlagen:', err);
      clearInterval(dotInterval!);
      overlay.textContent =
        '❌ Verbindung fehlgeschlagen – bitte warten und Seite neu laden';
      speakBtn.disabled = true;
    } finally {
      isStarting = false;
    }
  }
  