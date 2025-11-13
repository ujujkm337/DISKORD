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

// === Аутентификация ===
app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: "Введите логин и пароль" });

  try {
    await db.run("INSERT INTO users (username, password) VALUES (?, ?)", [username, password]);
    res.json({ ok: true });
  } catch {
    res.status(400).json({ error: "Пользователь уже существует" });
  }
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await db.get("SELECT * FROM users WHERE username = ? AND password = ?", [username, password]);
  if (!user) return res.status(401).json({ error: "Неверные данные" });

  res.cookie("user", username, { httpOnly: false });
  res.json({ ok: true });
});

app.get("/me", (req, res) => {
  if (req.cookies.user) res.json({ user: req.cookies.user });
  else res.status(401).end();
});

// === История сообщений ===
app.get("/messages", async (req, res) => {
  const { user, withUser } = req.query;
  if (!user) return res.status(400).end();

  let rows;
  if (withUser === "all") {
    rows = await db.all("SELECT * FROM messages WHERE receiver = 'all' ORDER BY id ASC");
  } else {
    rows = await db.all(`
      SELECT * FROM messages 
      WHERE (sender = ? AND receiver = ?)
         OR (sender = ? AND receiver = ?)
      ORDER BY id ASC
    `, [user, withUser, withUser, user]);
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

      // сохраняем в БД
      await db.run("INSERT INTO messages (sender, receiver, text) VALUES (?, ?, ?)", [username, to, text]);

      const messageObj = { type: "message", from: username, text, to };
      if (to === "all") broadcast(messageObj);
      else {
        if (clients[to]) send(clients[to], messageObj);
        send(ws, messageObj);
      }
    }
  });

  ws.on("close", () => {
    delete clients[username];
    broadcast({ type: "user_list", users: Object.keys(clients) });
  });
});

function send(ws, msg) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}
function broadcast(msg) {
  for (const u in clients) send(clients[u], msg);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("✅ Server running on port " + PORT));
