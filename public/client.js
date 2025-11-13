const socket = io();

let currentUser = null;
let currentChat = null;
let currentChatType = null; // "private" or "group"

// Login/Register
document.getElementById('login-btn').onclick = () => loginOrRegister('login');
document.getElementById('register-btn').onclick = () => loginOrRegister('register');

function loginOrRegister(type) {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  fetch(`/${type}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  })
  .then(res => res.json())
  .then(data => {
    if(data.success) {
      currentUser = data.user;
      document.getElementById('login-register').style.display = 'none';
      document.querySelector('.app').style.display = 'flex';
      document.getElementById('current-user').innerText = currentUser.username;
      socket.emit('join', currentUser.id);
    } else {
      document.getElementById('login-msg').innerText = data.message || 'Login failed';
    }
  });
}

// Sending messages
document.getElementById('send-btn').onclick = sendMessage;

function sendMessage() {
  const text = document.getElementById('message-input').value;
  if(!text) return;
  if(currentChatType === 'private') {
    socket.emit('private_message', { from: currentUser.id, to: currentChat.id, text });
  } else if(currentChatType === 'group') {
    socket.emit('group_message', { groupId: currentChat.id, from: currentUser.id, text });
  }
  addMessage(currentUser.username, text, true);
  document.getElementById('message-input').value = '';
}

// Display messages
function addMessage(username, text, self=false) {
  const msgDiv = document.createElement('div');
  msgDiv.classList.add('message');
  if(self) msgDiv.classList.add('self');
  msgDiv.innerText = username + ': ' + text;
  document.getElementById('messages').appendChild(msgDiv);
  msgDiv.scrollIntoView();
}

// TODO: Implement chat selection, group creation, loading existing messages
