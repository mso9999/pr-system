import * as XLSX from 'xlsx';
import { LineItem } from '@/types/pr';

/**
 * Download an Excel template for RFQ line items
 */
export const downloadRFQTemplateExcel = (prNumber: string) => {
  // Create headers
  const headers = [
    'Description',
    'Quantity',
    'Unit of Measure (UOM)',
    'Notes',
    'Estimated Unit Price',
    'Estimated Total',
  ];

  // Create sample data row
  const sampleData = [
    'Example: Steel pipes 2 inch diameter',
    '100',
    'M',
    'Optional notes or specifications',
    '150',
    '15000',
  ];

  // Create worksheet
  const wsData = [headers, sampleData];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  ws['!cols'] = [
    { wch: 40 }, // Description
    { wch: 10 }, // Quantity
    { wch: 20 }, // UOM
    { wch: 35 }, // Notes
    { wch: 18 }, // Estimated Unit Price
    { wch: 15 }, // Estimated Total
  ];

  // Create workbook and add worksheet
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'RFQ Line Items');

  // Generate filename
  const filename = `RFQ_Template_${prNumber}_${new Date().toISOString().split('T')[0]}.xlsx`;

  // Download
  XLSX.writeFile(wb, filename);
};

/**
 * Download a CSV template for RFQ line items
 */
export const downloadRFQTemplateCSV = (prNumber: string) => {
  const headers = [
    'Description',
    'Quantity',
    'Unit of Measure (UOM)',
    'Notes',
    'Estimated Unit Price',
    'Estimated Total',
  ];

  const sampleData = [
    'Example: Steel pipes 2 inch diameter',
    '100',
    'M',
    'Optional notes or specifications',
    '150',
    '15000',
  ];

  // Create CSV content
  const csvContent = [
    headers.join(','),
    sampleData.map(cell => `"${cell}"`).join(','),
  ].join('\n');

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  const filename = `RFQ_Template_${prNumber}_${new Date().toISOString().split('T')[0]}.csv`;
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Parse uploaded Excel/CSV file and convert to LineItems
 */
export const parseRFQFile = async (file: File): Promise<Partial<LineItem>[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        let workbook: XLSX.WorkBook;

        if (file.name.endsWith('.csv')) {
          workbook = XLSX.read(data, { type: 'string' });
        } else {
          workbook = XLSX.read(data, { type: 'array' });
        }

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

        // Map the data to LineItem format
        const lineItems: Partial<LineItem>[] = jsonData.map((row, index) => {
          // Support various header names (case-insensitive)
          const getField = (names: string[]) => {
            for (const name of names) {
              const key = Object.keys(row).find(k => 
                k.toLowerCase().trim() === name.toLowerCase().trim()
              );
              if (key && row[key]) return String(row[key]).trim();
            }
            return '';
          };

          const description = getField(['Description', 'Item Description', 'Item', 'Product']);
          const quantity = parseFloat(getField(['Quantity', 'Qty', 'Amount'])) || 1;
          const uom = getField(['Unit of Measure (UOM)', 'UOM', 'Unit', 'Unit of Measure']);
          const notes = getField(['Notes', 'Specifications', 'Comments', 'Details']);
          const estimatedUnitPrice = parseFloat(getField(['Estimated Unit Price', 'Unit Price', 'Price', 'Cost'])) || undefined;
          const estimatedTotal = parseFloat(getField(['Estimated Total', 'Total', 'Total Price'])) || undefined;

          if (!description) {
            throw new Error(`Row ${index + 2}: Description is required`);
          }

          return {
            description,
            quantity,
            uom: uom || 'UNIT',
            notes: notes || '',
            estimatedUnitPrice,
            estimatedTotal: estimatedTotal || (estimatedUnitPrice ? estimatedUnitPrice * quantity : undefined),
            attachments: [],
          };
        });

        resolve(lineItems);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    if (file.name.endsWith('.csv')) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  });
};

