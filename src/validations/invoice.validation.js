const Joi = require('joi');

const create = Joi.object({
  jobId: Joi.number().integer().positive().required(),
  serviceCost: Joi.number().min(0).max(99999999.99).precision(2).required(),
  cleaningCost: Joi.number().min(0).max(99999999.99).precision(2).required(),
});

const listQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
});

module.exports = { create, listQuery };
