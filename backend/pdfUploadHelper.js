const fs = require('fs');
const path = require('path');

const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/**
 * Robust standard Node/Express multipart body parser for PDF uploads
 * Validates file headers (%PDF), stores securely in backend/uploads,
 * and extracts form fields without needing external binary dependencies.
 */
function handlePdfUpload(req, res, next) {
  const contentType = req.headers['content-type'] || '';
  if (!contentType.includes('multipart/form-data')) {
    // If sent as JSON (base64 or metadata)
    return next();
  }

  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) {
    return res.status(400).json({ success: false, error: 'Malformed multipart form data: missing boundary.' });
  }

  const boundary = boundaryMatch[1] || boundaryMatch[2];
  const chunks = [];

  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => {
    try {
      const buffer = Buffer.concat(chunks);
      const boundaryBuffer = Buffer.from(`--${boundary}`);
      const body = {};
      let fileData = null;

      let start = buffer.indexOf(boundaryBuffer);
      while (start !== -1) {
        const nextBoundary = buffer.indexOf(boundaryBuffer, start + boundaryBuffer.length);
        if (nextBoundary === -1) break;

        const partBuffer = buffer.subarray(start + boundaryBuffer.length, nextBoundary);
        const headerEnd = partBuffer.indexOf('\r\n\r\n');
        if (headerEnd !== -1) {
          const headersStr = partBuffer.subarray(0, headerEnd).toString('utf8');
          const dataBuffer = partBuffer.subarray(headerEnd + 4, partBuffer.length - 2); // strip trailing \r\n

          const dispMatch = headersStr.match(/content-disposition:\s*form-data;\s*name="([^"]+)"(?:;\s*filename="([^"]+)")?/i);
          if (dispMatch) {
            const fieldName = dispMatch[1];
            const filename = dispMatch[2];

            if (filename) {
              // Validate PDF
              const isPdfExtension = filename.toLowerCase().endsWith('.pdf');
              const isPdfHeader = dataBuffer.subarray(0, 4).toString('utf8') === '%PDF';

              if (!isPdfExtension && !isPdfHeader) {
                return res.status(400).json({
                  success: false,
                  error: 'Security Error: Only valid PDF (.pdf) documents are permitted.',
                });
              }

              const safeStoredName = `DOC-${Date.now()}-${Math.floor(Math.random() * 10000)}.pdf`;
              const targetPath = path.join(UPLOADS_DIR, safeStoredName);
              fs.writeFileSync(targetPath, dataBuffer);

              fileData = {
                fieldname: fieldName,
                originalname: filename,
                filename: safeStoredName,
                path: targetPath,
                size: dataBuffer.length,
                mimetype: 'application/pdf',
              };
            } else {
              body[fieldName] = dataBuffer.toString('utf8');
            }
          }
        }
        start = nextBoundary;
      }

      req.body = { ...(req.body || {}), ...body };
      req.file = fileData;
      next();
    } catch (err) {
      res.status(500).json({ success: false, error: `Upload processing error: ${err.message}` });
    }
  });

  req.on('error', (err) => {
    res.status(500).json({ success: false, error: err.message });
  });
}

module.exports = {
  UPLOADS_DIR,
  handlePdfUpload,
};
