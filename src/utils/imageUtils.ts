/**
 * Image utility functions for PDF generation
 */

/**
 * Converts an image URL to a base64 data URL
 * This is needed for react-pdf to properly display external images
 */
export async function imageUrlToBase64(url: string): Promise<string> {
  console.log('[imageUtils] Starting image conversion for URL:', url);
  
  try {
    // Try to fetch with CORS mode
    console.log('[imageUtils] Fetching image...');
    const response = await fetch(url, {
      mode: 'cors',
      cache: 'no-cache',
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    console.log('[imageUtils] Response received, converting to blob...');
    const blob = await response.blob();
    console.log('[imageUtils] Blob created, size:', blob.size, 'type:', blob.type);
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        console.log('[imageUtils] Base64 conversion complete, length:', result?.length);
        resolve(result);
      };
      reader.onerror = (error) => {
        console.error('[imageUtils] FileReader error:', error);
        reject(error);
      };
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('[imageUtils] Error converting image to base64:', error);
    throw error;
  }
}

/**
 * Load image through an Image element (alternative method for CORS issues)
 */
export async function imageUrlToBase64ViaImage(url: string): Promise<string> {
  console.log('[imageUtils] Using Image element method for:', url);
  
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      try {
        console.log('[imageUtils] Image loaded, creating canvas...');
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        
        ctx.drawImage(img, 0, 0);
        const dataURL = canvas.toDataURL('image/png');
        console.log('[imageUtils] Canvas conversion complete, length:', dataURL.length);
        resolve(dataURL);
      } catch (error) {
        console.error('[imageUtils] Canvas conversion error:', error);
        reject(error);
      }
    };
    
    img.onerror = (error) => {
      console.error('[imageUtils] Image load error:', error);
      reject(new Error('Failed to load image'));
    };
    
    img.src = url;
  });
}

