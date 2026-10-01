const env = require('./config/env');
const { pool } = require('./config/db');
const app = require('./app');

const start = async () => {
  try {
    await pool.query('SELECT 1');
    console.log('MySQL connected');
  } catch (err) {
    console.error('Failed to connect to MySQL:', err.message);
    process.exit(1);
  }

  const server = app.listen(env.port, () => console.log(`API running on port ${env.port} (${env.nodeEnv})`));

  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down...`);
    server.close(async () => { await pool.end(); process.exit(0); });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (r) => console.error('Unhandled rejection:', r));
};

start();
