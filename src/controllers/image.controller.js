const path = require('path');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const env = require('../config/env');
const { withTransaction } = require('../config/db');
const { getBaseUrl, removeFiles, hasValidImageSignature, resolveUploadPath } = require('../utils/helpers');
const JobModel = require('../models/job.model');
const ImageModel = require('../models/image.model');

const MAX = env.upload.maxImagesPerJob;

const uploadImages = asyncHandler(async (req, res) => {
  const files = req.files || [];
  const jobId = req.job.id;
  if (!files.length) throw ApiError.badRequest('No images uploaded. Send files using the form field "images"');

  try {
    for (const f of files) {
      if (!(await hasValidImageSignature(f.path))) {
        throw ApiError.badRequest(`"${f.originalname}" is not a valid image file`);
      }
    }

    await withTransaction(async (conn) => {
      await JobModel.findRawForUpdate(jobId, conn); // serialize concurrent uploads for this job
      const existing = await ImageModel.countByJob(jobId, conn);
      if (existing + files.length > MAX) {
        throw ApiError.badRequest(
          `Maximum ${MAX} images allowed per job. This job has ${existing}, you tried to add ${files.length}`
        );
      }
      for (const f of files) {
        await ImageModel.create({
          jobId,
          fileName: f.filename,
          originalName: f.originalname,
          mimeType: f.mimetype,
          fileSize: f.size,
          filePath: path.posix.join('jobs', f.filename), // relative to UPLOAD_DIR
          uploadedBy: req.user.id,
        }, conn);
      }
    });
  } catch (err) {
    await removeFiles(files.map((f) => f.path)); // never leave orphan files behind
    throw err;
  }

  const baseUrl = getBaseUrl(req);
  const all = await ImageModel.listByJob(jobId);
  created(res, `${files.length} image(s) uploaded successfully`, {
    totalImages: all.length,
    remainingSlots: MAX - all.length,
    images: all.map((i) => ImageModel.mapImage(i, baseUrl)),
  });
});

const listImages = asyncHandler(async (req, res) => {
  const baseUrl = getBaseUrl(req);
  const images = await ImageModel.listByJob(req.job.id);
  ok(res, 'Images fetched successfully', {
    totalImages: images.length,
    images: images.map((i) => ImageModel.mapImage(i, baseUrl)),
  });
});

const deleteImage = asyncHandler(async (req, res) => {
  const image = await ImageModel.findById(req.job.id, req.params.imageId);
  if (!image) throw ApiError.notFound('Image not found for this job');
  await ImageModel.remove(image.id);
  await removeFiles([resolveUploadPath(image.file_path)]);
  ok(res, 'Image deleted successfully', null);
});

module.exports = { uploadImages, listImages, deleteImage };
