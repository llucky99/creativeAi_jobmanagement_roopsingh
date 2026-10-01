const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const validateId = require('../middleware/validateId');
const { uploadJobImages } = require('../middleware/upload');
const { ROLES } = require('../constants');
const v = require('../validations/job.validation');
const pv = require('../validations/part.validation');
const job = require('../controllers/job.controller');
const part = require('../controllers/part.controller');
const image = require('../controllers/image.controller');

const { ADMIN, WORKER } = ROLES;

router.use(authenticate);

// ---- Jobs ----
router.get('/', authorize(ADMIN, WORKER), validate(v.listQuery, 'query'), job.listJobs);
router.post('/', authorize(ADMIN), validate(v.create), job.createJob);
// must be declared before "/:jobId"
router.get('/completed', authorize(ADMIN), validate(v.completedQuery, 'query'), job.listCompletedJobs);

router.get('/:jobId', authorize(ADMIN, WORKER), validateId('jobId'), job.getJob);
router.put('/:jobId', authorize(ADMIN), validateId('jobId'), validate(v.update), job.updateJob);
router.delete('/:jobId', authorize(ADMIN), validateId('jobId'), job.deleteJob);

// ---- Assignment & status ----
router.post('/:jobId/assign', authorize(ADMIN), validateId('jobId'), validate(v.assign), job.assignJob);
router.patch('/:jobId/status', authorize(ADMIN, WORKER), validateId('jobId'), validate(v.updateStatus), job.updateJobStatus);

// ---- Parts / materials ----
router.get('/:jobId/parts', authorize(ADMIN, WORKER), validateId('jobId'), part.ensureJobAccess, part.listParts);
router.post('/:jobId/parts', authorize(WORKER), validateId('jobId'), part.ensureWorkerOwnsOpenJob, validate(pv.create), part.addPart);
router.put('/:jobId/parts/:partId', authorize(WORKER), validateId('jobId', 'partId'), part.ensureWorkerOwnsOpenJob, validate(pv.update), part.updatePart);
router.delete('/:jobId/parts/:partId', authorize(WORKER), validateId('jobId', 'partId'), part.ensureWorkerOwnsOpenJob, part.deletePart);

// ---- Images (access is checked BEFORE multer writes anything to disk) ----
router.get('/:jobId/images', authorize(ADMIN, WORKER), validateId('jobId'), part.ensureJobAccess, image.listImages);
router.post('/:jobId/images', authorize(ADMIN, WORKER), validateId('jobId'), part.ensureJobAccess, uploadJobImages, image.uploadImages);
router.delete('/:jobId/images/:imageId', authorize(ADMIN, WORKER), validateId('jobId', 'imageId'), part.ensureJobAccess, image.deleteImage);

module.exports = router;
