import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import archiver from 'archiver';
import { Readable } from 'stream';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const upload = multer({ limits: { fileSize: 50 * 1024 * 1024 } });
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.post('/api/slice', upload.single('image'), async (req, res) => {
  try {
    const { yRois, xRoi } = JSON.parse(req.body.coords);
    const imgBuff = req.file.buffer;
    const meta = await sharp(imgBuff).metadata();
    const w = meta.width;

    const [x1, x2] = xRoi ?? [0, w];
    const archive = archiver('zip');
    res.attachment('slices.zip');
    archive.pipe(res);

    await Promise.all(
      yRois.map(async ([y1, y2], idx) => {
        const slice = await sharp(imgBuff)
          .extract({ left: x1, top: y1, width: x2 - x1, height: y2 - y1 })
          .png()
          .toBuffer();
        archive.append(Readable.from(slice), { name: `slice_${idx + 1}.png` });
      })
    );

    archive.finalize();
  } catch (e) {
    console.error(e);
    res.status(500).send('画像処理に失敗しました');
  }
});

app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (_, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});
app.listen(3000, () => console.log('✅ http://localhost:3000'));
