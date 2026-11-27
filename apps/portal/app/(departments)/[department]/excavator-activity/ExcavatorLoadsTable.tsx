import {
  LOAD_TABLE_CAPTION_CLASS,
  LOAD_TABLE_CELL_CLASS,
  LOAD_TABLE_CLASS,
  LOAD_TABLE_FOOT_CELL_CLASS,
  LOAD_TABLE_HEAD_CELL_CLASS,
  LOAD_TABLE_NUM_CELL_CLASS,
  LOAD_TABLE_WRAPPER_CLASS,
} from './excavator-activity-styles';
import type { ExcavatorLoadTable } from './excavator-shift-helpers';

interface ExcavatorLoadsTableProps {
  readonly excavatorName: string;
  readonly table: ExcavatorLoadTable;
}

const NUMBER_FORMAT = new Intl.NumberFormat('en-ZA', { maximumFractionDigits: 1 });

function formatMaterial(value: number | null): string {
  return value === null ? '—' : `${NUMBER_FORMAT.format(value)} BCM`;
}

/** Compact Machine ID | Loads | Total Material table with an auto-summed Total footer. */
export function ExcavatorLoadsTable({ excavatorName, table }: ExcavatorLoadsTableProps) {
  return (
    <div
      data-testid={`excavator-loads-table-${excavatorName}`}
      className={LOAD_TABLE_WRAPPER_CLASS}
    >
      <table className={LOAD_TABLE_CLASS}>
        <caption className={LOAD_TABLE_CAPTION_CLASS}>
          Machines and loads assigned to {excavatorName} this shift
        </caption>
        <thead>
          <tr>
            <th scope="col" className={LOAD_TABLE_HEAD_CELL_CLASS}>
              Machine ID
            </th>
            <th scope="col" className={`${LOAD_TABLE_HEAD_CELL_CLASS} text-right`}>
              Loads
            </th>
            <th scope="col" className={`${LOAD_TABLE_HEAD_CELL_CLASS} text-right`}>
              Total Material
            </th>
          </tr>
        </thead>
        <tbody>
          {table.rows.length === 0 ? (
            <tr>
              <td colSpan={3} className={`${LOAD_TABLE_CELL_CLASS} text-center italic`}>
                No machines assigned this shift
              </td>
            </tr>
          ) : (
            table.rows.map((row) => (
              <tr key={row.machineId}>
                <th scope="row" className={`${LOAD_TABLE_CELL_CLASS} font-semibold`}>
                  {row.machineName}
                </th>
                <td className={`${LOAD_TABLE_CELL_CLASS} ${LOAD_TABLE_NUM_CELL_CLASS}`}>
                  {row.loads}
                </td>
                <td className={`${LOAD_TABLE_CELL_CLASS} ${LOAD_TABLE_NUM_CELL_CLASS}`}>
                  {formatMaterial(row.totalMaterial)}
                </td>
              </tr>
            ))
          )}
        </tbody>
        <tfoot>
          <tr data-testid={`excavator-loads-total-${excavatorName}`}>
            <th scope="row" className={LOAD_TABLE_FOOT_CELL_CLASS}>
              Total
            </th>
            <td className={`${LOAD_TABLE_FOOT_CELL_CLASS} ${LOAD_TABLE_NUM_CELL_CLASS}`}>
              {table.totalLoads}
            </td>
            <td className={`${LOAD_TABLE_FOOT_CELL_CLASS} ${LOAD_TABLE_NUM_CELL_CLASS}`}>
              {formatMaterial(table.totalMaterial)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
