const socket = io();
let currentUser = null;
let currentChat = null; // { type: 'private'/'group', id: ... }

const loginBtn = document.getElementById('login-btn');
const registerBtn = document.getElementById('register-btn');
const loginMsg = document.getElementById('login-msg');

loginBtn.onclick = () => auth('/login');
registerBtn.onclick = () => auth('/register');

function auth(url) {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({username,password}) })
        .then(r=>r.json())
        .then(res=>{
            if(res.success){
                currentUser = res.user;
                document.getElementById('auth').style.display='none';
                document.getElementById('chat-container').style.display='flex';
                socket.emit('join', currentUser.id);
                loadGroups();
            } else loginMsg.innerText = res.message;
        });
}

const messagesDiv = document.getElementById('messages');
const sendBtn = document.getElementById('send-btn');
const messageInput = document.getElementById('message-input');

sendBtn.onclick = sendMessage;

function sendMessage() {
    const text = messageInput.value.trim();
    if(!text || !currentChat) return;
    if(currentChat.type === 'private') {
        socket.emit('private_message', { from: currentUser.id, users: [currentUser.id,currentChat.id], text });
    } else if(currentChat.type === 'group') {
        socket.emit('group_message', { from: currentUser.id, groupId: currentChat.id, text });
    }
    messageInput.value='';
}

socket.on('private_message', data => {
    if(currentChat?.type==='private' && currentChat.id===data.users.find(id=>id!==currentUser.id)){
        messagesDiv.innerHTML += `<p><b>${data.from}:</b> ${data.text}</p>`;
    }
});

socket.on('group_message', data => {
    if(currentChat?.type==='group' && currentChat.id===data.groupId){
        messagesDiv.innerHTML += `<p><b>${data.from}:</b> ${data.text}</p>`;
    }
});

socket.on('online_users', users => {
    const privateChatsList = document.getElementById('private-chats-list');
    privateChatsList.innerHTML = '';
    users.forEach(id=>{
        if(id!==currentUser.id){
            const div=document.createElement('div');
            div.innerText='Пользователь '+id;
            div.onclick=()=>openPrivateChat(id);
            privateChatsList.appendChild(div);
        }
    });
});

function openPrivateChat(id) {
    currentChat={type:'private', id};
    messagesDiv.innerHTML='';
}

const createGroupBtn = document.getElementById('create-group-btn');
const modal = document.getElementById('create-group-modal');
const closeBtn = modal.querySelector('.close-btn');
const createConfirmBtn = document.getElementById('create-group-confirm');
const membersList = document.getElementById('members-list');

createGroupBtn.onclick = () => {
    membersList.innerHTML='';
    fetch('/users.json').then(r=>r.json()).then(users=>{
        users.forEach(u=>{
            if(u.id!==currentUser.id){
                const checkbox=document.createElement('input');
                checkbox.type='checkbox'; checkbox.value=u.id; checkbox.id='member_'+u.id;
                const label=document.createElement('label'); label.htmlFor='member_'+u.id; label.innerText=u.username;
                membersList.appendChild(checkbox); membersList.appendChild(label); membersList.appendChild(document.createElement('br'));
            }
        });
        modal.style.display='block';
    });
};
closeBtn.onclick=()=>modal.style.display='none';

createConfirmBtn.onclick=()=>{
    const groupName=document.getElementById('group-name').value;
    const selectedMembers=Array.from(membersList.querySelectorAll('input[type=checkbox]:checked')).map(c=>Number(c.value));
    selectedMembers.push(currentUser.id);
    socket.emit('create_group',{name:groupName,members:selectedMembers});
    modal.style.display='none';
};

const groupsList=document.getElementById('groups-list');
socket.on('new_group', group=>{
    const div=document.createElement('div');
    div.innerText=group.name;
    div.onclick=()=>openGroupChat(group);
    groupsList.appendChild(div);
});

function loadGroups(){
    fetch('/groups.json').then(r=>r.json()).then(allGroups=>{
        groupsList.innerHTML='';
        allGroups.filter(g=>g.members.includes(currentUser.id)).forEach(group=>{
            const div=document.createElement('div'); div.innerText=group.name; div.onclick=()=>openGroupChat(group);
            groupsList.appendChild(div);
        });
    });
}

function openGroupChat(group){
    currentChat={type:'group', id:group.id};
    messagesDiv.innerHTML='';
    group.messages.forEach(m=>{ messagesDiv.innerHTML += `<p><b>${m.from}:</b> ${m.text}</p>`; });
}
