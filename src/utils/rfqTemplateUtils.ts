import * as XLSX from 'xlsx';
import { LineItem, Attachment } from '@/types/pr';
import { StorageService } from '@/services/storage';

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
    'File/Folder Link (Optional)',
  ];

  // Create sample data row
  const sampleData = [
    'Example: Steel pipes 2 inch diameter',
    '100',
    'M',
    'Optional notes or specifications',
    '150',
    '15000',
    'https://example.com/specs.pdf OR https://dropbox.com/folder/specs',
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
    { wch: 50 }, // File/Folder Link
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
    'File/Folder Link (Optional)',
  ];

  const sampleData = [
    'Example: Steel pipes 2 inch diameter',
    '100',
    'M',
    'Optional notes or specifications',
    '150',
    '15000',
    'https://example.com/specs.pdf OR https://dropbox.com/folder/specs',
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
          const fileLink = getField(['File/Folder Link (Optional)', 'File Link', 'Link', 'Folder Link', 'File/Folder Link', 'URL']);

          if (!description) {
            throw new Error(`Row ${index + 2}: Description is required`);
          }

          // Determine if link is to a folder (keep as link) or file (will be downloaded)
          const isFolder = fileLink && (
            fileLink.toLowerCase().includes('/folder/') ||
            fileLink.toLowerCase().includes('/folders/') ||
            fileLink.toLowerCase().includes('?dl=0') || // Dropbox folder indicator
            fileLink.toLowerCase().endsWith('/') ||
            !fileLink.match(/\.(pdf|doc|docx|xls|xlsx|jpg|jpeg|png|gif|txt|zip|rar)(\?|$)/i) // No file extension
          );

          return {
            description,
            quantity,
            uom: uom || 'UNIT',
            notes: notes || '',
            estimatedUnitPrice,
            estimatedTotal: estimatedTotal || (estimatedUnitPrice ? estimatedUnitPrice * quantity : undefined),
            attachments: [],
            fileLink: fileLink || undefined,
            isFolder: fileLink ? isFolder : undefined,
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

/**
 * Download file from URL and upload to Firebase Storage
 * Returns Attachment object with Firebase Storage URL
 */
export const downloadAndUploadFileFromUrl = async (
  url: string,
  lineItemDescription: string
): Promise<Attachment | null> => {
  try {
    // Fetch the file from the URL
    const response = await fetch(url, {
      mode: 'cors',
      credentials: 'omit',
    });

    if (!response.ok) {
      console.warn(`Failed to download file from ${url}: ${response.status} ${response.statusText}`);
      return null;
    }

    // Get the blob
    const blob = await response.blob();

    // Extract filename from URL or use a default
    let filename = url.split('/').pop()?.split('?')[0] || 'attachment';
    
    // Clean the filename
    filename = filename.replace(/[^a-z0-9._-]/gi, '_');
    
    // If no extension, try to infer from content type
    if (!filename.includes('.')) {
      const contentType = response.headers.get('content-type');
      const ext = contentType?.split('/')[1]?.split(';')[0];
      if (ext) {
        filename += `.${ext}`;
      }
    }

    // Create a File object
    const file = new File([blob], filename, { type: blob.type });

    // Upload to temp storage first
    const tempUrl = await StorageService.uploadToTempStorage(
      file,
      `line-items/${Date.now()}-${filename}`
    );

    // Return attachment object
    return {
      name: filename,
      url: tempUrl,
      path: `temp/line-items/${Date.now()}-${filename}`,
      uploadedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`Error downloading/uploading file from ${url}:`, error);
    return null;
  }
};

/**
 * Process line items to download files from URLs
 * For items with file links (not folders), downloads and converts to attachments
 */
export const processLineItemFileLinks = async (
  lineItems: Partial<LineItem>[],
  onProgress?: (current: number, total: number, fileName: string) => void
): Promise<Partial<LineItem>[]> => {
  const processedItems: Partial<LineItem>[] = [];

  for (let i = 0; i < lineItems.length; i++) {
    const item = lineItems[i];
    const processedItem = { ...item };

    if (item.fileLink && !item.isFolder) {
      // It's a file link, attempt to download it
      if (onProgress) {
        onProgress(i + 1, lineItems.length, item.description || 'Unknown');
      }

      const attachment = await downloadAndUploadFileFromUrl(
        item.fileLink,
        item.description || ''
      );

      if (attachment) {
        // Successfully downloaded, add to attachments
        processedItem.attachments = [...(item.attachments || []), attachment];
        // Keep the fileLink for reference, but mark as processed
      } else {
        // Failed to download, keep as link
        console.warn(`Failed to download file for "${item.description}". Keeping as link.`);
      }
    }
    // If it's a folder link or no link, just keep it as is

    processedItems.push(processedItem);
  }

  return processedItems;
};

