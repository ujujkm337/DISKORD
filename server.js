const express = require('express');
const http = require('http');
const fs = require('fs');
const app = express();
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server);

app.use(express.static('public'));
app.use(express.json());

let users = [];
let privateChats = [];
let groups = [];
let onlineUsers = [];

// Загружаем данные
if(fs.existsSync('public/users.json')) users = JSON.parse(fs.readFileSync('public/users.json'));
if(fs.existsSync('public/private_chats.json')) privateChats = JSON.parse(fs.readFileSync('public/private_chats.json'));
if(fs.existsSync('public/groups.json')) groups = JSON.parse(fs.readFileSync('public/groups.json'));

// REST API для регистрации
app.post('/register', (req, res) => {
    const { username, password } = req.body;
    if(users.find(u => u.username === username)) return res.json({ success: false, message: 'Пользователь уже существует' });
    const newUser = { id: Date.now(), username, password };
    users.push(newUser);
    fs.writeFileSync('public/users.json', JSON.stringify(users));
    res.json({ success: true, user: newUser });
});

// REST API для входа
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username && u.password === password);
    if(!user) return res.json({ success: false, message: 'Неверные данные' });
    res.json({ success: true, user });
});

// Socket.io
io.on('connection', socket => {
    console.log('User connected:', socket.id);

    socket.on('join', userId => {
        socket.userId = userId;
        if(!onlineUsers.includes(userId)) onlineUsers.push(userId);
        socket.join(`user_${userId}`);
        io.emit('online_users', onlineUsers);
    });

    socket.on('private_message', data => {
        const chat = privateChats.find(c => c.users.sort().join(',') === data.users.sort().join(','));
        if(chat) {
            chat.messages.push({ from: data.from, text: data.text, time: Date.now() });
        } else {
            privateChats.push({ users: data.users, messages: [{ from: data.from, text: data.text, time: Date.now() }] });
        }
        fs.writeFileSync('public/private_chats.json', JSON.stringify(privateChats));
        data.users.forEach(id => io.to(`user_${id}`).emit('private_message', data));
    });

    socket.on('create_group', data => {
        const newGroup = { id: Date.now(), name: data.name, members: data.members, messages: [] };
        groups.push(newGroup);
        fs.writeFileSync('public/groups.json', JSON.stringify(groups));
        data.members.forEach(id => io.to(`user_${id}`).emit('new_group', newGroup));
    });

    socket.on('group_message', data => {
        const group = groups.find(g => g.id === data.groupId);
        if(group) {
            group.messages.push({ from: data.from, text: data.text, time: Date.now() });
            fs.writeFileSync('public/groups.json', JSON.stringify(groups));
            group.members.forEach(id => io.to(`user_${id}`).emit('group_message', data));
        }
    });

    socket.on('disconnect', () => {
        onlineUsers = onlineUsers.filter(id => id !== socket.userId);
        io.emit('online_users', onlineUsers);
        console.log('User disconnected:', socket.id);
    });
});

server.listen(3000, () => console.log('Server running on http://localhost:3000'));
