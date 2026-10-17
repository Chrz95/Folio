// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { ReminderPreferencesForm } from './ReminderPreferencesForm';
import { DEFAULT_REMINDER_PREFERENCES } from './reminders.constants';
import { readLocalReminderState } from './reminderStateService';
vi.mock('../../app/config/environment', () => ({ environment: { isDemo: true, apiBaseUrl: '/api/v1' } }));
afterEach(() => {
  cleanup();
  localStorage.clear();
});
describe('reminder preferences', () => {
  it('persists a timezone, delivery time and daily digest without requesting permission', async () => {
    render(<ReminderPreferencesForm preferences={DEFAULT_REMINDER_PREFERENCES} />);
    fireEvent.change(screen.getByLabelText('Timezone'), { target: { value: 'America/New_York' } });
    fireEvent.change(screen.getByLabelText('Deliver at'), { target: { value: '18:30' } });
    fireEvent.change(screen.getByLabelText('Reminder style'), { target: { value: 'digest' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save reminder timing' }));
    await waitFor(() =>
      expect(readLocalReminderState().preferences).toEqual({
        timeZone: 'America/New_York',
        deliveryTime: '18:30',
        mode: 'digest',
        overdueDays: 3,
      }),
    );
    expect(screen.getByText('Reminder timing saved. Notification permission is unchanged.')).toBeInTheDocument();
  });
});
