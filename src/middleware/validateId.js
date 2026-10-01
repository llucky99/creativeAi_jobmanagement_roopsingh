const ApiError = require('../utils/ApiError');

/** Ensures the given route params are positive integers. */
module.exports = (...names) => (req, res, next) => {
  for (const name of names) {
    const raw = req.params[name];
    if (!/^\d+$/.test(raw) || Number(raw) < 1 || !Number.isSafeInteger(Number(raw))) {
      return next(ApiError.badRequest(`Invalid ${name}: must be a positive integer`));
    }
    req.params[name] = Number(raw);
  }
  next();
};
