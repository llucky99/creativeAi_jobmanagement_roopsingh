// Usage: npm run db:init  -> creates the database (DB_NAME) and all tables from database/schema.sql
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

(async () => {
  const dbName = process.env.DB_NAME || 'service_job_management';
  if (!/^[A-Za-z0-9_]+$/.test(dbName)) throw new Error('DB_NAME may only contain letters, numbers and underscores');

  let sql = fs.readFileSync(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf8');
  sql = sql.replace(/CREATE DATABASE[\s\S]*?;/i, '').replace(/^USE\s+\w+;/im, '');

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await conn.query(`USE \`${dbName}\``);
  await conn.query(sql);
  await conn.end();
  console.log(`Database "${dbName}" is ready.`);
})().catch((e) => { console.error('DB init failed:', e.message); process.exit(1); });
