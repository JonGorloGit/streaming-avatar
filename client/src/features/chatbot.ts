const API_BASE = import.meta.env.VITE_API_BASE || '';

let sendBtn: HTMLButtonElement;
let inputEl: HTMLTextAreaElement;
let bodyEl: HTMLElement;

export function startChatbot() {
  sendBtn = document.getElementById('chat-send')  as HTMLButtonElement;
  inputEl = document.getElementById('chat-input') as HTMLTextAreaElement;
  bodyEl  = document.getElementById('chatbot-body')!;

  inputEl.addEventListener('input', autoResize);

    function autoResize() {
        inputEl.style.height = 'auto';                // zurücksetzen
        inputEl.style.height = Math.min(
        inputEl.scrollHeight,
        window.innerHeight * 0.3                    // 30 % von Viewport ≈ ⅓ Card
    ) + 'px';
}

  sendBtn.onclick = async () => {
    const txt = inputEl.value.trim();
    if (!txt) return;

    append('user', txt);
    inputEl.value = '';
    inputEl.focus();
    sendBtn.disabled = true;

    try {
      const { response } = await fetch(`${API_BASE}/api/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: txt }),
      }).then(r => r.json());

      append('bot', response);
    } catch {
      append('bot', 'Fehler beim Server');
    } finally {
      sendBtn.disabled = false;
    }
  };
}

export function stopChatbot() {
  if (sendBtn) sendBtn.onclick = null;
  if (inputEl) inputEl.value = '';
  if (bodyEl)  bodyEl.innerHTML = '';
}

function append(sender: 'user' | 'bot', text: string) {
  const el = document.createElement('article');
  el.className = `message ${sender}`;
  el.textContent = text;
  bodyEl.appendChild(el);
  bodyEl.scrollTop = bodyEl.scrollHeight;
}
