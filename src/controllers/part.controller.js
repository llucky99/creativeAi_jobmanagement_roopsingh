const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const { ROLES, JOB_STATUS } = require('../constants');
const JobModel = require('../models/job.model');
const PartModel = require('../models/part.model');

/** Admin or the assigned worker may read a job's sub-resources. Sets req.job. */
const ensureJobAccess = asyncHandler(async (req, res, next) => {
  const job = await JobModel.findRaw(req.params.jobId);
  if (!job) throw ApiError.notFound('Job not found');
  if (req.user.role === ROLES.WORKER && job.assigned_worker_id !== req.user.id) {
    throw ApiError.forbidden('This job is not assigned to you');
  }
  req.job = job;
  next();
});

/** Only the assigned worker may modify parts, and only while the job is open. Sets req.job. */
const ensureWorkerOwnsOpenJob = asyncHandler(async (req, res, next) => {
  const job = await JobModel.findRaw(req.params.jobId);
  if (!job) throw ApiError.notFound('Job not found');
  if (job.assigned_worker_id !== req.user.id) {
    throw ApiError.forbidden('You can only manage parts for jobs assigned to you');
  }
  if (![JOB_STATUS.ASSIGNED, JOB_STATUS.IN_PROGRESS].includes(job.status)) {
    throw ApiError.badRequest(`Parts cannot be modified while the job is ${job.status}`);
  }
  req.job = job;
  next();
});

const withTotals = async (jobId, extra = {}) => ({
  ...extra,
  partsTotal: await PartModel.sumByJob(jobId),
});

const listParts = asyncHandler(async (req, res) => {
  const parts = await PartModel.listByJob(req.job.id);
  ok(res, 'Parts fetched successfully', await withTotals(req.job.id, { parts: parts.map(PartModel.mapPart) }));
});

const addPart = asyncHandler(async (req, res) => {
  const id = await PartModel.create({ jobId: req.job.id, ...req.body, addedBy: req.user.id });
  const part = PartModel.mapPart(await PartModel.findById(req.job.id, id));
  created(res, 'Part added successfully', await withTotals(req.job.id, { part }));
});

const updatePart = asyncHandler(async (req, res) => {
  const existing = await PartModel.findById(req.job.id, req.params.partId);
  if (!existing) throw ApiError.notFound('Part not found for this job');
  await PartModel.update(existing.id, {
    partName: req.body.partName ?? existing.part_name,
    unitPrice: req.body.unitPrice ?? existing.unit_price,
    quantity: req.body.quantity ?? existing.quantity,
  });
  const part = PartModel.mapPart(await PartModel.findById(req.job.id, existing.id));
  ok(res, 'Part updated successfully', await withTotals(req.job.id, { part }));
});

const deletePart = asyncHandler(async (req, res) => {
  const existing = await PartModel.findById(req.job.id, req.params.partId);
  if (!existing) throw ApiError.notFound('Part not found for this job');
  await PartModel.remove(existing.id);
  ok(res, 'Part removed successfully', await withTotals(req.job.id));
});

module.exports = { ensureJobAccess, ensureWorkerOwnsOpenJob, listParts, addPart, updatePart, deletePart };
