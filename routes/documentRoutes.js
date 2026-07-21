// Wires up /api/documents/* URLs to their controller functions.
const express = require('express');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload'); // multer config from middleware/upload.js
const {
  uploadDocument,
  listDocuments,
  getDocument,
  deleteDocument,
  reprocessDocument,
} = require('../controllers/documentController');

const router = express.Router();

// router.use() with no path applies this middleware to EVERY route defined
// below it in this file — so all document routes require a valid login,
// without us having to repeat `protect` on each individual line.
router.use(protect);

// upload.single('file') runs BEFORE uploadDocument — it parses the multipart
// form data, saves the file to disk, and attaches info to req.file.
// 'file' must exactly match the field name the frontend's <form> or FormData uses.
router.post('/upload', upload.single('file'), uploadDocument);

router.get('/', listDocuments);           // GET /api/documents
router.get('/:id', getDocument);            // GET /api/documents/507f1f77...  (:id becomes req.params.id)
router.delete('/:id', deleteDocument);        // DELETE /api/documents/507f1f77...
router.post('/:id/reprocess', reprocessDocument); // POST /api/documents/507f1f77.../reprocess

module.exports = router;
