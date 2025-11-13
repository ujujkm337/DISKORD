// server.js (Обновленная часть кода)

// ... (Остальной код без изменений)

// === WebSocket-сервер ===
wss.on("connection", async (ws, req) => {
  const cookieHeader = req.headers.cookie || "";
  const match = cookieHeader.match(/user=([^;]+)/);
  
  // ✅ Проверяем декодирование. decodeURIComponent должен сработать, 
  // так как вы его уже использовали при установке куки.
  const username = match ? decodeURIComponent(match[1]) : null; 

  if (!username) {
    ws.close();
    return;
  }
  // ... (Остальной код ws.on('connection') без изменений)
});

// ... (В самом конце файла)

// ✅ Фикс порта для Render
const PORT = process.env.PORT || 3000; 

server.listen(PORT, '0.0.0.0', () => { // Добавлено '0.0.0.0'
  console.log(`Сервер запущен на порту ${PORT}`);
});
