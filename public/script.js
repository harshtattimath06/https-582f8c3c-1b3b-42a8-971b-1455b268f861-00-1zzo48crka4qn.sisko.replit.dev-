// WhisperConnect+ Client Script
// Automatic server connection (works on localhost:3000, custom domains, or Live Server)
const backendUrl = (window.location.protocol === "file:" || window.location.port === "5500" || window.location.port === "5173")
  ? "http://localhost:3000"
  : undefined;

const socket = io(backendUrl);

// DOM Elements
const usernameSection = document.getElementById("username-section");
const chatSection = document.getElementById("chat-section");
const usernameForm = document.getElementById("username-form");
const usernameInput = document.getElementById("username");
const avatarPreview = document.getElementById("avatar-preview");
const avatarLetter = document.getElementById("avatar-letter");
const headerUserAvatar = document.getElementById("header-user-avatar");
const currentUserName = document.getElementById("current-user-name");
const loginStatusText = document.getElementById("login-status-text");
const loginStatus = document.querySelector("#login-status .status-indicator");
const connectionStatusChip = document.getElementById("connection-status-chip");
const statusLabel = document.getElementById("status-label");
const onlineCount = document.getElementById("online-count");

const messagesContainer = document.getElementById("messages-container");
const messagesList = document.getElementById("messages");
const form = document.getElementById("form");
const input = document.getElementById("input");
const typingIndicator = document.getElementById("typing-indicator");
const typingText = document.getElementById("typing-text");
const soundToggleBtn = document.getElementById("sound-toggle-btn");
const soundIcon = document.getElementById("sound-icon");
const leaveBtn = document.getElementById("leave-btn");
const reactionBtns = document.querySelectorAll(".reaction-btn");

// App State
let myUsername = "";
let soundEnabled = true;
let typingTimeout = null;
let isTyping = false;

// Audio Synthesizer for subtle chat chimes (Web Audio API)
let audioCtx = null;
function playNotificationSound(isOwn = false) {
  if (!soundEnabled) return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === "suspended") audioCtx.resume();

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";

    const now = audioCtx.currentTime;
    if (isOwn) {
      // Gentle subtle click for own sent message
      osc.frequency.setValueAtTime(580, now);
      osc.frequency.exponentialRampToValueAtTime(780, now + 0.08);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
    } else {
      // Pleasant chime for incoming message
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.setValueAtTime(900, now + 0.08);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.start(now);
      osc.stop(now + 0.22);
    }

    osc.connect(gain);
    gain.connect(audioCtx.destination);
  } catch (err) {
    // Ignore audio context autoplay restriction until user interaction
  }
}

// Generate consistent avatar color based on name
function getAvatarGradient(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue1 = Math.abs(hash % 360);
  const hue2 = (hue1 + 45) % 360;
  return `linear-gradient(135deg, hsl(${hue1}, 70%, 50%), hsl(${hue2}, 75%, 45%))`;
}

// Update avatar preview as user types name
usernameInput.addEventListener("input", (e) => {
  const val = e.target.value.trim();
  if (val) {
    avatarLetter.textContent = val.charAt(0).toUpperCase();
    avatarPreview.style.background = getAvatarGradient(val);
  } else {
    avatarLetter.textContent = "?";
    avatarPreview.style.background = "linear-gradient(135deg, #10b981, #06b6d4)";
  }
});

// Socket Connection Status Listeners
socket.on("connect", () => {
  console.log("Connected to server successfully!");
  if (loginStatus) {
    loginStatus.className = "status-indicator online";
  }
  if (loginStatusText) {
    loginStatusText.textContent = "Connected to server (Ready)";
  }
  if (statusLabel) {
    statusLabel.textContent = "Live";
  }
  if (connectionStatusChip) {
    connectionStatusChip.style.background = "rgba(16, 185, 129, 0.12)";
    connectionStatusChip.style.color = "#10b981";
  }
});

socket.on("disconnect", () => {
  console.log("Disconnected from server");
  if (loginStatus) {
    loginStatus.className = "status-indicator offline";
  }
  if (loginStatusText) {
    loginStatusText.textContent = "Disconnected (Retrying...)";
  }
  if (statusLabel) {
    statusLabel.textContent = "Offline";
  }
  if (connectionStatusChip) {
    connectionStatusChip.style.background = "rgba(239, 68, 68, 0.12)";
    connectionStatusChip.style.color = "#ef4444";
  }
});

socket.on("connect_error", (err) => {
  console.warn("Connection error:", err.message);
  if (loginStatus) {
    loginStatus.className = "status-indicator offline";
  }
  if (loginStatusText) {
    loginStatusText.textContent = "Connection failed - is server running?";
  }
});

// Online Users Count Listener
socket.on("user count", (count) => {
  if (onlineCount) {
    onlineCount.textContent = `👥 ${count} online`;
  }
});

// Join Room Form Handler
usernameForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = usernameInput.value.trim();
  if (!name) return;

  myUsername = name;
  socket.emit("set username", myUsername);

  currentUserName.textContent = myUsername;
  headerUserAvatar.textContent = myUsername.charAt(0).toUpperCase();
  headerUserAvatar.style.background = getAvatarGradient(myUsername);

  usernameSection.style.display = "none";
  chatSection.style.display = "flex";
  input.focus();
});

// Format Time helper
function formatCurrentTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Append Chat Message to UI
function appendMessage({ text, author, isSystem = false, timestamp = formatCurrentTime() }) {
  const li = document.createElement("li");
  li.classList.add("msg-item");

  if (isSystem) {
    li.classList.add("system");
    li.innerHTML = `
      <div class="system-pill">
        <span>${escapeHtml(text)}</span>
      </div>
    `;
  } else {
    const isMe = author === myUsername;
    li.classList.add(isMe ? "outgoing" : "incoming");

    const authorHtml = !isMe ? `<div class="msg-header"><span class="msg-author">${escapeHtml(author)}</span></div>` : "";
    
    li.innerHTML = `
      ${authorHtml}
      <div class="msg-bubble">${escapeHtml(text)}</div>
      <div class="msg-footer">
        <span class="msg-time">${timestamp}</span>
      </div>
    `;
  }

  messagesList.appendChild(li);
  // Auto-scroll to bottom
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Security: escape HTML in user messages
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// Message Listener from Server
socket.on("chat message", (data) => {
  // Support both rich object format and raw string format
  if (typeof data === "object" && data !== null) {
    const isMe = data.username === myUsername;
    appendMessage({
      text: data.text,
      author: data.username,
      isSystem: data.type === "system",
      timestamp: data.timestamp || formatCurrentTime()
    });
    if (data.type !== "system") {
      playNotificationSound(isMe);
    }
  } else if (typeof data === "string") {
    // Check if string message is a system notification (e.g. joined/left)
    if (data.includes("joined the chat") || data.includes("left the chat")) {
      appendMessage({
        text: data,
        author: "System",
        isSystem: true
      });
    } else {
      // Legacy formatted string "Username: message"
      const colonIdx = data.indexOf(":");
      let author = "Anonymous";
      let text = data;
      if (colonIdx > -1) {
        author = data.substring(0, colonIdx).trim();
        text = data.substring(colonIdx + 1).trim();
      }
      const isMe = author === myUsername;
      appendMessage({
        text: text,
        author: author,
        isSystem: false
      });
      playNotificationSound(isMe);
    }
  }
});

// System announcement listener
socket.on("system message", (msg) => {
  appendMessage({
    text: msg,
    author: "System",
    isSystem: true
  });
});

// Typing Indicator Listener
let typingHideTimeout = null;
socket.on("typing", (data) => {
  if (!data || data.username === myUsername) return;

  if (data.isTyping) {
    typingText.textContent = `${data.username} is typing...`;
    typingIndicator.style.display = "flex";
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    clearTimeout(typingHideTimeout);
    typingHideTimeout = setTimeout(() => {
      typingIndicator.style.display = "none";
    }, 3000);
  } else {
    typingIndicator.style.display = "none";
  }
});

// User Typing Events (Emit to server)
input.addEventListener("input", () => {
  if (!isTyping) {
    isTyping = true;
    socket.emit("typing", true);
  }

  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    isTyping = false;
    socket.emit("typing", false);
  }, 1500);
});

// Send Message Handler
function sendMessage(msgText) {
  const text = (msgText || input.value).trim();
  if (!text) return;

  // Send to socket
  socket.emit("chat message", text);

  // Clear typing state
  if (isTyping) {
    isTyping = false;
    socket.emit("typing", false);
  }

  input.value = "";
  input.focus();
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  sendMessage();
});

// Quick Reaction Emojis
reactionBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    const emoji = btn.getAttribute("data-emoji");
    if (emoji) {
      sendMessage(emoji);
    }
  });
});

// Sound Toggle Button
soundToggleBtn.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  soundIcon.textContent = soundEnabled ? "🔔" : "🔕";
  soundToggleBtn.title = soundEnabled ? "Mute message sounds" : "Enable message sounds";
});

// Leave Room Button
leaveBtn.addEventListener("click", () => {
  if (confirm("Are you sure you want to leave the chat room?")) {
    window.location.reload();
  }
});
