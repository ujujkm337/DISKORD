const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const bodyParser = require('body-parser');
const fs = require('fs-extra');

const PORT = 3000;
const USERS_FILE = './users.json';

app.use(bodyParser.json());
app.use(express.static('public'));

// читаем пользователей
let users = fs.existsSync(USERS_FILE)
  ? JSON.parse(fs.readFileSync(USERS_FILE))
  : [];

// регистрация
app.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (users.find(u => u.username === username)) {
    return res.status(400).json({ error: 'Пользователь уже существует' });
  }
  users.push({ username, password });
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  res.json({ success: true });
});

// вход
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ error: 'Неверный логин или пароль' });
  res.json({ success: true });
});

// пользователи онлайн
let onlineUsers = {};

io.on('connection', socket => {
  socket.on('login', username => {
    socket.username = username;
    onlineUsers[username] = socket.id;
    io.emit('onlineUsers', Object.keys(onlineUsers));
  });

  socket.on('chatMessage', msg => {
    io.emit('chatMessage', { user: socket.username, text: msg });
  });

  socket.on('disconnect', () => {
    if (socket.username) {
      delete onlineUsers[socket.username];
      io.emit('onlineUsers', Object.keys(onlineUsers));
    }
  });
});

http.listen(PORT, () => console.log(`🚀 Сервер запущен: http://localhost:${PORT}`));
