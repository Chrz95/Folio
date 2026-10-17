import type { ImportWizardState } from './useImportWizard';
import type { CsvOptions } from './csv.types';
interface ImportFormatOptionsProps {
  wizard: ImportWizardState;
}
/** Ask for ambiguous bank formats instead of guessing dates or amount signs.
 * @param {ImportFormatOptionsProps} props - Formats.
 * @param {ImportWizardState} props.wizard - Mapping state. @returns {JSX.Element | null} Format controls. */
export function ImportFormatOptions({ wizard }: ImportFormatOptionsProps) {
  const { options } = wizard;
  if (!options) {
    return null;
  }
  return (
    <div className="format-options">
      <label>
        Date format
        <select
          value={options.dateFormat}
          onChange={(event) =>
            wizard.setOptions({ ...options, dateFormat: event.target.value as CsvOptions['dateFormat'] })
          }
        >
          <option value="iso">Year–month–day (2026-10-16)</option>
          <option value="dmy">Day/month/year (16/10/2026)</option>
          <option value="mdy">Month/day/year (10/16/2026)</option>
        </select>
      </label>
      <label>
        Decimal separator
        <select
          value={options.decimalSeparator}
          onChange={(event) => wizard.setOptions({ ...options, decimalSeparator: event.target.value as '.' | ',' })}
        >
          <option value=".">Dot · 1,234.56</option>
          <option value=",">Comma · 1.234,56</option>
        </select>
      </label>
      <label>
        Signed amounts
        <select
          value={options.expenseSign}
          onChange={(event) =>
            wizard.setOptions({ ...options, expenseSign: event.target.value as CsvOptions['expenseSign'] })
          }
        >
          <option value="negative">Negative means expense</option>
          <option value="positive">Positive means expense</option>
        </select>
      </label>
    </div>
  );
}
