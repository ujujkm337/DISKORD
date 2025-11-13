import express from 'express';
import cookieParser from 'cookie-parser';
import http from 'http';
import { WebSocketServer } from 'ws'; // ✅ ИСПРАВЛЕНИЕ: Импорт для WSS
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

// --- Константы и утилиты ---

const app = express();
app.use(express.json());
app.use(cookieParser());

// Обслуживаем статические файлы из папки public
app.use(express.static('public'));

const USERS_FILE = 'users.json'; 
const PRIVATE_CHATS_FILE = 'private_chats.json';
const GROUPS_FILE = 'groups.json';

/** Чтение JSON-файла */
async function readJSONFile(filename) {
    try {
        const data = await fs.readFile(filename, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            await fs.writeFile(filename, '[]', 'utf8');
            return [];
        }
        console.error(`Ошибка чтения файла ${filename}:`, error);
        return [];
    }
}

/** Запись JSON-файла */
async function writeJSONFile(filename, data) {
    try {
        await fs.writeFile(filename, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error(`Ошибка записи файла ${filename}:`, error);
    }
}

// --- WebSocket и HTTP-сервер ---

const server = http.createServer(app); // Создаем HTTP-сервер

// === WebSocket-сервер ===
const wss = new WebSocketServer({ server }); // ✅ ИНИЦИАЛИЗАЦИЯ WSS (привязка к HTTP-серверу)

// Карта для хранения активных WebSocket-соединений по имени пользователя
const clients = new Map();

wss.on("connection", async (ws, req) => {
    const cookieHeader = req.headers.cookie || "";
    const match = cookieHeader.match(/user=([^;]+)/);
    
    // Получаем имя пользователя из куки
    const username = match ? decodeURIComponent(match[1]) : null; 

    if (!username) {
        ws.close();
        return;
    }

    console.log(`Пользователь ${username} подключился через WebSocket.`);
    
    // Сохраняем соединение
    clients.set(username, ws);

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        
        if (data.type === 'message') {
            const fullMessage = {
                type: 'message',
                sender: username,
                text: data.text,
                timestamp: new Date().toISOString()
            };
            
            // Логика рассылки сообщений (пока только общий чат)
            wss.clients.forEach(client => {
                if (client.readyState === ws.OPEN) {
                    client.send(JSON.stringify(fullMessage));
                }
            });
        }
    });

    ws.on('close', () => {
        console.log(`Пользователь ${username} отключился.`);
        clients.delete(username);
    });
});

// --- Express-маршруты ---

// GET /login - Показывает страницу входа/регистрации
app.get('/login', (req, res) => {
    // Используем path.resolve для надежности
    res.sendFile(path.resolve('public', 'login.html'));
});

// GET / - Главная страница
app.get('/', (req, res) => {
    const username = req.cookies.user;
    if (!username) {
        return res.redirect('/login');
    }
    res.sendFile(path.resolve('public', 'index.html'));
});

// POST /register - Регистрация
app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    const users = await readJSONFile(USERS_FILE);

    if (!username || !password) {
        return res.status(400).json({ success: false, error: 'Заполните все поля' });
    }

    if (users.find(u => u.username === username)) {
        return res.status(409).json({ success: false, error: 'Пользователь с таким именем уже существует' });
    }
    
    const newUser = { id: uuidv4(), username, password };
    users.push(newUser);
    await writeJSONFile(USERS_FILE, users);

    res.json({ success: true, message: 'Регистрация успешна' });
});

// POST /login - Вход
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const users = await readJSONFile(USERS_FILE);

    const user = users.find(u => u.username === username && u.password === password);
    
    if (user) {
        // Устанавливаем куки
        res.cookie('user', encodeURIComponent(user.username), { 
            maxAge: 3600000 * 24 * 7, // 7 дней
            httpOnly: true, 
            sameSite: 'Lax',
            secure: process.env.NODE_ENV === 'production' // Рекомендовано для Render (HTTPS)
        });
        res.json({ success: true, user: { id: user.id, username: user.username } });
    } else {
        res.status(401).json({ success: false, error: 'Неверное имя пользователя или пароль' });
    }
});

// GET /me - Проверка авторизации и получение данных
app.get('/me', async (req, res) => {
    const username = req.cookies.user;
    if (username) {
        const users = await readJSONFile(USERS_FILE);
        const decodedUsername = decodeURIComponent(username);
        const user = users.find(u => u.username === decodedUsername);
        if (user) {
            return res.json({ id: user.id, username: user.username });
        }
    }
    res.status(401).json({ error: 'Не авторизован' });
});


// --- Запуск сервера ---

const PORT = process.env.PORT || 3000; 

server.listen(PORT, '0.0.0.0', () => { 
  console.log(`Сервер запущен на порту ${PORT}`);
});
