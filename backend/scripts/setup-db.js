require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'kickmap_db',
};

async function setupDatabase() {
  let connection;
  try {
    console.log('🔄 Conectando a MySQL...');
    // Conexión sin especificar BD para crear la BD si no existe
    connection = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
      multipleStatements: true, 
    });

    console.log('Conectado a MySQL');

    const sqlPath = path.join(__dirname, '../sql/init.sql');
    if (!fs.existsSync(sqlPath)) {
      throw new Error(
        `Archivo SQL no encontrado: ${sqlPath}\n` +
        'Asegúrate de que backend/sql/init.sql exista'
      );
    }

    const sqlScript = fs.readFileSync(sqlPath, 'utf8');
    console.log('Ejecutando script SQL');

    await connection.query(sqlScript);

    console.log(' Base de datos creada exitosamente');
    console.log('\n Ahora ejecuta: npm run dev');

    await connection.end();
  } catch (error) {
    console.error('Error durante setup:', error.message);
    if (error.code === 'ER_ACCESS_DENIED_CHANGE_USER') {
      console.error(
        '  Verifica que MySQL está corriendo\n' +
        '  Revisa las credenciales en .env (DB_USER, DB_PASSWORD)\n' +
        dbConfig.user +
        ' -p'
      );
    }
    process.exit(1);
  }
}

setupDatabase();
