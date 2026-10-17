/** Device registration and provider test bounds; the test payload contains no financial details. */
export const PUSH = {
  endpoint: 2048,
  publicKey: 200,
  auth: 100,
  testCooldown: 30000,
  testTtl: 60,
  testTimeout: 10000,
  rateLimited: 429,
  gatewayFailure: 502,
  title: 'Folio notifications are connected',
  body: 'This device can receive your Folio reminders.',
  testTag: 'folio-device-test',
  testPrefix: 'device-test:',
} as const;
