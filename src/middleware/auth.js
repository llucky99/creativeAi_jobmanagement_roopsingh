const jwt = require('jsonwebtoken');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const UserModel = require('../models/user.model');

const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw ApiError.unauthorized('Authentication required. Provide a Bearer token.');
  }
  let payload;
  try {
    payload = jwt.verify(token, env.jwt.secret);
  } catch (err) {
    throw ApiError.unauthorized(err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token');
  }
  const user = await UserModel.findById(payload.id);
  if (!user || !user.is_active) throw ApiError.unauthorized('User no longer exists or is inactive');
  req.user = { id: user.id, name: user.name, email: user.email, role: user.role };
  next();
});

const authorize = (...roles) => (req, res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (!roles.includes(req.user.role)) {
    return next(ApiError.forbidden(`Access denied. Required role: ${roles.join(' or ')}`));
  }
  next();
};

module.exports = { authenticate, authorize };
