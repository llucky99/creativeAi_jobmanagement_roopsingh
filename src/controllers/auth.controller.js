const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const { ROLES } = require('../constants');
const UserModel = require('../models/user.model');

const signToken = (user) =>
  jwt.sign({ id: user.id, role: user.role }, env.jwt.secret, { expiresIn: env.jwt.expiresIn });

const register = asyncHandler(async (req, res) => {
  const { name, email, password, phone, role, adminKey } = req.body;

  if (role === ROLES.ADMIN) {
    if (!env.adminRegistrationKey) {
      throw ApiError.forbidden('Admin self-registration is disabled. Use the seed script.');
    }
    if (adminKey !== env.adminRegistrationKey) throw ApiError.forbidden('Invalid adminKey for Admin registration');
  }

  if (await UserModel.findByEmail(email)) throw ApiError.conflict('Email is already registered');

  const passwordHash = await bcrypt.hash(password, 10);
  const id = await UserModel.create({ name, email, passwordHash, phone, role });
  const user = await UserModel.findById(id);

  created(res, 'User registered successfully', { user: UserModel.toPublic(user), token: signToken(user) });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await UserModel.findByEmail(email);
  // Same message for unknown email / wrong password to avoid user enumeration
  const valid = user && (await bcrypt.compare(password, user.password_hash));
  if (!valid) throw ApiError.unauthorized('Invalid email or password');
  if (!user.is_active) throw ApiError.forbidden('Your account is deactivated');

  ok(res, 'Login successful', { user: UserModel.toPublic(user), token: signToken(user) });
});

const me = asyncHandler(async (req, res) => {
  const user = await UserModel.findById(req.user.id);
  ok(res, 'Profile fetched successfully', UserModel.toPublic(user));
});

module.exports = { register, login, me };
