const { toCents, fromCents } = require('./money');

/**
 * Parts Total + Service Cost + Cleaning Cost = Subtotal; GST = subtotal * gstPercent%.
 * Returns values rounded to 2 decimals.
 */
const calculateInvoice = ({ partsTotal, serviceCost, cleaningCost, gstPercent = 10 }) => {
  const partsC = toCents(partsTotal);
  const serviceC = toCents(serviceCost);
  const cleaningC = toCents(cleaningCost);
  const subtotalC = partsC + serviceC + cleaningC;
  const gstC = Math.round((subtotalC * gstPercent) / 100);
  const totalC = subtotalC + gstC;
  return {
    partsTotal: fromCents(partsC),
    serviceCost: fromCents(serviceC),
    cleaningCost: fromCents(cleaningC),
    subtotal: fromCents(subtotalC),
    gstPercent,
    gstAmount: fromCents(gstC),
    finalTotal: fromCents(totalC),
  };
};

module.exports = { calculateInvoice };
