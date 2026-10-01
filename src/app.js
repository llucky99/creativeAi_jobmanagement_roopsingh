const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const env = require('./config/env');
const routes = require('./routes');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } })); // allow <img> from other origins
app.use(cors());
if (env.nodeEnv !== 'test') app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '1mb' }));

app.use('/uploads', express.static(path.resolve(env.upload.dir), { fallthrough: false, index: false }));

app.get('/health', (req, res) => res.json({ success: true, message: 'OK', data: { uptime: process.uptime() } }));
app.use('/', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
