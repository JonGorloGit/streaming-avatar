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
  export async function startAvatar(style: 'soc' | 'ins' = 'soc') {
    speakBtn.disabled = true;
    progress = 0;
    updateAvatarProgress();
  
    // Input-Handling
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
      setTimeout(() => {
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    });
  
    // Sprechbutton-Handler
    speakBtn.onclick = async () => {
      const text = input.value.trim();
      if (avatar && text) {
        await avatar.speak({ text });
  
        input.value = '';
        input.style.height = 'auto';
        input.blur();
  
        document.querySelector('.chatbot-card, .glass-card')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
  
        if (progress < MAX_PROGRESS) {
          progress++;
          updateAvatarProgress();
        }
      }
    };
  
    // "Connecting..." Overlay anzeigen
    overlay.style.display = 'block';
    let dotState = 1;
    dotInterval = setInterval(() => {
      dotState = (dotState % 3) + 1;
      dotsEl.textContent = '.'.repeat(dotState);
    }, 500);
  
    try {
      const token = await fetchTokenWithRetry();
      console.log(token);
      const { knowledgeBase } = await fetch(`${API_BASE}/api/hr-prompt?style=${style}`).then(r => r.json());
  
      avatar = new StreamingAvatar({ token });
  
      avatar.on(StreamingEvents.STREAM_READY, e => {
        video.srcObject = (e as any).detail as MediaStream;
        video.play();
        speakBtn.disabled = false;
        overlay.style.display = 'none';
        clearInterval(dotInterval);
      });
  
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
  
    } catch (err) {
      clearInterval(dotInterval);
      overlay.textContent = '❌ Verbindung fehlgeschlagen';
      console.error('Avatar-Start fehlgeschlagen:', err);
      speakBtn.disabled = true;
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
  