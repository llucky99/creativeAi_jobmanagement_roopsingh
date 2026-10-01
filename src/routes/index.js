const router = require('express').Router();

router.use('/auth', require('./auth.routes'));
router.use('/users', require('./user.routes'));
router.use('/jobs', require('./job.routes'));
router.use('/invoices', require('./invoice.routes'));

module.exports = router;
