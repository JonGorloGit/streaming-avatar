import StreamingAvatar, {
    AvatarQuality,
    StreamingEvents,
  } from '@heygen/streaming-avatar';
  
  let avatar: StreamingAvatar | null = null;
  let isStarting = false;
  
  const video    = document.getElementById('avatarVideo')   as HTMLVideoElement;
  const speakBtn = document.getElementById('speakButton')   as HTMLButtonElement;
  const input    = document.getElementById('userInput')     as HTMLTextAreaElement;
  const overlay  = document.getElementById('connecting-overlay')!;
  const dotsEl   = document.getElementById('dots')!;

  speakBtn.disabled = true;
  
  const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';
  const MAX_PROGRESS = 5;
  
  let progress = 0;
  let dotInterval: any = null;
  
  /* ───────────── Fortschritt ───────────── */
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
  
  /* ───────────── Avatar stoppen ───────────── */
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
  
  /* ───────────── Avatar starten ───────────── */
  export async function startAvatar(style: 'soc' | 'ins' = 'soc') {
    if (isStarting) {
      console.warn('Avatar-Start läuft bereits');
      return;
    }
  
    isStarting = true;
    progress = 0;
    updateAvatarProgress();
  
    overlay.style.display = 'block';
    let dotState = 1;
    dotInterval = setInterval(() => {
      dotState = (dotState % 3) + 1;
      dotsEl.textContent = '.'.repeat(dotState);
    }, 500);
  
    try {
      // Eingabe-Handling
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
  
      speakBtn.onclick = async () => {
        const text = input.value.trim();
        if (avatar && text) {
          await avatar.speak({ text });
          input.value = '';
          input.style.height = 'auto';
          input.blur();
          document.querySelector('.chatbot-card, .glass-card')?.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
          if (progress < MAX_PROGRESS) {
            progress++;
            updateAvatarProgress();
          }
        }
      };
  
      const { knowledgeBase } = await fetch(`${API_BASE}/api/hr-prompt?style=${style}`).then(r => r.json());
  
      let started = false;
  
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const tokenRes = await fetch(`${API_BASE}/api/get-access-token`);
          const { token } = await tokenRes.json();
  
          if (!token || !tokenRes.ok) {
            console.warn(`Token ungültig bei Versuch ${attempt}`);
            continue;
          }
  
          console.log(`Versuch ${attempt}: Avatar wird gestartet mit Token`, token);
  
          if (avatar) {
            try { await avatar.stopAvatar(); } catch (_) {}
            avatar = null;
          }
  
          avatar = new StreamingAvatar({ token });
  
          avatar.on(StreamingEvents.STREAM_READY, e => {
            video.srcObject = (e as any).detail as MediaStream;
            video.play();
            speakBtn.disabled = false;
            overlay.style.display = 'none';
            clearInterval(dotInterval);
          });
  
          await new Promise(res => setTimeout(res, 300)); // Delay für Stabilität
  
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
          started = true;
          break;
        } catch (err) {
          console.warn(`Fehlgeschlagener Versuch ${attempt}`, err);
          await new Promise(res => setTimeout(res, 1000)); // kurze Pause vor Retry
        }
      }
  
      if (!started) {
        throw new Error('Avatar konnte nach 3 Versuchen nicht gestartet werden');
      }
  
    } catch (err) {
      console.error('Avatar-Start gescheitert:', err);
      clearInterval(dotInterval);
      overlay.textContent = '❌ Verbindung fehlgeschlagen';
      speakBtn.disabled = true;
    } finally {
      isStarting = false;
    }
  }
  