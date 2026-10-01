const fs = require('fs');
const path = require('path');
const env = require('../config/env');

const getBaseUrl = (req) => env.baseUrl || `${req.protocol}://${req.get('host')}`;

const removeFiles = async (paths = []) => {
  await Promise.all(
    paths.map((p) => fs.promises.unlink(path.resolve(p)).catch(() => {}))
  );
};

/** Verify real image content by magic bytes (don't trust client mimetype only). */
const hasValidImageSignature = async (filePath) => {
  const fh = await fs.promises.open(filePath, 'r');
  try {
    const buf = Buffer.alloc(12);
    await fh.read(buf, 0, 12, 0);
    const isJpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    const isPng = buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const isGif = buf.slice(0, 4).toString('ascii') === 'GIF8';
    const isWebp = buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP';
    return isJpeg || isPng || isGif || isWebp;
  } finally {
    await fh.close();
  }
};

const escapeLike = (s) => s.replace(/[\\%_]/g, '\\$&');

module.exports = { getBaseUrl, removeFiles, hasValidImageSignature, escapeLike };

const buildPagination = (page, limit, total) => ({
  page, limit, total,
  totalPages: Math.ceil(total / limit) || 0,
  hasNextPage: page * limit < total,
  hasPrevPage: page > 1,
});
module.exports.buildPagination = buildPagination;

module.exports.resolveUploadPath = (relative) => path.resolve(env.upload.dir, relative);
