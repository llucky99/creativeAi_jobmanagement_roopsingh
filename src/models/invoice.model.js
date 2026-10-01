const { query } = require('../config/db');

const SELECT = `
  SELECT i.*, j.title AS job_title, j.customer_name, j.customer_contact, j.address AS job_address,
         u.name AS generated_by_name
  FROM invoices i
  JOIN jobs j ON j.id = i.job_id
  JOIN users u ON u.id = i.generated_by`;

const mapInvoice = (r, parts) => r && ({
  id: r.id,
  invoiceNumber: r.invoice_number,
  jobId: r.job_id,
  job: { title: r.job_title, customerName: r.customer_name, customerContact: r.customer_contact, address: r.job_address },
  charges: {
    partsTotal: r.parts_total,
    serviceCost: r.service_cost,
    cleaningCost: r.cleaning_cost,
    subtotal: r.subtotal,
    gstPercent: r.gst_percent,
    gstAmount: r.gst_amount,
    finalTotal: r.final_total,
  },
  breakdown: [
    { charge: 'Parts Total', amount: r.parts_total },
    { charge: 'Service Cost', amount: r.service_cost },
    { charge: 'Cleaning Cost', amount: r.cleaning_cost },
    { charge: 'Subtotal', amount: r.subtotal },
    { charge: `GST (${r.gst_percent}%)`, amount: r.gst_amount },
    { charge: 'Final Total', amount: r.final_total },
  ],
  ...(parts ? { parts } : {}),
  finalPayableAmount: r.final_total,
  generatedBy: { id: r.generated_by, name: r.generated_by_name },
  createdAt: r.created_at,
});

const create = async (d, conn) => {
  const res = await query(
    `INSERT INTO invoices (invoice_number, job_id, parts_total, service_cost, cleaning_cost,
       subtotal, gst_percent, gst_amount, final_total, generated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [`TMP-${Date.now()}-${d.jobId}`, d.jobId, d.partsTotal, d.serviceCost, d.cleaningCost,
      d.subtotal, d.gstPercent, d.gstAmount, d.finalTotal, d.generatedBy], conn
  );
  const number = `INV-${new Date().getUTCFullYear()}-${String(res.insertId).padStart(6, '0')}`;
  await query('UPDATE invoices SET invoice_number = ? WHERE id = ?', [number, res.insertId], conn);
  return res.insertId;
};

const findById = async (id, conn) => (await query(`${SELECT} WHERE i.id = ?`, [id], conn))[0] || null;
const findByJobId = async (jobId, conn) => (await query(`${SELECT} WHERE i.job_id = ?`, [jobId], conn))[0] || null;

const findAll = async ({ page, limit }) => {
  const [{ total }] = await query('SELECT COUNT(*) AS total FROM invoices');
  const rows = await query(`${SELECT} ORDER BY i.created_at DESC, i.id DESC LIMIT ? OFFSET ?`, [limit, (page - 1) * limit]);
  return { rows, total };
};

module.exports = { mapInvoice, create, findById, findByJobId, findAll };
