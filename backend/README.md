Kickmap Backend Starter Kit

Stack
- Node.js
- Express
- Socket.IO
- MySQL

1) Instalar dependencias
- Abrir terminal en backend
- Ejecutar: npm install

2) Configurar variables de entorno
- Copiar .env.example a .env
- Ajustar credenciales de MySQL

3) Crear base de datos
- Abrir MySQL Workbench
- Ejecutar el script de sql/schema.sql

4) Ejecutar servidor
- Desarrollo: npm run dev
- Produccion: npm start

API base
- GET /api/health
- POST /api/auth/register
- POST /api/auth/login
- GET /api/users
- POST /api/chats/private
- POST /api/chats/group
- GET /api/chats/:id/messages
- POST /api/tasks
- PATCH /api/tasks/:id/complete
- GET /api/rewards/ranking
- GET /api/rewards
- POST /api/rewards/redeem/:rewardId

Socket.IO (eventos base)
- join_chat
- send_message
- receive_message
- user_status_change

Notas importantes
- Para conectar Socket.IO en frontend: enviar userId en query al conectar.
- El backend guarda mensajes en DB y emite en tiempo real.
- El script SQL usa LONGBLOB para fotos/videos en users, messages y rewards.
