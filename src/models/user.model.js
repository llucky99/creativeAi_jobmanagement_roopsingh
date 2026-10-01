const { query } = require('../config/db');

const toPublic = (u) => u && ({
  id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role,
  isActive: !!u.is_active, createdAt: u.created_at, updatedAt: u.updated_at,
});

const create = async ({ name, email, passwordHash, phone, role }, conn) => {
  const res = await query(
    'INSERT INTO users (name, email, password_hash, phone, role) VALUES (?, ?, ?, ?, ?)',
    [name, email, passwordHash, phone || null, role], conn
  );
  return res.insertId;
};

const findById = async (id, conn) => (await query('SELECT * FROM users WHERE id = ?', [id], conn))[0] || null;
const findByEmail = async (email) => (await query('SELECT * FROM users WHERE email = ?', [email]))[0] || null;
const findWorkers = async () =>
  query("SELECT * FROM users WHERE role = 'Worker' AND is_active = 1 ORDER BY name ASC");

module.exports = { create, findById, findByEmail, findWorkers, toPublic };
