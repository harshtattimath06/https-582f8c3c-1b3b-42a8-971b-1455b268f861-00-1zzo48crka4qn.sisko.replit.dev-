const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);

app.use(express.static("public"));

io.on("connection", (socket) => {
  console.log("A user connected");

  socket.on("set username", (username) => {
    socket.username = username;
    io.emit("chat message", `${username} joined the chat 💬`);
  });

  socket.on("chat message", (msg) => {
    io.emit("chat message", `${socket.username}: ${msg}`);
  });

  socket.on("disconnect", () => {
    if (socket.username) {
      io.emit("chat message", `${socket.username} left the chat ❌`);
    }
  });
});


http.listen(3000, () => {
  console.log("Server running on port 3000 ");
});