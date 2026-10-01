const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');

const ALLOWED = { 'image/jpeg': ['.jpg', '.jpeg'], 'image/png': ['.png'], 'image/webp': ['.webp'], 'image/gif': ['.gif'] };

const jobsDir = path.resolve(env.upload.dir, 'jobs');
fs.mkdirSync(jobsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, jobsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomUUID()}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExts = ALLOWED[file.mimetype];
  if (!allowedExts || !allowedExts.includes(ext)) {
    return cb(ApiError.badRequest(`Invalid file type for "${file.originalname}". Allowed: JPG, PNG, WEBP, GIF`));
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: env.upload.maxFileSizeMb * 1024 * 1024,
    files: env.upload.maxImagesPerJob,
  },
});

module.exports = { uploadJobImages: upload.array('images', env.upload.maxImagesPerJob), jobsDir };
