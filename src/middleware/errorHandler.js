const multer = require('multer');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');

// eslint-disable-next-line no-unused-vars
module.exports = (err, req, res, next) => {
  let error = err;

  if (err instanceof multer.MulterError) {
    const map = {
      LIMIT_FILE_SIZE: `Each image must be at most ${env.upload.maxFileSizeMb} MB`,
      LIMIT_FILE_COUNT: `Maximum ${env.upload.maxImagesPerJob} images allowed per request`,
      LIMIT_UNEXPECTED_FILE: `Maximum ${env.upload.maxImagesPerJob} images allowed, and the form field name must be "images"`,
    };
    error = ApiError.badRequest(map[err.code] || err.message);
  } else if (err.type === 'entity.parse.failed') {
    error = ApiError.badRequest('Malformed JSON in request body');
  } else if (err.code === 'ER_DUP_ENTRY') {
    error = ApiError.conflict('Duplicate entry: resource already exists');
  } else if (err.code === 'ER_ROW_IS_REFERENCED_2') {
    error = ApiError.conflict('Resource is referenced by other records and cannot be deleted');
  } else if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    error = ApiError.badRequest('Referenced resource does not exist');
  }

  const status = error.statusCode || 500;
  if (status >= 500) console.error(err);

  res.status(status).json({
    success: false,
    message: status >= 500 && env.nodeEnv === 'production' ? 'Internal server error' : error.message,
    ...(error.errors ? { errors: error.errors } : {}),
    ...(status >= 500 && env.nodeEnv !== 'production' ? { stack: err.stack } : {}),
  });
};
