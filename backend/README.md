Kickmap Backend - Guía Completa de Setup

# Requisitos

- **Node.js** (versión 14 o superior)
- **npm** (viene con Node.js)
- **MySQL** (5.7+)

# Instalar dependencias

```bash
cd backend
npm install
```

# Configurar variables de entorno

Copia el archivo `.env.example` a `.env` y ajusta las credenciales:

```bash
# Abre .env.example, cópialo, crea .env y pega el contenido
```
Edita `.env` con tus datos de MySQL


```bash
# Asegúrate de que MySQL está corriendo, luego para crear la base de datos ejecuta:
npm run setup-db
```

Ese comando reinicia la BD desde el script `backend/sql/init.sql`, dejando vacías las tablas de usuarios, chats, mensajes y tareas, y conservando solo los datos semilla de `achievements` y `rewards`.

Los archivos adjuntos ya no se guardan como `BLOB` en MySQL: ahora se escriben en `Images/uploads/` y en la base de datos se guarda solo su `file_url`.

# Para desarrollo 

```bash
npm run dev
```

# Abrir la página

Abre en el navegador:
```
http://localhost:4000
```

