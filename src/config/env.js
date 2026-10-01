require('dotenv').config();

const num = (v, d) => (v !== undefined && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : d);

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: num(process.env.PORT, 3000),
  baseUrl: (process.env.BASE_URL || '').replace(/\/$/, ''),
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: num(process.env.DB_PORT, 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'service_job_management',
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  },
  adminRegistrationKey: process.env.ADMIN_REGISTRATION_KEY || '',
  upload: {
    dir: process.env.UPLOAD_DIR || 'uploads',
    maxFileSizeMb: num(process.env.MAX_FILE_SIZE_MB, 5),
    maxImagesPerJob: 5,
  },
  gstPercent: num(process.env.GST_PERCENT, 10),
};

if (!env.jwt.secret) {
  throw new Error('JWT_SECRET is not set');
}

module.exports = env;
