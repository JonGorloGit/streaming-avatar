import StreamingAvatar,{AvatarQuality,StreamingEvents}from'@heygen/streaming-avatar';

let avatar:StreamingAvatar|null=null;
const video=document.getElementById('avatarVideo') as HTMLVideoElement;

export async function startAvatar(){
  const start=document.getElementById('startSession') as HTMLButtonElement;
  const stop =document.getElementById('endSession')   as HTMLButtonElement;
  const speak=document.getElementById('speakButton')  as HTMLButtonElement;
  const input=document.getElementById('userInput')    as HTMLInputElement;

  start.onclick=async()=>{
    const {token}=await fetch('/api/get-access-token').then(r=>r.json());
    avatar=new StreamingAvatar({token});
    avatar.on(StreamingEvents.STREAM_READY,e=>{
      video.srcObject=(e as any).detail as MediaStream;
      video.play();
    });
    await avatar.createStartAvatar({quality:AvatarQuality.High,avatarName:'June_HR_public',language:"de-DE"});
    start.disabled=true;stop.disabled=false;
  };

  stop .onclick=stopAvatar;
  speak.onclick=async()=>{if(avatar&&input.value){await avatar.speak({text:input.value});input.value='';}};
}

export async function stopAvatar(){
  if(avatar){await avatar.stopAvatar();avatar=null;}
  (document.getElementById('startSession') as HTMLButtonElement).disabled=false;
  (document.getElementById('endSession')   as HTMLButtonElement).disabled=true;
  video.srcObject=null;
}
