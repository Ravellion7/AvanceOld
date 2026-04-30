const fs = require('fs');
const path = require('path');

const { getMessageFileForUser } = require('../models/messagesModel');

const projectRoot = path.resolve(__dirname, '..', '..', '..');
const uploadsDir = path.join(projectRoot, 'Images', 'uploads');

function resolveUploadPath(fileUrl) {
  const normalizedUrl = String(fileUrl || '').replace(/^\/+/, '');
  if (!normalizedUrl) {
    return null;
  }

  const absolutePath = path.resolve(projectRoot, normalizedUrl);
  const normalizedUploads = path.resolve(uploadsDir);

  if (!absolutePath.startsWith(normalizedUploads + path.sep) && absolutePath !== normalizedUploads) {
    return null;
  }

  return absolutePath;
}

async function downloadFile(req, res) {
  try {
    const userId = Number(req.user.id);
    const messageId = Number(req.params.id);

    const row = await getMessageFileForUser(messageId, userId);
    const absolutePath = row ? resolveUploadPath(row.file_url) : null;

    if (!row || !absolutePath || !fs.existsSync(absolutePath)) {
      return res.status(404).json({ message: 'Archivo no encontrado' });
    }

    const fileName = row.file_name || `archivo_${messageId}`;
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    return res.sendFile(absolutePath);
  } catch (error) {
    return res.status(500).json({ message: 'Error al descargar archivo', error: error.message });
  }
}

module.exports = {
  downloadFile,
};
