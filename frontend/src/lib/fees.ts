export const MARKET_CREATION_FEE_USDC = 1;
export const TRADING_FEE_BPS = 200;

export function formatTradingFee(bps = TRADING_FEE_BPS) {
  return `${(bps / 100).toFixed(1)}%`;
}

export function calculateTradingFee(amount: number, bps = TRADING_FEE_BPS) {
  return amount * (bps / 10_000);
}

export function calculateGrossUsdc(amount: number, bps = TRADING_FEE_BPS) {
  return amount + calculateTradingFee(amount, bps);
}
