// src/lib/image.ts
// 答案写真の縮小。スマホのカメラ画像（数MB）をそのまま送ると通信量と採点時間がかさむため、
// 長辺 1568px（Claude の画像入力で縮小されずに使われる上限の目安）の JPEG に変換する。
import { AppError } from './errors';

const MAX_EDGE = 1568;

export type EncodedImage = { mediaType: 'image/jpeg'; base64: string; previewUrl: string };

export async function compressImage(file: File): Promise<EncodedImage> {
  if (!file.type.startsWith('image/')) throw new AppError('画像ファイルを選んでください。');
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch (e) {
    throw new AppError('画像を読み込めませんでした。', 'JPEG または PNG の写真を選んでください。', { cause: e });
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new AppError('画像の変換に失敗しました。');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvasToImage(canvas);
}

/** キャンバスの内容を答案画像（JPEG）にする。計算メモを答案として提出するときにも使う */
export async function canvasToImage(canvas: HTMLCanvasElement): Promise<EncodedImage> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  if (!blob) throw new AppError('画像の変換に失敗しました。');
  const base64 = await blobToBase64(blob);
  return { mediaType: 'image/jpeg', base64, previewUrl: URL.createObjectURL(blob) };
}

export { MAX_EDGE as MAX_IMAGE_EDGE };

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(new AppError('画像の読み込みに失敗しました。'));
    reader.readAsDataURL(blob);
  });
}
