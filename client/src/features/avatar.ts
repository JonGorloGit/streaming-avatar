import StreamingAvatar, {
  AvatarQuality,
  StreamingEvents,
} from '@heygen/streaming-avatar';

  
  let avatar: StreamingAvatar | null = null;
  const video = document.getElementById('avatarVideo') as HTMLVideoElement;
  
  /**
   * Startet den Avatar
   * @param style 'soc' (empathisch) | 'ins' (formal)
   */

  export async function startAvatar(style: 'soc' | 'ins' = 'soc') {
    const startBtn = document.getElementById('startSession') as HTMLButtonElement;
    const stopBtn  = document.getElementById('endSession')  as HTMLButtonElement;
    const speakBtn = document.getElementById('speakButton') as HTMLButtonElement;
    const input = document.getElementById('userInput') as HTMLTextAreaElement;

    input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, window.innerHeight * 0.3) + 'px';
      });
  
    /* ---------- Session starten ---------- */
    startBtn.onclick = async () => {
        input.addEventListener('keydown', ev => {
            if (ev.key === 'Enter' && !ev.shiftKey) {
              ev.preventDefault();
              speakBtn.click();
            }
            // Shift + Enter erlaubt Zeilenumbruch
          });

      try {
        const [{ token }, { knowledgeBase }] = await Promise.all([
          fetch('/api/get-access-token').then(r => r.json()),
          fetch(`/api/hr-prompt?style=${style}`).then(r => r.json()),
        ]);
  
        avatar = new StreamingAvatar({ token });
  
        avatar.on(StreamingEvents.STREAM_READY, e => {
          video.srcObject = (e as any).detail as MediaStream;
          video.play();
        });
  
        await avatar.createStartAvatar({
          quality      : AvatarQuality.High,
          avatarName   : 'June_HR_public',
          language     : 'de-DE',
          knowledgeBase,                       // Prompt aus Server
        });

        // Direkt nach dem Start begrüßen (stilabhängig)
        const greeting = style === 'soc'
            ? 'Hallo! Schön, dass Sie da sind. Wie kann ich Ihnen helfen?'
            : 'Willkommen. Was ist Ihr Anliegen?';

        await avatar.speak({ text: greeting });
  
        startBtn.disabled = true;
        stopBtn .disabled = false;
      } catch (err) {
        console.error('Avatar-Start fehlgeschlagen:', err);
      }
    };
  
    /* ---------- Session stoppen ---------- */
    stopBtn.onclick = stopAvatar;
  
    /* ---------- Text sprechen ---------- */
    speakBtn.onclick = async () => {
      if (avatar && input.value.trim()) {
        await avatar.speak({ text: input.value.trim() });
        input.value = '';
      }
    };
  }
  
  /* Beendet laufende Avatar-Session */
  export async function stopAvatar() {
    if (avatar) {
      await avatar.stopAvatar();
      avatar = null;
    }
    (document.getElementById('startSession') as HTMLButtonElement).disabled = false;
    (document.getElementById('endSession')   as HTMLButtonElement).disabled = true;
    video.srcObject = null;
  }
  