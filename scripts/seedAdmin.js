// Usage: npm run seed:admin  -> creates (or promotes) an Admin from ADMIN_* env vars
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../src/config/db');

(async () => {
  const name = process.env.ADMIN_NAME || 'Super Admin';
  const email = (process.env.ADMIN_EMAIL || 'admin@example.com').toLowerCase();
  const password = process.env.ADMIN_PASSWORD || 'Admin@12345';
  const hash = await bcrypt.hash(password, 10);

  await pool.query(
    `INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'Admin')
     ON DUPLICATE KEY UPDATE name = VALUES(name), password_hash = VALUES(password_hash), role = 'Admin', is_active = 1`,
    [name, email, hash]
  );
  console.log(`Admin ready -> email: ${email}`);
  await pool.end();
})().catch((e) => { console.error('Seed failed:', e.message); process.exit(1); });
