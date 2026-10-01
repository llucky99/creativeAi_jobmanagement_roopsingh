const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { ROLES } = require('../constants');
const c = require('../controllers/user.controller');

router.get('/workers', authenticate, authorize(ROLES.ADMIN), c.listWorkers);

module.exports = router;
