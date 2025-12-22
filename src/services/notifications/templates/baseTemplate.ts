import { styles } from './styles';

export type TableRow = [string, string] | { label: string; value: string };

/**
 * Helper function to format sites array as comma-separated string
 * Handles both sites array and legacy site field for backward compatibility
 */
export function formatSites(pr: { sites?: string[]; site?: string }): string {
  if (pr.sites && pr.sites.length > 0) {
    return pr.sites.join(', ');
  }
  if (pr.site) {
    return pr.site;
  }
  return 'Not specified';
}

export function generateTable(rows: TableRow[]): string {
  return `
    <table style="${styles.table}">
      ${rows.map(row => {
        const [key, value] = Array.isArray(row) 
          ? row 
          : [row.label, row.value];
        
        return `
        <tr>
          <td style="${styles.tableCell}"><strong>${key}</strong></td>
          <td style="${styles.tableCell}">${value}</td>
        </tr>
      `;
      }).join('')}
    </table>
  `;
}
