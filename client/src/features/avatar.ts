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
    const input    = document.getElementById('userInput')   as HTMLInputElement;
  
    /* ---------- Session starten ---------- */
    startBtn.onclick = async () => {
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
  