const { getMessageFileForUser } = require('../models/messagesModel');

async function downloadFile(req, res) {
  try {
    const userId = Number(req.user.id);
    const messageId = Number(req.params.id);

    const row = await getMessageFileForUser(messageId, userId);
    if (!row || !row.file_data) {
      return res.status(404).json({ message: 'Archivo no encontrado' });
    }

    const fileName = row.file_name || `archivo_${messageId}`;
    const mime = row.file_mime || 'application/octet-stream';

    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    return res.send(row.file_data);
  } catch (error) {
    return res.status(500).json({ message: 'Error al descargar archivo', error: error.message });
  }
}

module.exports = {
  downloadFile,
};
