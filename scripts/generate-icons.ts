// scripts/generate-icons.ts
// public/icons/icon.svg から PWA 用の PNG アイコンを生成する（アイコン変更時に手動で実行）。
import sharp from 'sharp';

const SRC = 'public/icons/icon.svg';
const OUT = 'public/icons';

async function main() {
  await sharp(SRC).resize(192, 192).png().toFile(`${OUT}/icon-192.png`);
  await sharp(SRC).resize(512, 512).png().toFile(`${OUT}/icon-512.png`);
  await sharp(SRC).resize(180, 180).png().toFile(`${OUT}/apple-touch-icon.png`);
  // maskable はホーム画面で円形などに切り抜かれるため、内側 80% に収めて余白を背景色で埋める
  const inner = await sharp(SRC).resize(400, 400).png().toBuffer();
  await sharp({ create: { width: 512, height: 512, channels: 4, background: '#1e3a8a' } })
    .composite([{ input: inner, top: 56, left: 56 }])
    .png()
    .toFile(`${OUT}/icon-maskable-512.png`);
  console.log('icons generated');
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
