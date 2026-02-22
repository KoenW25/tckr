const SERVICE_FEE_FIXED = 1.0; // €1,00
const SERVICE_FEE_PERCENTAGE = 0.015; // 1,5%

export function calculateServiceFee(ticketPrice) {
  const price = Number(ticketPrice) || 0;
  return Math.round((SERVICE_FEE_FIXED + price * SERVICE_FEE_PERCENTAGE) * 100) / 100;
}

export function calculateBuyerTotal(ticketPrice) {
  const price = Number(ticketPrice) || 0;
  const fee = calculateServiceFee(price);
  return Math.round((price + fee) * 100) / 100;
}

export function formatPrice(amount) {
  return Number(amount).toFixed(2).replace('.', ',');
}
