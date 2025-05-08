import StreamingAvatar, {
  AvatarQuality,
  StreamingEvents
} from "@heygen/streaming-avatar";

const API_BASE = import.meta.env.VITE_API_BASE as string;

const videoElement = document.getElementById("avatarVideo") as HTMLVideoElement;
const startButton  = document.getElementById("startSession")  as HTMLButtonElement;
const endButton    = document.getElementById("endSession")    as HTMLButtonElement;
const speakButton  = document.getElementById("speakButton")   as HTMLButtonElement;
const userInput    = document.getElementById("userInput")     as HTMLInputElement;

let avatar: StreamingAvatar | null = null;

async function fetchAccessToken(): Promise<string> {
  const res = await fetch(`${API_BASE}/api/get-access-token`);
  if (!res.ok) {
    const txt = await res.text();
    console.error("❌ Token-Fehler:", txt);
    throw new Error("Token konnte nicht geladen werden");
  }
  const { token } = await res.json();
  return token;
}

async function initializeAvatarSession() {
  try {
    const token = await fetchAccessToken();
    avatar = new StreamingAvatar({ token });
    avatar.on(StreamingEvents.STREAM_READY, handleStreamReady);
    await avatar.createStartAvatar({
      quality: AvatarQuality.High,
      avatarName: "June_HR_public",
      language: "de-DE",
    });
    startButton.disabled = true;
    endButton.disabled   = false;
  } catch (err) {
    console.error("❌ Initialisierung fehlgeschlagen:", err);
  }
}

function handleStreamReady(event: any) {
  if (event.detail) {
    videoElement.srcObject = event.detail as MediaStream;
    videoElement.onloadedmetadata = () => videoElement.play().catch(console.error);
  }
}

async function terminateAvatarSession() {
  if (avatar) {
    await avatar.stopAvatar();
    videoElement.srcObject = null;
    startButton.disabled = false;
    endButton.disabled   = true;
    avatar = null;
  }
}

async function handleSpeak() {
  if (avatar && userInput.value) {
    await avatar.speak({ text: userInput.value });
    userInput.value = "";
  }
}

startButton.addEventListener("click", initializeAvatarSession);
endButton.addEventListener("click", terminateAvatarSession);
speakButton.addEventListener("click", handleSpeak);
