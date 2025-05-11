import StreamingAvatar, {
    AvatarQuality,
    StreamingEvents,
  } from '@heygen/streaming-avatar';
  
  let avatar: StreamingAvatar | null = null;
  
  const video    = document.getElementById('avatarVideo')   as HTMLVideoElement;
  const speakBtn = document.getElementById('speakButton')   as HTMLButtonElement;
  const input    = document.getElementById('userInput')     as HTMLTextAreaElement;
  const overlay  = document.getElementById('connecting-overlay')!;
  const dotsEl   = document.getElementById('dots')!;
  
  const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';
  const MAX_PROGRESS = 5;
  
  let progress    = 0;
  let dotInterval: any = null;
  
  /* ─────────── Fortschrittsanzeige ─────────── */
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
  
  /* ─────────── Token Retry-Logik ─────────── */
  async function fetchTokenWithRetry(maxTries = 3): Promise<string> {
    for (let attempt = 1; attempt <= maxTries; attempt++) {
      try {
        const res = await fetch(`${API_BASE}/api/get-access-token?ts=${Date.now()}`);
        const json = await res.json();
        if (res.ok && json?.token) return json.token;
  
        console.warn(`Token-Versuch ${attempt} fehlgeschlagen`, json);
      } catch (err) {
        console.warn(`Token-Versuch ${attempt} hat Fehler verursacht`, err);
      }
  
      await new Promise(res => setTimeout(res, 1000));
    }
  
    throw new Error('Token konnte nicht geladen werden');
  }
  
  /* ─────────── Avatar starten ─────────── */
  let isStarting = false;

export async function startAvatar(style: 'soc' | 'ins' = 'soc') {
  if (isStarting) {
    console.warn('Avatar-Start bereits läuft – Abbruch.');
    return;
  }

  isStarting = true;
  speakBtn.disabled = true;
  progress = 0;
  updateAvatarProgress();

  const connectingOverlay = document.getElementById('connecting-overlay')!;
  const dotsEl = document.getElementById('dots')!;
  let dotState = 1;
  let dotInterval: any = setInterval(() => {
    dotState = (dotState % 3) + 1;
    dotsEl.textContent = '.'.repeat(dotState);
  }, 500);
  connectingOverlay.style.display = 'block';

  try {
    const { knowledgeBase } = await fetch(`${API_BASE}/api/hr-prompt?style=${style}`).then(r => r.json());

    let success = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const tokenRes = await fetch(`${API_BASE}/api/get-access-token`);
        const { token } = await tokenRes.json();

        if (!token || !tokenRes.ok) throw new Error('Token ungültig');

        console.log(`Versuch ${attempt}: Starte Avatar mit Token:`, token);

        if (avatar) {
          try { await avatar.stopAvatar(); } catch (_) {}
          avatar = null;
        }

        avatar = new StreamingAvatar({ token });

        avatar.on(StreamingEvents.STREAM_READY, e => {
          video.srcObject = (e as any).detail as MediaStream;
          video.play();
          speakBtn.disabled = false;
          connectingOverlay.style.display = 'none';
          clearInterval(dotInterval);
        });

        await new Promise(res => setTimeout(res, 300)); // render delay
        await avatar.createStartAvatar({
          quality: AvatarQuality.High,
          avatarName: 'June_HR_public',
          language: 'de-DE',
          knowledgeBase,
        });

        const greeting = style === 'soc'
          ? 'Hallo, ich bin June! Schön, dass du da bist. Wie kann ich dich unterstützen? (stelle dich mit Namen vor)'
          : 'Willkommen, mein Name ist June. Was ist Ihr Anliegen? (stelle dich mit Namen vor)';

        await avatar.speak({ text: greeting });
        success = true;
        break;

      } catch (sessionErr) {
        console.warn(`Avatar-Start Versuch ${attempt} fehlgeschlagen`, sessionErr);
        await new Promise(res => setTimeout(res, 1000)); // kurze Pause vor Retry
      }
    }

    if (!success) {
      throw new Error('Avatar konnte nach 3 Versuchen nicht gestartet werden');
    }

  } catch (err) {
    clearInterval(dotInterval);
    connectingOverlay.textContent = '❌ Verbindung fehlgeschlagen';
    speakBtn.disabled = true;
    console.error('Avatar-Start endgültig fehlgeschlagen:', err);
  } finally {
    isStarting = false;
  }
}
  
  /* ─────────── Avatar stoppen ─────────── */
  export async function stopAvatar() {
    if (avatar) {
      await avatar.stopAvatar();
      avatar = null;
    }
  
    video.srcObject = null;
  }
  