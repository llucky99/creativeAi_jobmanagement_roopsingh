const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const validateId = require('../middleware/validateId');
const { ROLES } = require('../constants');
const v = require('../validations/invoice.validation');
const c = require('../controllers/invoice.controller');

router.use(authenticate, authorize(ROLES.ADMIN));

router.post('/', validate(v.create), c.createInvoice);
router.get('/', validate(v.listQuery, 'query'), c.listInvoices);
router.get('/:invoiceId', validateId('invoiceId'), c.getInvoice);

module.exports = router;
