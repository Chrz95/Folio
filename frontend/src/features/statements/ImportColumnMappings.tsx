import type { CsvMapping } from './csv.types';
import type { ImportWizardState } from './useImportWizard';
interface ImportColumnMappingsProps {
  wizard: ImportWizardState;
}
const MAPPING_LABELS: { field: keyof CsvMapping; label: string }[] = [
  { field: 'date', label: 'Date *' },
  { field: 'name', label: 'Description *' },
  { field: 'amount', label: 'Amount *' },
  { field: 'bankId', label: 'Bank transaction ID' },
  { field: 'category', label: 'Category' },
  { field: 'type', label: 'Type (income / expense)' },
  { field: 'currency', label: 'Currency' },
  { field: 'notes', label: 'Notes' },
];
/** Map by column position, including duplicate header names.
 * @param {ImportColumnMappingsProps} props - Mapping step.
 * @param {ImportWizardState} props.wizard - Parsed file and options. @returns {JSX.Element | null} Mapping grid. */
export function ImportColumnMappings({ wizard }: ImportColumnMappingsProps) {
  const { options, file } = wizard;
  if (!options || !file) {
    return null;
  }
  return (
    <div className="mapping-grid">
      {MAPPING_LABELS.map(({ field, label }) => (
        <label key={field}>
          {label}
          <select
            value={options.mapping[field]}
            onChange={(event) =>
              wizard.setOptions({ ...options, mapping: { ...options.mapping, [field]: Number(event.target.value) } })
            }
          >
            <option value="-1">Not mapped</option>
            {file.headers.map((header, index) => (
              <option
                key={`${field}-column-${header}-${String(index)}`}
                value={index}
              >
                {index + 1}. {header || 'Unnamed column'}
              </option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );
}
