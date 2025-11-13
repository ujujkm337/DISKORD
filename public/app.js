// public/app.js

let currentUser = null;
let currentChat = null; // { type: 'general'/'private'/'group', id: ... }

const appDiv = document.getElementById('app');
const myNameH2 = document.getElementById('myName');
const chatHeaderDiv = document.getElementById('chatHeader');
const messagesDiv = document.getElementById('messages');
const msgInput = document.getElementById('msgInput');
const sendBtn = document.getElementById('sendBtn');
const usersList = document.getElementById('users');

let socket = null;

async function init() {
    // 1. Проверяем авторизацию
    try {
        const res = await fetch('/me');
        if (res.status !== 200) {
            throw new Error('Not authenticated');
        }
        currentUser = await res.json();
        
        // 2. Инициализируем чат для авторизованного пользователя
        setupChat(currentUser);
        
    } catch (e) {
        // Если не авторизован, перенаправляем на страницу входа
        console.error("Пользователь не авторизован, перенаправление.");
        window.location.href = '/login';
        return;
    }

    // 3. Keep-Alive: Отправляем запрос каждые 14 минут
    // Это помогает бороться с засыпанием на бесплатных планах хостинга
    setInterval(() => {
        fetch('/me').catch(e => console.log('Keep-alive failed, server sleeping?'));
    }, 840000); 
}

function setupChat(user) {
    myNameH2.textContent = `Вы: ${user.username}`;
    appDiv.hidden = false;

    // 4. Подключаем WebSocket
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    socket = new WebSocket(`${wsProtocol}//${window.location.host}`);

    socket.onopen = () => {
        console.log("WebSocket подключен.");
    };

    socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        handleNewMessage(message);
    };

    socket.onclose = () => {
        console.log("WebSocket отключен. Попытка переподключения через 5 сек.");
        setTimeout(init, 5000); 
    };

    socket.onerror = (error) => {
        console.error("WebSocket ошибка:", error);
    };
    
    // Инициализация общего чата по умолчанию
    currentChat = { type: 'general', id: 'all' };
    chatHeaderDiv.textContent = 'Общий чат';

    // Обработчик отправки сообщения
    sendBtn.onclick = () => {
        const text = msgInput.value.trim();
        if (!text || !currentChat || socket.readyState !== WebSocket.OPEN) return;

        const message = {
            type: 'message',
            chatId: currentChat.id,
            chatType: currentChat.type,
            // На клиенте отправляем только текст, сервер добавит отправителя
            text: text
        };
        
        socket.send(JSON.stringify(message));
        msgInput.value = '';
    };

    // Отправка по Enter
    msgInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            sendBtn.click();
        }
    });
}

function handleNewMessage(message) {
    if (message.type === 'message') {
        // Определяем, наше ли это сообщение
        const isMine = message.sender === currentUser.username;
        displayMessage(message, isMine);
    }
}

// ✅ Обновленная функция для использования новых CSS-классов
function displayMessage(message, isMine = false) {
    const msgElement = document.createElement('div');
    msgElement.classList.add('message');
    if (isMine) {
        // Добавляем класс 'mine' для синего фона и выравнивания вправо
        msgElement.classList.add('mine'); 
    }
    
    msgElement.innerHTML = `<strong>${message.sender}:</strong> ${message.text}`;
    messagesDiv.appendChild(msgElement);
    
    // Прокрутка вниз
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}


init();
