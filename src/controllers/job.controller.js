const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const { withTransaction } = require('../config/db');
const { ROLES, JOB_STATUS, STATUS_TRANSITIONS, canTransition } = require('../constants');
const { getBaseUrl, removeFiles, buildPagination, resolveUploadPath } = require('../utils/helpers');
const UserModel = require('../models/user.model');
const JobModel = require('../models/job.model');
const PartModel = require('../models/part.model');
const ImageModel = require('../models/image.model');
const InvoiceModel = require('../models/invoice.model');

const ensureWorker = async (workerId, conn) => {
  const w = await UserModel.findById(workerId, conn);
  if (!w) throw ApiError.notFound('Worker not found');
  if (w.role !== ROLES.WORKER) throw ApiError.badRequest('Selected user is not a Worker');
  if (!w.is_active) throw ApiError.badRequest('Selected worker account is inactive');
  return w;
};

const createJob = asyncHandler(async (req, res) => {
  const { assignedWorkerId, ...rest } = req.body;
  if (assignedWorkerId) await ensureWorker(assignedWorkerId);

  const id = await JobModel.create({
    ...rest,
    assignedWorkerId: assignedWorkerId || null,
    status: assignedWorkerId ? JOB_STATUS.ASSIGNED : JOB_STATUS.PENDING,
    createdBy: req.user.id,
  });
  created(res, 'Job created successfully', JobModel.mapJob(await JobModel.findById(id)));
});

const listJobs = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const workerId = req.user.role === ROLES.WORKER ? req.user.id : undefined; // workers only see their jobs
  const { rows, total } = await JobModel.findAll({ ...req.query, workerId });
  ok(res, 'Jobs fetched successfully', rows.map(JobModel.mapJob), { pagination: buildPagination(page, limit, total) });
});

const listCompletedJobs = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const { rows, total } = await JobModel.findAll({ ...req.query, status: JOB_STATUS.COMPLETED });
  ok(res, 'Completed jobs fetched successfully', rows.map(JobModel.mapJob), {
    pagination: buildPagination(page, limit, total),
  });
});

const getJob = asyncHandler(async (req, res) => {
  const { jobId } = req.params;
  const row = await JobModel.findById(jobId);
  if (!row) throw ApiError.notFound('Job not found');
  if (req.user.role === ROLES.WORKER && row.assigned_worker_id !== req.user.id) {
    throw ApiError.forbidden('You can only view jobs assigned to you');
  }

  const [parts, images, invoiceRow] = await Promise.all([
    PartModel.listByJob(jobId),
    ImageModel.listByJob(jobId),
    req.user.role === ROLES.ADMIN ? InvoiceModel.findByJobId(jobId) : null,
  ]);
  const baseUrl = getBaseUrl(req);

  ok(res, 'Job fetched successfully', {
    ...JobModel.mapJob(row),
    parts: parts.map(PartModel.mapPart),
    images: images.map((i) => ImageModel.mapImage(i, baseUrl)),
    invoice: invoiceRow ? { id: invoiceRow.id, invoiceNumber: invoiceRow.invoice_number, finalTotal: invoiceRow.final_total } : null,
  });
});

const updateJob = asyncHandler(async (req, res) => {
  const { jobId } = req.params;
  const job = await JobModel.findRaw(jobId);
  if (!job) throw ApiError.notFound('Job not found');
  if ([JOB_STATUS.COMPLETED, JOB_STATUS.CANCELLED].includes(job.status)) {
    throw ApiError.badRequest(`${job.status} jobs cannot be edited`);
  }
  await JobModel.update(jobId, req.body);
  ok(res, 'Job updated successfully', JobModel.mapJob(await JobModel.findById(jobId)));
});

const deleteJob = asyncHandler(async (req, res) => {
  const { jobId } = req.params;
  const job = await JobModel.findRaw(jobId);
  if (!job) throw ApiError.notFound('Job not found');
  if (await InvoiceModel.findByJobId(jobId)) {
    throw ApiError.conflict('Cannot delete a job that already has an invoice');
  }
  const images = await ImageModel.listByJob(jobId);
  await JobModel.remove(jobId); // parts + images rows cascade
  await removeFiles(images.map((i) => resolveUploadPath(i.file_path)));
  ok(res, 'Job deleted successfully', null);
});

const assignJob = asyncHandler(async (req, res) => {
  const { jobId } = req.params;
  const { workerId } = req.body;
  let reassigned = false;

  await withTransaction(async (conn) => {
    const job = await JobModel.findRawForUpdate(jobId, conn);
    if (!job) throw ApiError.notFound('Job not found');
    if (job.status === JOB_STATUS.CANCELLED) throw ApiError.badRequest('Cancelled jobs cannot be assigned to a worker');
    if (job.status === JOB_STATUS.COMPLETED) throw ApiError.badRequest('Completed jobs cannot be reassigned');
    await ensureWorker(workerId, conn);

    reassigned = !!job.assigned_worker_id;
    const newStatus = job.status === JOB_STATUS.PENDING ? JOB_STATUS.ASSIGNED : job.status;
    await JobModel.assign(jobId, workerId, newStatus, conn);
  });

  ok(res, reassigned ? 'Worker reassigned successfully' : 'Worker assigned successfully',
    JobModel.mapJob(await JobModel.findById(jobId)));
});

/**
 * Status rules
 *  - Assigned worker: Assigned -> In Progress -> Completed
 *  - Admin: may only cancel (Pending/Assigned/In Progress -> Cancelled)
 *  - Transitions validated against STATUS_TRANSITIONS (Completed can never go back).
 */
const updateJobStatus = asyncHandler(async (req, res) => {
  const { jobId } = req.params;
  const { status: target } = req.body;

  await withTransaction(async (conn) => {
    const job = await JobModel.findRawForUpdate(jobId, conn);
    if (!job) throw ApiError.notFound('Job not found');

    const isWorker = req.user.role === ROLES.WORKER;
    if (isWorker && job.assigned_worker_id !== req.user.id) {
      throw ApiError.forbidden('Only the assigned worker can update this job status');
    }

    if (job.status === target) throw ApiError.badRequest(`Job is already ${target}`);
    if (job.status === JOB_STATUS.COMPLETED && target === JOB_STATUS.PENDING) {
      throw ApiError.badRequest('Completed jobs cannot be moved back to Pending');
    }
    if (!canTransition(job.status, target)) {
      const allowed = STATUS_TRANSITIONS[job.status];
      throw ApiError.badRequest(
        `Invalid status change: ${job.status} -> ${target}. Allowed: ${allowed.length ? allowed.join(', ') : 'none (final state)'}`
      );
    }

    const allowedTargets = isWorker ? [JOB_STATUS.IN_PROGRESS, JOB_STATUS.COMPLETED] : [JOB_STATUS.CANCELLED];
    if (!allowedTargets.includes(target)) {
      throw ApiError.forbidden(
        isWorker
          ? 'Workers can only move a job to In Progress or Completed'
          : 'Admin can only cancel a job; the assigned worker updates progress'
      );
    }
    await JobModel.updateStatus(jobId, target, conn);
  });

  ok(res, `Job status updated to ${target}`, JobModel.mapJob(await JobModel.findById(jobId)));
});

module.exports = { createJob, listJobs, listCompletedJobs, getJob, updateJob, deleteJob, assignJob, updateJobStatus };
