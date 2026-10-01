const send = (res, statusCode, message, data = null, extra = {}) =>
  res.status(statusCode).json({ success: true, message, data, ...extra });

module.exports = {
  ok: (res, message, data, extra) => send(res, 200, message, data, extra),
  created: (res, message, data, extra) => send(res, 201, message, data, extra),
};
