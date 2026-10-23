import multer from 'multer';
import { extname } from 'node:path';
import { uploadsDir } from './db.mjs';

const allowed = new Set(['.pdf', '.zip', '.py', '.js', '.ts', '.tsx', '.java', '.cpp', '.c', '.txt', '.md', '.ipynb']);
const materialAllowed = new Set([
  ...allowed,
  '.ppt', '.pptx', '.doc', '.docx', '.csv', '.json', '.png', '.jpg', '.jpeg', '.webp', '.mp4', '.webm', '.m3u8',
]);
const imageAllowed = new Set(['.png', '.jpg', '.jpeg', '.webp']);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const extension = extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomUUID()}${extension}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const extension = extname(file.originalname).toLowerCase();
    if (!allowed.has(extension)) {
      return cb(new Error('Unsupported file type. Upload a PDF, ZIP, notebook, or source-code file.'));
    }
    cb(null, true);
  },
});

export const materialUpload = multer({
  storage,
  limits: { fileSize: 40 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const extension = extname(file.originalname).toLowerCase();
    if (!materialAllowed.has(extension)) {
      return cb(new Error('Unsupported file type. Upload a PDF, slide deck, document, image, video, notebook, or code file.'));
    }
    cb(null, true);
  },
});

export const imageUpload = multer({
  storage,
  limits: { fileSize: 6 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const extension = extname(file.originalname).toLowerCase();
    if (!imageAllowed.has(extension)) {
      return cb(new Error('Unsupported image type. Upload a PNG, JPG, or WebP file.'));
    }
    cb(null, true);
  },
});
