const Joi = require('joi');

const create = Joi.object({
  partName: Joi.string().trim().min(2).max(150).required(),
  unitPrice: Joi.number().min(0).max(99999999.99).precision(2).required(),
  quantity: Joi.number().integer().min(1).max(100000).required(),
});

const update = Joi.object({
  partName: Joi.string().trim().min(2).max(150),
  unitPrice: Joi.number().min(0).max(99999999.99).precision(2),
  quantity: Joi.number().integer().min(1).max(100000),
}).min(1).messages({ 'object.min': 'At least one field (partName, unitPrice, quantity) is required' });

module.exports = { create, update };
