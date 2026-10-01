const { query } = require('../config/db');

const mapImage = (r, baseUrl) => r && ({
  id: r.id, jobId: r.job_id, fileName: r.file_name, originalName: r.original_name,
  mimeType: r.mime_type, fileSize: r.file_size,
  url: `${baseUrl}/uploads/${r.file_path.replace(/\\/g, '/')}`,
  uploadedBy: r.uploaded_by, createdAt: r.created_at,
});

const create = async ({ jobId, fileName, originalName, mimeType, fileSize, filePath, uploadedBy }, conn) => {
  const res = await query(
    `INSERT INTO job_images (job_id, file_name, original_name, mime_type, file_size, file_path, uploaded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [jobId, fileName, originalName, mimeType, fileSize, filePath, uploadedBy], conn
  );
  return res.insertId;
};

const listByJob = (jobId, conn) => query('SELECT * FROM job_images WHERE job_id = ? ORDER BY id ASC', [jobId], conn);
const countByJob = async (jobId, conn) =>
  (await query('SELECT COUNT(*) AS c FROM job_images WHERE job_id = ?', [jobId], conn))[0].c;
const findById = async (jobId, imageId) =>
  (await query('SELECT * FROM job_images WHERE id = ? AND job_id = ?', [imageId, jobId]))[0] || null;
const remove = (imageId) => query('DELETE FROM job_images WHERE id = ?', [imageId]);

module.exports = { mapImage, create, listByJob, countByJob, findById, remove };
