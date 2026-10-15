// Large screenshots are scaled and saved as a JPEG before they're sent:
// quicker to upload, still sharp enough to read. Used by the Slip Analyzer
// and Slip to PrizePicks.
export async function shrink(file){
 try{
  const bitmap=await createImageBitmap(file);
  const scale=Math.min(1,1280/bitmap.width,2800/bitmap.height);
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close?.();
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.88));
  return blob||file;
 }catch{return file;}
}
