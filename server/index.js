import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const POSTER_DIR = path.join(UPLOAD_DIR, 'posters');
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'media.json');
for (const dir of [UPLOAD_DIR, POSTER_DIR, DATA_DIR]) fs.mkdirSync(dir, { recursive: true });

const app = express();
const PORT = Number(process.env.PORT || 4000);
const MAX_BYTES = Math.min(Number(process.env.MAX_FILE_SIZE_GB || 2), 2) * 1024 * 1024 * 1024;
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map(s => s.trim());

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: (origin, cb) => {
  if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) return cb(null, true);
  return cb(new Error('Origin is not allowed by CORS'));
}}));
app.use(express.json({ limit: '1mb' }));

function readMedia() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch (e) { if (e.code === 'ENOENT') return []; throw e; }
}
function writeMedia(items) {
  const temp = `${DB_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(items, null, 2));
  fs.renameSync(temp, DB_FILE);
}
function safeUnlink(filePath) {
  if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
}
const mediaStorage = multer.diskStorage({
  destination: (_req, file, cb) => cb(null, file.fieldname === 'poster' ? POSTER_DIR : UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '');
    cb(null, `${randomUUID()}${ext}`);
  }
});
const allowedMediaExt = new Set(['.mp4','.webm','.mov','.m4v','.mkv','.mp3','.m4a','.aac','.wav','.ogg','.flac']);
const allowedPosterExt = new Set(['.jpg','.jpeg','.png','.webp']);
const upload = multer({
  storage: mediaStorage,
  limits: { fileSize: MAX_BYTES, files: 2, fields: 3, fieldSize: 2048 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (file.fieldname === 'media') {
      if (!allowedMediaExt.has(ext)) return cb(new Error('Unsupported media format. Use MP4/video or a supported audio file.'));
      return cb(null, true);
    }
    if (file.fieldname === 'poster') {
      if (!allowedPosterExt.has(ext)) return cb(new Error('Poster must be JPG, PNG, or WEBP.'));
      if (file.size > 5 * 1024 * 1024) return cb(new Error('Poster image must be 5 MB or smaller.'));
      return cb(null, true);
    }
    cb(new Error('Unexpected upload field.'));
  }
});

app.get('/api/health', (_req, res) => res.json({ status: 'ok', maxFileSizeBytes: MAX_BYTES }));
app.get('/api/media', (_req, res) => {
  try {
    const items = readMedia().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(items);
  } catch { res.status(500).json({ error: 'Could not read the media library.' }); }
});
app.post('/api/media', (req, res) => {
  upload.fields([{ name: 'media', maxCount: 1 }, { name: 'poster', maxCount: 1 }])(req, res, err => {
    if (err) {
      for (const group of Object.values(req.files || {})) for (const f of group) safeUnlink(f.path);
      const status = err instanceof multer.MulterError ? (err.code === 'LIMIT_FILE_SIZE' ? 413 : 400) : 400;
      return res.status(status).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'File exceeds the 2 GB upload limit.' : err.message || 'Upload failed.' });
    }
    const media = req.files?.media?.[0];
    const poster = req.files?.poster?.[0];
    const title = String(req.body?.title || '').trim();
    const kind = String(req.body?.kind || '').toLowerCase();
    if (!media) { safeUnlink(poster?.path); return res.status(400).json({ error: 'Choose a media file to upload.' }); }
    if (!title || title.length > 140) {
      safeUnlink(media.path); safeUnlink(poster?.path);
      return res.status(400).json({ error: 'Title is required and must be at most 140 characters.' });
    }
    const ext = path.extname(media.originalname).toLowerCase();
    const actualKind = ['.mp3','.m4a','.aac','.wav','.ogg','.flac'].includes(ext) ? 'song' : 'movie';
    if (!['movie','song'].includes(kind)) {
      safeUnlink(media.path); safeUnlink(poster?.path);
      return res.status(400).json({ error: 'Media type must be movie or song.' });
    }
    const item = {
      id: randomUUID(), title, kind: actualKind,
      originalName: path.basename(media.originalname).slice(0, 255),
      filename: media.filename, url: `/media/${encodeURIComponent(media.filename)}`,
      size: media.size, mimeType: media.mimetype || 'application/octet-stream',
      posterFilename: poster?.filename || null,
      posterUrl: poster ? `/media/posters/${encodeURIComponent(poster.filename)}` : null,
      createdAt: new Date().toISOString()
    };
    try { const items = readMedia(); items.push(item); writeMedia(items); }
    catch {
      safeUnlink(media.path); safeUnlink(poster?.path);
      return res.status(500).json({ error: 'Could not save media metadata.' });
    }
    return res.status(201).json(item);
  });
});
app.delete('/api/media/:id', (req, res) => {
  try {
    const items = readMedia();
    const item = items.find(entry => entry.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'Media item not found.' });
    writeMedia(items.filter(entry => entry.id !== item.id));
    safeUnlink(path.join(UPLOAD_DIR, path.basename(item.filename)));
    if (item.posterFilename) safeUnlink(path.join(POSTER_DIR, path.basename(item.posterFilename)));
    return res.json({ success: true });
  } catch { return res.status(500).json({ error: 'Could not delete this media item.' }); }
});

app.use('/media', express.static(UPLOAD_DIR, {
  fallthrough: false,
  setHeaders: (res, filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    if (['.mp4','.m4v','.mov','.webm','.mkv'].includes(ext)) res.setHeader('Content-Type', ext === '.mp4' ? 'video/mp4' : 'video/' + ext.slice(1));
    if (['.mp3','.m4a','.aac','.wav','.ogg','.flac'].includes(ext)) res.setHeader('Content-Type', 'audio/' + ext.slice(1));
    res.setHeader('Cache-Control', 'public, max-age=3600');
  }
}));

const distDir = path.join(ROOT, 'client', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (req, res, next) => req.path.startsWith('/api/') || req.path.startsWith('/media/') ? next() : res.sendFile(path.join(distDir, 'index.html')));
}
app.use((err, _req, res, _next) => {
  if (res.headersSent) return;
  const status = err.status || (err.message?.includes('CORS') ? 403 : 500);
  res.status(status).json({ error: status === 500 ? 'Internal server error.' : err.message });
});
app.listen(PORT, () => console.log(`Phoenix Movies DSX API listening on http://localhost:${PORT} (max file ${MAX_BYTES} bytes)`));
