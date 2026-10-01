const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const env = require('../config/env');
const { withTransaction } = require('../config/db');
const { JOB_STATUS } = require('../constants');
const { calculateInvoice } = require('../utils/invoiceCalculator');
const { buildPagination } = require('../utils/helpers');
const JobModel = require('../models/job.model');
const PartModel = require('../models/part.model');
const InvoiceModel = require('../models/invoice.model');

const createInvoice = asyncHandler(async (req, res) => {
  const { jobId, serviceCost, cleaningCost } = req.body;

  const invoiceId = await withTransaction(async (conn) => {
    const job = await JobModel.findRawForUpdate(jobId, conn);
    if (!job) throw ApiError.notFound('Job not found');
    if (job.status !== JOB_STATUS.COMPLETED) {
      throw ApiError.badRequest(`Invoice can only be generated for Completed jobs (current status: ${job.status})`);
    }
    if (await InvoiceModel.findByJobId(jobId, conn)) {
      throw ApiError.conflict('Invoice already generated for this job');
    }

    const partsTotal = await PartModel.sumByJob(jobId, conn);
    const calc = calculateInvoice({ partsTotal, serviceCost, cleaningCost, gstPercent: env.gstPercent });
    return InvoiceModel.create({ jobId, ...calc, generatedBy: req.user.id }, conn);
  });

  const row = await InvoiceModel.findById(invoiceId);
  const parts = (await PartModel.listByJob(jobId)).map(PartModel.mapPart);
  created(res, 'Invoice generated successfully', InvoiceModel.mapInvoice(row, parts));
});

const getInvoice = asyncHandler(async (req, res) => {
  const row = await InvoiceModel.findById(req.params.invoiceId);
  if (!row) throw ApiError.notFound('Invoice not found');
  const parts = (await PartModel.listByJob(row.job_id)).map(PartModel.mapPart);
  ok(res, 'Invoice fetched successfully', InvoiceModel.mapInvoice(row, parts));
});

const listInvoices = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const { rows, total } = await InvoiceModel.findAll({ page, limit });
  ok(res, 'Invoices fetched successfully', rows.map((r) => InvoiceModel.mapInvoice(r)), {
    pagination: buildPagination(page, limit, total),
  });
});

module.exports = { createInvoice, getInvoice, listInvoices };
