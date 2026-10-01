const { query } = require('../config/db');
const { toCents, fromCents } = require('../utils/money');

const mapPart = (r) => r && ({
  id: r.id, jobId: r.job_id, partName: r.part_name,
  unitPrice: r.unit_price, quantity: r.quantity, totalPrice: r.total_price,
  addedBy: r.added_by, createdAt: r.created_at, updatedAt: r.updated_at,
});

const computeTotal = (unitPrice, quantity) => fromCents(toCents(unitPrice) * quantity);

const create = async ({ jobId, partName, unitPrice, quantity, addedBy }) => {
  const res = await query(
    `INSERT INTO job_parts (job_id, part_name, unit_price, quantity, total_price, added_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [jobId, partName, unitPrice, quantity, computeTotal(unitPrice, quantity), addedBy]
  );
  return res.insertId;
};

const findById = async (jobId, partId) =>
  (await query('SELECT * FROM job_parts WHERE id = ? AND job_id = ?', [partId, jobId]))[0] || null;

const update = async (partId, { partName, unitPrice, quantity }) =>
  query(
    'UPDATE job_parts SET part_name = ?, unit_price = ?, quantity = ?, total_price = ? WHERE id = ?',
    [partName, unitPrice, quantity, computeTotal(unitPrice, quantity), partId]
  );

const remove = (partId) => query('DELETE FROM job_parts WHERE id = ?', [partId]);
const listByJob = (jobId, conn) => query('SELECT * FROM job_parts WHERE job_id = ? ORDER BY id ASC', [jobId], conn);

const sumByJob = async (jobId, conn) => {
  const [row] = await query('SELECT COALESCE(SUM(total_price), 0) AS total FROM job_parts WHERE job_id = ?', [jobId], conn);
  return Number(row.total);
};

module.exports = { mapPart, create, findById, update, remove, listByJob, sumByJob };
