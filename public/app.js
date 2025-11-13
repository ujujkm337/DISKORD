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

    // 3. Keep-Alive: Отправляем запрос каждые 14 минут (840000 мс)
    // Это помогает бороться с засыпанием на бесплатных планах Render
    setInterval(() => {
        // Отправляем небольшой, легковесный запрос на маршрут /me
        fetch('/me').catch(e => console.log('Keep-alive failed, server sleeping?'));
    }, 840000); // 14 минут
}

function setupChat(user) {
    myNameH2.textContent = `Вы: ${user.username}`;
    appDiv.hidden = false;

    // 4. Подключаем WebSocket
    // Адрес ws:// или wss:// должен быть абсолютным для хостинга
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    socket = new WebSocket(`${wsProtocol}//${window.location.host}`);

    socket.onopen = () => {
        console.log("WebSocket подключен.");
        // Отправляем на сервер информацию о том, кто мы
        // Сервер сам распознает нас по куки, но мы можем отправить приветствие.
        socket.send(JSON.stringify({ type: 'hello', username: user.username }));
    };

    socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        handleNewMessage(message);
    };

    socket.onclose = () => {
        console.log("WebSocket отключен. Попытка переподключения через 5 сек.");
        // Можно добавить логику для переподключения
        setTimeout(init, 5000); 
    };

    socket.onerror = (error) => {
        console.error("WebSocket ошибка:", error);
    };
    
    // Инициализация общего чата
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
            sender: user.username,
            text: text
        };
        
        socket.send(JSON.stringify(message));
        msgInput.value = '';
        
        // Опционально: показать сообщение сразу в своем чате
        // displayMessage(message, true); 
    };
}

function handleNewMessage(message) {
    // Здесь будет логика для отображения входящих сообщений
    // Пока просто выводим в консоль
    console.log("Новое сообщение:", message);
    if (message.type === 'message') {
        displayMessage(message);
    }
}

function displayMessage(message, isMine = false) {
    const msgElement = document.createElement('div');
    msgElement.classList.add('message');
    if (isMine) {
        msgElement.classList.add('mine');
    }
    
    // Простая разметка сообщения
    msgElement.innerHTML = `<strong>${message.sender}:</strong> ${message.text}`;
    messagesDiv.appendChild(msgElement);
    
    // Прокрутка вниз
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}


init();
