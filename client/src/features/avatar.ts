import StreamingAvatar, {
    AvatarQuality,
    StreamingEvents,
  } from '@heygen/streaming-avatar';
  
  let avatar: StreamingAvatar | null = null;
  const video = document.getElementById('avatarVideo') as HTMLVideoElement;
  
  const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';
  
  let progress = 0;
  const MAX_PROGRESS = 5;
  
  function updateAvatarProgress() {
    const el = document.getElementById('avatar-progress');
    if (!el) return;
    const circle = el.querySelector('.circle') as SVGPathElement;
    const text = el.querySelector('.progress-text')!;
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
   * Startet den Avatar sofort ohne Start-/Stop-Buttons
   * @param style 'soc' | 'ins'
   */
  export async function startAvatar(style: 'soc' | 'ins' = 'soc') {
    const speakBtn = document.getElementById('speakButton') as HTMLButtonElement;
    const input = document.getElementById('userInput') as HTMLTextAreaElement;
  
    progress = 0;
    updateAvatarProgress();
  
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
  
    // Mobile UX: Scroll on input focus
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
        input.blur(); // Mobile keyboard schließen
  
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
  
    try {
      const [{ token }, { knowledgeBase }] = await Promise.all([
        fetch(`${API_BASE}/api/get-access-token`).then(r => r.json()),
        fetch(`${API_BASE}/api/hr-prompt?style=${style}`).then(r => r.json()),
      ]);
  
      avatar = new StreamingAvatar({ token });
  
      avatar.on(StreamingEvents.STREAM_READY, e => {
        video.srcObject = (e as any).detail as MediaStream;
        video.play();
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
      console.error('Avatar-Start fehlgeschlagen:', err);
    }
  }
  
  export async function stopAvatar() {
    if (avatar) {
      await avatar.stopAvatar();
      avatar = null;
    }
  
    video.srcObject = null;
  }
  