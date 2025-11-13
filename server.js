const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs-extra');
const bodyParser = require('body-parser');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));
app.use(bodyParser.json());

const USERS_FILE = 'users.json';
const PRIVATE_CHATS_FILE = 'private_chats.json';
const GROUPS_FILE = 'groups.json';

// Utility functions
const readJSON = (file) => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
const writeJSON = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

// Login endpoint
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const users = readJSON(USERS_FILE);
  const user = users.find(u => u.username === username && u.password === password);
  if(user) res.json({ success: true, user });
  else res.json({ success: false });
});

// Register endpoint
app.post('/register', (req, res) => {
  const { username, password } = req.body;
  const users = readJSON(USERS_FILE);
  if(users.find(u => u.username === username)) return res.json({ success: false, message: 'Username exists' });
  const newUser = { id: Date.now(), username, password };
  users.push(newUser);
  writeJSON(USERS_FILE, users);
  res.json({ success: true, user: newUser });
});

// Socket.io real-time chat
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join', (userId) => {
    socket.userId = userId;
    socket.join(`user_${userId}`);
  });

  socket.on('private_message', ({ from, to, text }) => {
    const chats = readJSON(PRIVATE_CHATS_FILE);
    let chat = chats.find(c => c.users.includes(from) && c.users.includes(to));
    if(!chat) {
      chat = { id: Date.now(), users: [from, to], messages: [] };
      chats.push(chat);
    }
    const message = { sender: from, text, timestamp: Date.now() };
    chat.messages.push(message);
    writeJSON(PRIVATE_CHATS_FILE, chats);
    io.to(`user_${from}`).to(`user_${to}`).emit('private_message', message);
  });

  socket.on('group_message', ({ groupId, from, text }) => {
    const groups = readJSON(GROUPS_FILE);
    const group = groups.find(g => g.id === groupId);
    if(!group) return;
    const message = { sender: from, text, timestamp: Date.now() };
    group.messages.push(message);
    writeJSON(GROUPS_FILE, groups);
    group.members.forEach(memberId => {
      io.to(`user_${memberId}`).emit('group_message', { groupId, message });
    });
  });

  socket.on('create_group', ({ name, members }) => {
    const groups = readJSON(GROUPS_FILE);
    const newGroup = { id: Date.now(), name, members, messages: [] };
    groups.push(newGroup);
    writeJSON(GROUPS_FILE, groups);
    members.forEach(memberId => io.to(`user_${memberId}`).emit('group_created', newGroup));
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
