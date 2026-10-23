import { Router } from 'express';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { db, id, now, recordAudit } from '../db.mjs';
import { authRequired } from '../auth.mjs';

const router = Router();

const ascii = (text) => String(text || '').replace(/[^\x20-\x7E]/g, '-');

router.get('/me', authRequired, (req, res) => {
  const certificates = db
    .prepare(
      `SELECT cert.*, c.title AS course_title FROM certificates cert JOIN courses c ON c.id = cert.course_id
       WHERE cert.user_id = ? ORDER BY cert.issued_at DESC`,
    )
    .all(req.user.id);
  res.json({ certificates });
});

router.post('/courses/:courseId/issue', authRequired, (req, res) => {
  const enrollment = db
    .prepare('SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?')
    .get(req.user.id, req.params.courseId);
  if (!enrollment) return res.status(403).json({ error: { code: 'NOT_ENROLLED', message: 'Enroll in the course first.' } });
  if (Number(enrollment.progress_percent) < 100) {
    return res.status(422).json({ error: { code: 'COURSE_INCOMPLETE', message: 'Complete 100% of the course to earn a certificate.' } });
  }
  const existing = db
    .prepare('SELECT * FROM certificates WHERE user_id = ? AND course_id = ?')
    .get(req.user.id, req.params.courseId);
  if (existing) return res.json({ certificate: existing, already_issued: true });
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.courseId);
  const credential = `VX-${(course.glyph || 'LMS').replace(/[^A-Z0-9]/gi, '').slice(0, 4).toUpperCase() || 'LMS'}-${Math.floor(1000 + Math.random() * 9000)}`;
  const certificate = {
    id: id('certificate'),
    user_id: req.user.id,
    course_id: course.id,
    certificate_url: null,
    credential_id: credential,
    issued_at: now(),
  };
  db.prepare(
    'INSERT INTO certificates (id, user_id, course_id, certificate_url, credential_id, issued_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(certificate.id, certificate.user_id, certificate.course_id, null, certificate.credential_id, certificate.issued_at);
  recordAudit(req.user.id, 'certificate.issued', 'course', course.id, { credential });
  res.status(201).json({ certificate: { ...certificate, course_title: course.title } });
});

router.get('/:id/download', authRequired, async (req, res, next) => {
  try {
    const certificate = db
      .prepare(
        `SELECT cert.*, c.title AS course_title FROM certificates cert JOIN courses c ON c.id = cert.course_id
         WHERE cert.id = ?`,
      )
      .get(req.params.id);
    if (!certificate) return res.status(404).json({ error: { code: 'CERTIFICATE_NOT_FOUND', message: 'Certificate not found.' } });
    if (certificate.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'This certificate belongs to another learner.' } });
    }

    const pdf = await PDFDocument.create();
    const page = pdf.addPage([842, 595]);
    const width = page.getWidth();
    const height = page.getHeight();
    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const serif = await pdf.embedFont(StandardFonts.TimesRoman);

    page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(0.043, 0.047, 0.071) });
    page.drawRectangle({
      x: 28,
      y: 28,
      width: width - 56,
      height: height - 56,
      borderColor: rgb(0.55, 0.45, 0.95),
      borderWidth: 1.2,
    });
    page.drawRectangle({
      x: 40,
      y: 40,
      width: width - 80,
      height: height - 80,
      borderColor: rgb(0.18, 0.55, 0.55),
      borderWidth: 0.6,
    });

    page.drawText('VERTEXON LEARNING', {
      x: 60,
      y: height - 92,
      size: 12,
      font: bold,
      color: rgb(0.68, 0.70, 0.86),
      characterSpacing: 3,
    });
    page.drawText('CERTIFICATE OF COMPLETION', {
      x: 60,
      y: height - 135,
      size: 13,
      font: regular,
      color: rgb(0.42, 0.78, 0.74),
      characterSpacing: 2,
    });

    page.drawText('This certifies that', {
      x: 60,
      y: height - 210,
      size: 15,
      font: serif,
      color: rgb(0.72, 0.74, 0.82),
    });
    page.drawText(ascii(req.user.full_name), {
      x: 60,
      y: height - 270,
      size: 38,
      font: bold,
      color: rgb(0.95, 0.95, 1),
    });
    page.drawLine({
      start: { x: 60, y: height - 288 },
      end: { x: width - 60, y: height - 288 },
      thickness: 0.7,
      color: rgb(0.45, 0.38, 0.85),
    });
    page.drawText('has successfully completed the course', {
      x: 60,
      y: height - 330,
      size: 14,
      font: serif,
      color: rgb(0.72, 0.74, 0.82),
    });
    page.drawText(ascii(certificate.course_title), {
      x: 60,
      y: height - 378,
      size: 24,
      font: bold,
      color: rgb(0.72, 0.86, 0.98),
      maxWidth: width - 120,
    });
    page.drawText('Demonstrating consistent engagement, applied practice, and successful assessment.', {
      x: 60,
      y: height - 414,
      size: 11,
      font: regular,
      color: rgb(0.62, 0.65, 0.76),
    });

    page.drawText(`Credential ID  ${ascii(certificate.credential_id)}`, {
      x: 60,
      y: 96,
      size: 10,
      font: regular,
      color: rgb(0.70, 0.72, 0.82),
    });
    page.drawText(`Issued  ${new Date(certificate.issued_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`, {
      x: 60,
      y: 78,
      size: 10,
      font: regular,
      color: rgb(0.70, 0.72, 0.82),
    });
    page.drawText('Vertexon Learning Technologies', {
      x: width - 270,
      y: 96,
      size: 11,
      font: bold,
      color: rgb(0.82, 0.84, 0.92),
    });
    page.drawText('Platform certification', {
      x: width - 270,
      y: 78,
      size: 10,
      font: regular,
      color: rgb(0.62, 0.65, 0.76),
    });

    const bytes = await pdf.save();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="Vertexon-Certificate-${String(certificate.credential_id).replace(/[^A-Za-z0-9-]/g, '')}.pdf"`,
    );
    res.send(Buffer.from(bytes));
  } catch (error) {
    next(error);
  }
});

export default router;
