import express from 'express';
import cookieParser from 'cookie-parser';
import http from 'http';
import { WebSocketServer } from 'ws'; // 👈 ИМПОРТ ДЛЯ ИСПРАВЛЕНИЯ ОШИБКИ
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

// --- Константы и утилиты ---

const app = express();
app.use(express.json());
app.use(cookieParser());

// Убедитесь, что папка public существует и содержит файлы:
app.use(express.static('public'));

const USERS_FILE = 'users.json'; // Путь к файлу с пользователями

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

const server = http.createServer(app); // 👈 СОЗДАЕМ HTTP-СЕРВЕР

// === WebSocket-сервер (ИСПРАВЛЕНИЕ ОШИБКИ) ===
const wss = new WebSocketServer({ server }); // 👈 ИНИЦИАЛИЗИРУЕМ WSS, ПРИВЯЗЫВАЯ К HTTP-СЕРВЕРУ

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

    // Здесь будет логика обработки сообщений и присоединения к чату
    // ws.on('message', (message) => { ... });
    // ws.on('close', () => { ... });
});

// --- Express-маршруты ---

// GET /login - Показывает страницу входа/регистрации
app.get('/login', (req, res) => {
    res.sendFile(path.resolve('public', 'login.html'));
});

// GET / - Главная страница
app.get('/', (req, res) => {
    // Проверяем, авторизован ли пользователь (есть ли куки 'user')
    const username = req.cookies.user;
    if (!username) {
        return res.redirect('/login');
    }
    // Если авторизован, отдаем основной файл мессенджера
    res.sendFile(path.resolve('public', 'index.html'));
});

// POST /register - Регистрация нового пользователя
app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    const users = await readJSONFile(USERS_FILE);

    if (!username || !password) {
        return res.status(400).json({ success: false, error: 'Заполните все поля' });
    }

    if (users.find(u => u.username === username)) {
        return res.status(409).json({ success: false, error: 'Пользователь с таким именем уже существует' });
    }
    
    // ⚠️ В реальном приложении здесь нужно хешировать пароль!
    const newUser = {
        id: uuidv4(), 
        username, 
        password // Для простоты, сохраняем как есть
    };

    users.push(newUser);
    await writeJSONFile(USERS_FILE, users);

    res.json({ success: true, message: 'Регистрация успешна' });
});

// POST /login - Вход пользователя
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const users = await readJSONFile(USERS_FILE);

    const user = users.find(u => u.username === username && u.password === password);
    
    if (user) {
        // Устанавливаем куки с именем пользователя
        res.cookie('user', encodeURIComponent(user.username), { 
            maxAge: 900000, 
            httpOnly: true, 
            sameSite: 'Lax' 
        });
        res.json({ success: true, user: { id: user.id, username: user.username } });
    } else {
        res.status(401).json({ success: false, error: 'Неверное имя пользователя или пароль' });
    }
});

// GET /me - Маршрут для Keep-Alive и получения данных пользователя
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

server.listen(PORT, '0.0.0.0', () => { // Используем server.listen
  console.log(`Сервер запущен на порту ${PORT}`);
});
