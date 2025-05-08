import './style.css';
type Mode='avatar'|'chat';
const avatarUI=document.getElementById('avatar-ui')!;
const chatUI  =document.getElementById('chat-ui')!;

let current:Mode|null=null;
let cleanup:()=>Promise<void>|void=()=>{};

window.addEventListener('DOMContentLoaded',()=>{
  const p=new URLSearchParams(location.search);
  const initial=(p.get('mode')??'avatar') as Mode;
  (document.querySelector<HTMLInputElement>(`input[name=mode][value=${initial}]`)!).checked=true;
  setMode(initial);
});

document.querySelectorAll('input[name=mode]').forEach(rb=>{
  rb.addEventListener('change',ev=>{
    const mode=(ev.target as HTMLInputElement).value as Mode;
    history.pushState({},'',`?mode=${mode}`);
    setMode(mode);
  });
});

async function setMode(mode:Mode){
  if(mode===current) return;
  await cleanup();

  if(mode==='chat'){
    avatarUI.classList.add('hidden');
    chatUI  .classList.remove('hidden');

    const mod=await import('./features/chatbot');
    cleanup=mod.stopChatbot; mod.startChatbot();
  }else{
    chatUI  .classList.add('hidden');
    avatarUI.classList.remove('hidden');

    const mod=await import('./features/avatar');
    cleanup=mod.stopAvatar; mod.startAvatar();
  }
  current=mode;
}
