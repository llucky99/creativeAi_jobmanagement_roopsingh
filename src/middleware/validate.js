const ApiError = require('../utils/ApiError');

/** validate(schema, 'body' | 'query' | 'params') */
module.exports = (schema, source = 'body') => (req, res, next) => {
  const { error, value } = schema.validate(req[source], {
    abortEarly: false,
    stripUnknown: true,
    convert: true,
  });
  if (error) {
    const errors = error.details.map((d) => ({
      field: d.path.join('.'),
      message: d.message.replace(/"/g, ''),
    }));
    return next(ApiError.badRequest('Validation failed', errors));
  }
  req[source] = value;
  next();
};
