import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());
app.use(cookieParser());
// ✅ Настройка для папки public
app.use(express.static("public")); 

// === Инициализация базы данных ===
const db = await open({
  filename: path.join(__dirname, "db.sqlite"),
  driver: sqlite3.Database
});

// Создаём таблицы, если их нет
await db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE,
  password TEXT
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender TEXT,
  receiver TEXT,
  text TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
`);

let clients = {}; // {username: ws}

function send(ws, obj) {
  try {
    ws.send(JSON.stringify(obj));
  } catch (e) {
    console.error("Error sending to WS:", e);
  }
}

function broadcast(obj) {
  Object.values(clients).forEach(ws => send(ws, obj));
}


// === Аутентификация ===
app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.json({ error: "Необходимо ввести имя пользователя и пароль" });
  try {
    // ВАЖНО: В реальном приложении пароль нужно хешировать!
    await db.run("INSERT INTO users (username, password) VALUES (?, ?)", [username, password]);
    res.json({ success: true });
  } catch (e) {
    res.json({ error: "Пользователь с таким именем уже существует" });
  }
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await db.get("SELECT * FROM users WHERE username = ? AND password = ?", [username, password]);

  if (user) {
    res.cookie("user", encodeURIComponent(username), { maxAge: 900000, httpOnly: true });
    res.json({ success: true, user: user.username });
  } else {
    res.json({ success: false, error: "Неверное имя пользователя или пароль" });
  }
});

app.get("/me", (req, res) => {
  const user = req.cookies.user;
  if (user) res.json({ user: user });
  else res.status(401).json({ error: "Unauthorized" });
});

// === Маршрут для загрузки сообщений с поддержкой lastId ===
app.get("/messages", async (req, res) => {
  const { user, withUser, lastId } = req.query;
  let rows = [];
  const lastIdNum = parseInt(lastId) || 0; // Начинаем с ID 0, если не передан

  if (withUser === "all") {
    rows = await db.all(`
      SELECT id, sender, text, timestamp FROM messages 
      WHERE receiver = 'all' AND id > ?
      ORDER BY id ASC
    `, [lastIdNum]);
  } else {
    rows = await db.all(`
      SELECT id, sender, receiver, text, timestamp FROM messages 
      WHERE ((sender = ? AND receiver = ?) OR (sender = ? AND receiver = ?)) AND id > ?
      ORDER BY id ASC
    `, [user, withUser, withUser, user, lastIdNum]);
  }
  res.json(rows);
});

// === WebSocket-сервер ===
wss.on("connection", async (ws, req) => {
  const cookieHeader = req.headers.cookie || "";
  const match = cookieHeader.match(/user=([^;]+)/);
  const username = match ? decodeURIComponent(match[1]) : null;

  if (!username) {
    ws.close();
    return;
  }

  clients[username] = ws;
  broadcast({ type: "user_list", users: Object.keys(clients) });

  ws.on("message", async (msg) => {
    const data = JSON.parse(msg);

    if (data.type === "message") {
      const { text, to } = data;

      // сохраняем в БД и получаем ID сообщения
      const result = await db.run("INSERT INTO messages (sender, receiver, text) VALUES (?, ?, ?)", [username, to, text]);
      const messageId = result.lastID; // Получаем ID последнего вставленного сообщения

      const messageObj = { type: "message", id: messageId, from: username, text, to }; 
      
      if (to === "all") broadcast(messageObj);
      else {
        // Отправляем получателю
        if (clients[to]) send(clients[to], messageObj);
        // Отправляем обратно отправителю (важное исправление для работы на ПК/iPhone!)
        send(ws, messageObj); 
      }
    }
  });

  ws.on("close", () => {
    delete clients[username];
    broadcast({ type: "user_list", users: Object.keys(clients) });
  });
});

server.listen(3000, () => {
  console.log("Сервер запущен на порту 3000");
});
