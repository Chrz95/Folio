import { useState } from 'react';
import { useWorkspace } from '../../app/WorkspaceContext';
import { dateKey } from '../../utils/format';
import { buildForecast } from './forecast';
import { FORECAST } from './forecast.constants';
/** Keep projection assumptions separate from posted data. @returns {object} Controls and derived series. */
export function useForecast() {
  const { data } = useWorkspace();
  const [accountId, setAccountId] = useState('');
  const [days, setDays] = useState<number>(FORECAST.defaultDays);
  const [threshold, setThreshold] = useState('0');
  const [includeOverdue, setIncludeOverdue] = useState(false);
  const options = {
    startDate: dateKey(),
    accountId,
    days,
    includeOverdue,
    threshold: Math.round((Number(threshold) || 0) * FORECAST.amountScale),
  };
  const result = buildForecast(data, options);
  const accountWarnings = data.accounts
    .map((account) => ({
      name: account.name,
      warning: buildForecast(data, { ...options, accountId: account.id }).firstWarning,
    }))
    .filter((entry) => entry.warning);
  return {
    data,
    accountId,
    setAccountId,
    days,
    setDays,
    threshold,
    setThreshold,
    includeOverdue,
    setIncludeOverdue,
    result,
    accountWarnings,
    options,
  };
}
export type ForecastState = ReturnType<typeof useForecast>;
