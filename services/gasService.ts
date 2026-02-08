import { compressImage } from '../utils/imageCompressor';

// Safely access GAS URL
// @ts-ignore
const env = (import.meta && import.meta.env) ? import.meta.env : {};
const GAS_WEB_APP_URL = env.VITE_GAS_URL;

const toBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = error => reject(error);
  });

export const uploadFile = async (file: File): Promise<string> => {
  if (!GAS_WEB_APP_URL) {
    throw new Error("Google Apps Script URL is not configured in environment variables (VITE_GAS_URL).");
  }

  let fileToUpload = file;
  // Compress image if it's a common image type
  if (['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      try {
        fileToUpload = await compressImage(file);
      } catch (e) {
        console.warn("Could not compress image, uploading original.", e);
      }
  }

  const base64Data = await toBase64(fileToUpload);
  
  const payload = {
    filename: fileToUpload.name,
    mimeType: fileToUpload.type,
    data: base64Data,
  };

  const response = await fetch(GAS_WEB_APP_URL, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: {
      'Content-Type': 'application/json',
    },
    // The default mode for fetch is 'cors'. Apps Script needs 'no-cors' for simple POST from browser.
    // However, for getting a JSON response back, a proper CORS setup in Apps Script is needed.
    // Assuming the GAS is set up to return JSON with proper CORS headers.
  });

  if (!response.ok) {
    throw new Error(`File upload failed with status: ${response.statusText}`);
  }

  const result = await response.json();

  if (result.status === 'success') {
    return result.fileUrl;
  } else {
    throw new Error(result.message || 'Unknown error during file upload.');
  }
};