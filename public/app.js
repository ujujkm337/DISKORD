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

  let currentChat = "all";

  sendBtn.onclick = sendMessage;
  input.onkeydown = (e) => e.key === "Enter" && sendMessage();
  allBtn.onclick = () => {
    currentChat = "all";
    header.textContent = "Общий чат";
    loadMessages();
  };

  async function loadMessages() {
    const res = await fetch(`/messages?user=${user}&withUser=${currentChat}`);
    const msgs = await res.json();
    messagesDiv.innerHTML = "";
    msgs.forEach(m => addMsg(m));
  }

  function addMsg(m) {
    const div = document.createElement("div");
    div.className = "message" + (m.sender === user ? " me" : "");
    div.textContent = `${m.sender === user ? "" : m.sender + ": "}${m.text}`;
    messagesDiv.appendChild(div);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  function sendMessage() {
    const text = input.value.trim();
    if (!text) return;
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
        currentChat = u;
        header.textContent = u;
        loadMessages();
      };
      usersUl.appendChild(li);
    });
  }

  ws.onmessage = (e) => {
    const data = JSON.parse(e.data);
    if (data.type === "user_list") renderUsers(data.users);
    if (data.type === "message") {
      if (data.to === "all" || data.from === currentChat || data.from === user)
        addMsg(data);
    }
  };

  loadMessages();
}

init();
