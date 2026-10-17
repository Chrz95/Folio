import type { ReminderCenterState } from './useReminderCenter';
import { environment } from '../../app/config/environment';
interface ReminderDeliveryHistoryProps {
  center: ReminderCenterState;
}
/** Distinguish provider acknowledgments, failures and expired subscriptions from read receipts.
 * @param {ReminderDeliveryHistoryProps} props - Delivery state.
 * @param {ReminderCenterState} props.center - Latest safe provider history. @returns {JSX.Element} Delivery log. */
export function ReminderDeliveryHistory({ center }: ReminderDeliveryHistoryProps) {
  return (
    <section className="panel delivery-history">
      <div className="panel-heading">
        <div>
          <h2>How your reminders are doing</h2>
          <p>
            {environment.isDemo
              ? 'Device notifications from this open preview.'
              : 'Latest attempts across this workspace’s subscribed browsers.'}{' '}
            Sent means accepted by the push service or browser, not read.
          </p>
        </div>
      </div>
      {center.state.attempts.map((attempt) => (
        <div
          key={attempt.id}
          className="delivery-history-entry"
        >
          <span className={`delivery-status ${attempt.status}`}>
            {attempt.status === 'sent'
              ? 'Sent'
              : attempt.status === 'expired'
                ? 'Subscription expired'
                : 'Delivery failed'}
          </span>
          <span>
            <strong>{attempt.title}</strong>
            <small>
              {new Date(attempt.attemptedAt).toLocaleString()} · attempt {attempt.count}
            </small>
          </span>
        </div>
      ))}
      {!center.state.attempts.length && (
        <div className="empty-state">
          <p>No delivery attempts yet. Enable reminders and choose a delivery time.</p>
        </div>
      )}
    </section>
  );
}
