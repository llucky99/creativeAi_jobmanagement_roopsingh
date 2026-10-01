const { query } = require('../config/db');
const { escapeLike } = require('../utils/helpers');

const SELECT = `
  SELECT j.*, w.name AS worker_name, w.email AS worker_email, c.name AS creator_name,
    (SELECT COALESCE(SUM(p.total_price), 0) FROM job_parts p WHERE p.job_id = j.id) AS parts_total,
    (SELECT i.id FROM invoices i WHERE i.job_id = j.id LIMIT 1) AS invoice_id
  FROM jobs j
  LEFT JOIN users w ON w.id = j.assigned_worker_id
  LEFT JOIN users c ON c.id = j.created_by`;

const mapJob = (r) => r && ({
  id: r.id,
  title: r.title,
  description: r.description,
  customerName: r.customer_name,
  customerContact: r.customer_contact,
  address: r.address,
  priority: r.priority,
  status: r.status,
  assignedWorker: r.assigned_worker_id
    ? { id: r.assigned_worker_id, name: r.worker_name, email: r.worker_email }
    : null,
  createdBy: { id: r.created_by, name: r.creator_name },
  partsTotal: Number(r.parts_total || 0),
  hasInvoice: !!r.invoice_id,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const COLUMN_MAP = {
  title: 'title', description: 'description', customerName: 'customer_name',
  customerContact: 'customer_contact', address: 'address', priority: 'priority',
};

const create = async (d, conn) => {
  const res = await query(
    `INSERT INTO jobs (title, description, customer_name, customer_contact, address,
       assigned_worker_id, priority, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [d.title, d.description || null, d.customerName, d.customerContact, d.address,
      d.assignedWorkerId || null, d.priority, d.status, d.createdBy], conn
  );
  return res.insertId;
};

const findById = async (id, conn) => (await query(`${SELECT} WHERE j.id = ?`, [id], conn))[0] || null;
const findRaw = async (id, conn) => (await query('SELECT * FROM jobs WHERE id = ?', [id], conn))[0] || null;
const findRawForUpdate = async (id, conn) =>
  (await query('SELECT * FROM jobs WHERE id = ? FOR UPDATE', [id], conn))[0] || null;

const findAll = async ({ workerId, status, priority, search, sortOrder = 'desc', page, limit, invoiced }) => {
  const where = [];
  const params = [];
  if (workerId) { where.push('j.assigned_worker_id = ?'); params.push(workerId); }
  if (status) { where.push('j.status = ?'); params.push(status); }
  if (priority) { where.push('j.priority = ?'); params.push(priority); }
  if (search) {
    where.push('(j.title LIKE ? OR j.customer_name LIKE ?)');
    const like = `%${escapeLike(search)}%`;
    params.push(like, like);
  }
  if (invoiced === true) where.push('EXISTS (SELECT 1 FROM invoices i WHERE i.job_id = j.id)');
  if (invoiced === false) where.push('NOT EXISTS (SELECT 1 FROM invoices i WHERE i.job_id = j.id)');
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const dir = sortOrder === 'asc' ? 'ASC' : 'DESC';

  const [{ total }] = await query(`SELECT COUNT(*) AS total FROM jobs j ${whereSql}`, params);
  const rows = await query(
    `${SELECT} ${whereSql} ORDER BY j.created_at ${dir}, j.id ${dir} LIMIT ? OFFSET ?`,
    [...params, limit, (page - 1) * limit]
  );
  return { rows, total };
};

const update = async (id, fields, conn) => {
  const sets = [];
  const params = [];
  for (const [key, col] of Object.entries(COLUMN_MAP)) {
    if (fields[key] !== undefined) { sets.push(`${col} = ?`); params.push(fields[key] === '' ? null : fields[key]); }
  }
  if (!sets.length) return;
  await query(`UPDATE jobs SET ${sets.join(', ')} WHERE id = ?`, [...params, id], conn);
};

const assign = (id, workerId, status, conn) =>
  query('UPDATE jobs SET assigned_worker_id = ?, status = ? WHERE id = ?', [workerId, status, id], conn);

const updateStatus = (id, status, conn) => query('UPDATE jobs SET status = ? WHERE id = ?', [status, id], conn);
const remove = (id, conn) => query('DELETE FROM jobs WHERE id = ?', [id], conn);

module.exports = { mapJob, create, findById, findRaw, findRawForUpdate, findAll, update, assign, updateStatus, remove };
