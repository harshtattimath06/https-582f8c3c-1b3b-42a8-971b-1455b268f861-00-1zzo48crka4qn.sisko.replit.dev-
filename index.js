const express = require("express");
const path = require("path");
const app = express();
const http = require("http").createServer(app);

// Initialize Socket.IO with CORS support for seamless local and remote connections
const io = require("socket.io")(http, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Serve static frontend files from public directory
app.use(express.static(path.join(__dirname, "public")));

// Fallback route to serve index.html directly
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Helper function to format timestamp
function getTimestamp() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Track active users
const connectedUsers = new Map();

io.on("connection", (socket) => {
  console.log(`[Socket Connected] ID: ${socket.id}`);

  // Broadcast current total connected clients count
  io.emit("user count", io.engine.clientsCount);

  // Set nickname / username
  socket.on("set username", (rawUsername) => {
    const username = (typeof rawUsername === "string" ? rawUsername : "").trim().slice(0, 25) || "Anonymous";
    socket.username = username;
    connectedUsers.set(socket.id, username);

    console.log(`[User Joined] ${username} (${socket.id})`);

    // Emit system join notification to everyone
    io.emit("chat message", {
      id: "sys-" + Date.now(),
      type: "system",
      username: "System",
      text: `${username} joined the chat 💬`,
      timestamp: getTimestamp()
    });

    // Update active user count
    io.emit("user count", io.engine.clientsCount);
  });

  // Handle incoming chat messages
  socket.on("chat message", (msg) => {
    const rawText = typeof msg === "string" ? msg : msg?.text;
    const text = (rawText || "").trim();

    if (!text) return;

    const username = socket.username || "Anonymous";
    const payload = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      type: "user",
      username: username,
      text: text,
      timestamp: getTimestamp()
    };

    console.log(`[Message] ${username}: ${text}`);
    io.emit("chat message", payload);
  });

  // Handle typing indicator
  socket.on("typing", (isTyping) => {
    socket.broadcast.emit("typing", {
      username: socket.username || "Someone",
      isTyping: Boolean(isTyping)
    });
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log(`[Socket Disconnected] ID: ${socket.id} (${socket.username || "unregistered"})`);

    if (socket.username) {
      io.emit("chat message", {
        id: "sys-" + Date.now(),
        type: "system",
        username: "System",
        text: `${socket.username} left the chat ❌`,
        timestamp: getTimestamp()
      });
      connectedUsers.delete(socket.id);
    }

    io.emit("user count", io.engine.clientsCount);
  });
});

// Start HTTP Server
const server = http.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\n⚠️ Port ${PORT} is already in use by another process.`);
    console.error(`To use a different port, set the PORT environment variable:`);
    console.error(`  PowerShell: $env:PORT=3001; npm start`);
    console.error(`  CMD:        set PORT=3001 && npm start`);
    console.error(`  Bash:       PORT=3001 npm start\n`);
    process.exit(1);
  } else {
    console.error("Server error:", err);
  }
});