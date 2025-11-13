const socket = io();

const authDiv = document.getElementById('auth');
const chatDiv = document.getElementById('chat');
const authMsg = document.getElementById('authMsg');

const regUser = document.getElementById('regUser');
const regPass = document.getElementById('regPass');
const registerBtn = document.getElementById('registerBtn');

const logUser = document.getElementById('logUser');
const logPass = document.getElementById('logPass');
const loginBtn = document.getElementById('loginBtn');

const msgInput = document.getElementById('msg');
const sendBtn = document.getElementById('send');
const messages = document.getElementById('messages');
const usersList = document.getElementById('users');

let username = null;

// регистрация
registerBtn.onclick = async () => {
  const res = await fetch('/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: regUser.value, password: regPass.value })
  });
  const data = await res.json();
  if (data.error) authMsg.textContent = data.error;
  else authMsg.textContent = '✅ Успешная регистрация! Войдите ниже.';
};

// вход
loginBtn.onclick = async () => {
  const res = await fetch('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: logUser.value, password: logPass.value })
  });
  const data = await res.json();
  if (data.error) {
    authMsg.textContent = data.error;
  } else {
    username = logUser.value;
    authDiv.classList.add('hidden');
    chatDiv.classList.remove('hidden');
    socket.emit('login', username);
  }
};

// чат
sendBtn.onclick = () => {
  const text = msgInput.value.trim();
  if (text) {
    socket.emit('chatMessage', text);
    msgInput.value = '';
  }
};

socket.on('chatMessage', data => {
  const div = document.createElement('div');
  div.innerHTML = `<b>${data.user}:</b> ${data.text}`;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
});

socket.on('onlineUsers', list => {
  usersList.innerHTML = '';
  list.forEach(u => {
    const li = document.createElement('li');
    li.textContent = u;
    usersList.appendChild(li);
  });
});
