// All money maths is done in integer paise to avoid floating point errors.
const toCents = (amount) => Math.round(Number(amount) * 100);
const fromCents = (cents) => cents / 100;
module.exports = { toCents, fromCents };
