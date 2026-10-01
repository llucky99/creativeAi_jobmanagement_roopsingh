const Joi = require('joi');
const { PRIORITIES, JOB_STATUS } = require('../constants');

const phone = Joi.string().trim().pattern(/^[0-9+\-\s]{7,20}$/)
  .messages({ 'string.pattern.base': 'customerContact must be 7-20 characters (digits, +, -, spaces)' });
const id = Joi.number().integer().positive();

const create = Joi.object({
  title: Joi.string().trim().min(3).max(150).required(),
  description: Joi.string().trim().max(5000).allow('', null),
  customerName: Joi.string().trim().min(2).max(100).required(),
  customerContact: phone.required(),
  address: Joi.string().trim().min(5).max(500).required(),
  priority: Joi.string().valid(...PRIORITIES).default('Medium'),
  assignedWorkerId: id.allow(null),
});

const update = Joi.object({
  title: Joi.string().trim().min(3).max(150),
  description: Joi.string().trim().max(5000).allow('', null),
  customerName: Joi.string().trim().min(2).max(100),
  customerContact: phone,
  address: Joi.string().trim().min(5).max(500),
  priority: Joi.string().valid(...PRIORITIES),
}).min(1).messages({ 'object.min': 'At least one updatable field is required' });

const assign = Joi.object({ workerId: id.required() });

const updateStatus = Joi.object({
  status: Joi.string().valid(...Object.values(JOB_STATUS)).required(),
});

const listQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  status: Joi.string().valid(...Object.values(JOB_STATUS)),
  priority: Joi.string().valid(...PRIORITIES),
  search: Joi.string().trim().max(100).allow(''),
  sortBy: Joi.string().valid('createdAt').default('createdAt'),
  sortOrder: Joi.string().lowercase().valid('asc', 'desc').default('desc'),
});

const completedQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  search: Joi.string().trim().max(100).allow(''),
  priority: Joi.string().valid(...PRIORITIES),
  invoiced: Joi.boolean(),
  sortBy: Joi.string().valid('createdAt').default('createdAt'),
  sortOrder: Joi.string().lowercase().valid('asc', 'desc').default('desc'),
});

module.exports = { create, update, assign, updateStatus, listQuery, completedQuery };
