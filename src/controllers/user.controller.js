const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/response');
const UserModel = require('../models/user.model');

const listWorkers = asyncHandler(async (req, res) => {
  const workers = await UserModel.findWorkers();
  ok(res, 'Workers fetched successfully', workers.map(UserModel.toPublic));
});

module.exports = { listWorkers };
