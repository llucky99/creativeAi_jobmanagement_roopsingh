const Joi = require('joi');
const { ROLES } = require('../constants');

const register = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  email: Joi.string().trim().lowercase().email().max(150).required(),
  password: Joi.string()
    .min(8).max(72)
    .pattern(/^(?=.*[A-Za-z])(?=.*\d).+$/)
    .required()
    .messages({ 'string.pattern.base': 'password must contain at least one letter and one number' }),
  phone: Joi.string().trim().pattern(/^[0-9+\-\s]{7,20}$/).allow('', null)
    .messages({ 'string.pattern.base': 'phone must be 7-20 characters (digits, +, -, spaces)' }),
  role: Joi.string().valid(ROLES.ADMIN, ROLES.WORKER).default(ROLES.WORKER),
  adminKey: Joi.string().allow('', null),
});

const login = Joi.object({
  email: Joi.string().trim().lowercase().email().required(),
  password: Joi.string().required(),
});

module.exports = { register, login };
