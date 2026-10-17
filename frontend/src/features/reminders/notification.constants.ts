/** Browser-specific push setup and user-visible test content. */
export const NOTIFICATIONS = {
  workerTimeout: 10000,
  keyBase: 4,
  testTitle: 'Folio notifications are connected',
  testBody: 'This device can receive your Folio reminders.',
  testTag: 'folio-device-test',
  loopback: ['localhost', '127.0.0.1', '[::1]'],
  standalone: '(display-mode: standalone)',
} as const;
export interface NotificationConfiguration {
  enabled: boolean;
  publicKey: string;
  subscriptions: number;
}
export interface DeviceStatus {
  configuration: NotificationConfiguration;
  permission: NotificationPermission | 'unsupported';
  hasSubscription: boolean;
  registered: boolean;
  isEnabled: boolean;
  blocker: string;
}
