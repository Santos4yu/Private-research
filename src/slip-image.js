// A slip screenshot on its way to be read (slip_reader.py): large ones are
// scaled and saved as a JPEG first -- quicker to upload, still sharp enough
// to read. The Slip Analyzer and the admin's Record tab both send them.
export const READ_URL = '/api/prediction?action=slip-analyzer';

export async function shrink(file) {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1280 / bitmap.width, 2800 / bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close?.();
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.88));
    return blob || file;
  } catch { return file; }
}
