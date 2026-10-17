/** Forecasts are bounded daily ending balances, not an intraday liquidity guarantee. */
export const FORECAST = {
  horizons: [30, 60, 90],
  defaultDays: 30,
  defaultThreshold: 0,
  width: 900,
  height: 240,
  padding: 28,
  amountScale: 100,
  dayMilliseconds: 86400000,
  labels: 4,
  recentEvents: 20,
} as const;
