const socket = io("YOUR_BACKEND_URL");

const form = document.getElementById("form");
const input = document.getElementById("input");
const messages = document.getElementById("messages");
const usernameSection = document.getElementById("username-section");
const chatSection = document.getElementById("chat-section");
const usernameInput = document.getElementById("username");
const joinBtn = document.getElementById("join-btn");

let username = "";

joinBtn.addEventListener("click", () => {
  username = usernameInput.value.trim();
  if (username) {
    socket.emit("set username", username);
    usernameSection.style.display = "none";
    chatSection.style.display = "block";
  }
});

form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (input.value) {
    socket.emit("chat message", input.value);
    input.value = "";
  }
});

socket.on("chat message", (msg) => {
  const item = document.createElement("li");
  item.textContent = msg;
  messages.appendChild(item);
  messages.scrollTop = messages.scrollHeight;
});
