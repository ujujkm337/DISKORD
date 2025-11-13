async function init() {
  const me = await fetch("/me");
  if (!me.ok) {
    location.href = "/login.html";
    return;
  }
  const { user } = await me.json();
  document.getElementById("app").hidden = false;
  document.getElementById("myName").textContent = user;

  const wsProtocol = location.protocol === "https:" ? "wss" : "ws";
  const ws = new WebSocket(`${wsProtocol}://${location.host}`);

  const usersUl = document.getElementById("users");
  const messagesDiv = document.getElementById("messages");
  const input = document.getElementById("msgInput");
  const sendBtn = document.getElementById("sendBtn");
  const header = document.getElementById("chatHeader");
  const allBtn = document.getElementById("allChatBtn");
  const callBtn = document.getElementById("callBtn");

  let currentChat = "all";
  let lastMessageId = 0; // Для отслеживания последнего сообщения

  sendBtn.onclick = sendMessage;
  input.onkeydown = (e) => e.key === "Enter" && sendMessage();
  allBtn.onclick = () => {
    // Сбрасываем активный класс
    Array.from(usersUl.children).forEach(li => li.classList.remove('active')); 
    allBtn.classList.add('active');
    
    currentChat = "all";
    header.textContent = "Общий чат";
    callBtn.hidden = true; // Скрываем кнопку звонка
    loadMessages(true);
  };
  allBtn.click(); // Активируем общий чат при старте

  // --- Критическое исправление: Прием сообщений по WebSocket (для работы на ПК/iPhone) ---
  ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "message") {
          // Если сообщение для текущего чата (или для всех в общем чате)
          const isCurrentChat = (currentChat === "all" && data.to === "all") || 
                               (currentChat === data.from || currentChat === data.to);
          
          if (isCurrentChat) {
              const messageObj = { sender: data.from, text: data.text, id: data.id };
              addMsg(messageObj);
              // Обновляем lastMessageId, если нужно
              if (data.id && data.id > lastMessageId) {
                  lastMessageId = data.id;
              }
          }
      } else if (data.type === "user_list") {
          renderUsers(data.users);
      }
  };
  // -------------------------------------------------------------------

  // --- Загрузка и автообновление сообщений ---
  async function loadMessages(clear = false) {
    // Отправляем lastId, чтобы получить только новые сообщения
    const res = await fetch(`/messages?user=${user}&withUser=${currentChat}&lastId=${lastMessageId}`);
    const msgs = await res.json();
    
    if (clear) {
        messagesDiv.innerHTML = "";
        lastMessageId = 0;
    }

    msgs.forEach(m => addMsg(m));

    // Обновляем lastMessageId после загрузки
    if (msgs.length > 0) {
        lastMessageId = msgs[msgs.length - 1].id || lastMessageId;
    }
  }

  function addMsg(m) {
    const div = document.createElement("div");
    div.className = "message" + (m.sender === user ? " me" : "");
    const senderName = m.sender === user ? "Я" : m.sender;
    div.innerHTML = `<strong>${senderName}:</strong> ${m.text}`;
    messagesDiv.appendChild(div);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  function sendMessage() {
    const text = input.value.trim();
    if (!text) return;
    // Отправляем сообщение на сервер
    ws.send(JSON.stringify({ type: "message", text, to: currentChat })); 
    input.value = "";
  }

  function renderUsers(list) {
    usersUl.innerHTML = "";
    list.forEach(u => {
      if (u === user) return;
      const li = document.createElement("li");
      li.textContent = u;
      li.onclick = () => {
        // Сбрасываем активный класс
        Array.from(usersUl.children).forEach(li => li.classList.remove('active'));
        allBtn.classList.remove('active');
        li.classList.add('active');

        currentChat = u;
        header.textContent = u;
        callBtn.hidden = false; // Показываем кнопку звонка
        loadMessages(true);
      };
      usersUl.appendChild(li);
    });
  }
  
  // ✅ Автоматическое обновление сообщений каждые 5 секунд
  setInterval(() => {
    loadMessages();
  }, 5000);
  
  // --- Заготовка для аудиозвонков ---
  function startCall() {
      if (currentChat === "all") return;
      alert(`Функция аудиозвонка в чат с ${currentChat} еще не реализована. Для ее работы необходима реализация протокола WebRTC и STUN/TURN серверов.`);
  }
  callBtn.onclick = startCall;
}

init();
