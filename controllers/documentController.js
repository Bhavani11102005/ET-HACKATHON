// Logic behind all /api/documents/* routes: upload, list, get one, delete, reprocess.
const path = require('path');
const fs = require('fs');       // Node's built-in file-system module — used to delete files from disk
const axios = require('axios'); // HTTP client — used to call Member 3's Python AI service
const Document = require('../models/Document');

// @route POST /api/documents/upload
const uploadDocument = async (req, res, next) => {
  try {
    // By the time we get here, the `upload.single('file')` middleware (multer) has
    // already run, saved the file to disk, and attached its info to req.file.
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    // Save a METADATA record in MongoDB — this is separate from the file itself,
    // which multer already wrote to the /uploads folder on disk.
    const doc = await Document.create({
      owner: req.user._id,                                          // comes from the `protect` middleware
      originalName: req.file.originalname,                            // e.g. "pump_manual.pdf"
      storedFileName: req.file.filename,                                // e.g. "1721234567-983221.pdf" (multer randomized this)
      filePath: req.file.path,                                             // full disk path to the saved file
      fileType: path.extname(req.file.originalname).slice(1).toLowerCase(), // ".pdf" -> "pdf"
      fileSizeBytes: req.file.size,
      processingStatus: 'uploaded', // starting state
    });

    // Kick off AI processing WITHOUT waiting for it (no `await` here) — we don't want
    // the user's upload request to hang for however long chunking/embedding takes.
    // .catch() prevents an unhandled-promise-rejection crash if the AI service is down;
    // we just log a warning instead — the doc stays in 'processing' or flips to 'failed'.
    notifyAIService(doc).catch((err) =>
      console.warn(`AI service notification failed for doc ${doc._id}: ${err.message}`)
    );

    // Respond to the user IMMEDIATELY with the doc record (status: 'uploaded' or 'processing') —
    // frontend can poll GET /documents/:id afterward to watch the status change.
    res.status(201).json({ success: true, document: doc });
  } catch (err) {
    next(err);
  }
};

// Not a route itself — a helper function called by uploadDocument (and reprocessDocument).
// Talks to Member 3's Python service to actually extract text / build embeddings.
const notifyAIService = async (doc) => {
  doc.processingStatus = 'processing';
  await doc.save(); // update MongoDB so anyone polling sees "processing" right away

  try {
    const aiServiceUrl = process.env.AI_SERVICE_URL;
    if (!aiServiceUrl) throw new Error('AI_SERVICE_URL not configured');

    // POST the file's location + metadata to Member 3's /ingest endpoint.
    // We send the file PATH, not the raw file bytes — the AI service reads it directly
    // off disk since it's running on the same machine/network.
    const response = await axios.post(`${aiServiceUrl}/ingest`, {
      documentId: doc._id.toString(),
      filePath: doc.filePath,
      fileType: doc.fileType,
      originalName: doc.originalName,
    });

    // If we get here, the AI service succeeded — save what it gave back.
    doc.processingStatus = 'ready';
    doc.aiDocumentId = response.data?.aiDocumentId || null; // ?. = don't crash if response.data is missing
    doc.summary = response.data?.summary || null;
    doc.keywords = response.data?.keywords || [];
    await doc.save();
  } catch (err) {
    // Network error, AI service crashed, timeout, etc. — mark it failed so the
    // frontend can show "processing failed" instead of spinning forever.
    doc.processingStatus = 'failed';
    doc.errorMessage = err.message;
    await doc.save();
    throw err; // re-throw so the .catch() back in uploadDocument logs it too
  }
};

// @route POST /api/documents/:id/reprocess
// Lets the frontend offer a "Retry" button if a document's processing failed.
const reprocessDocument = async (req, res, next) => {
  try {
    // Note: we filter by BOTH _id AND owner — this stops User A from reprocessing
    // (or even discovering the existence of) User B's documents by guessing IDs.
    const doc = await Document.findOne({ _id: req.params.id, owner: req.user._id });
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });

    notifyAIService(doc).catch((err) =>
      console.warn(`Reprocess failed for doc ${doc._id}: ${err.message}`)
    );

    // 202 = Accepted — "I've started the work, it's not done yet"
    res.status(202).json({ success: true, message: 'Reprocessing started' });
  } catch (err) {
    next(err);
  }
};

// @route GET /api/documents
const listDocuments = async (req, res, next) => {
  try {
    // Pagination: read page/limit from the URL's query string, e.g. ?page=2&limit=10
    // Fall back to sensible defaults if they're missing.
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const docs = await Document.find({ owner: req.user._id }) // only THIS user's documents
      .sort({ createdAt: -1 })                                  // newest first
      .skip((page - 1) * limit)                                   // e.g. page 2 with limit 20 skips the first 20
      .limit(limit);                                                // caps how many come back

    const total = await Document.countDocuments({ owner: req.user._id }); // total count, for frontend pagination UI

    res.status(200).json({
      success: true,
      documents: docs,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }, // e.g. 45 docs / 20 per page = 3 pages
    });
  } catch (err) {
    next(err);
  }
};

// @route GET /api/documents/:id
const getDocument = async (req, res, next) => {
  try {
    const doc = await Document.findOne({ _id: req.params.id, owner: req.user._id });
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });
    res.status(200).json({ success: true, document: doc });
  } catch (err) {
    next(err);
  }
};

// @route DELETE /api/documents/:id
const deleteDocument = async (req, res, next) => {
  try {
    const doc = await Document.findOne({ _id: req.params.id, owner: req.user._id });
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });

    // Delete the actual file from disk first...
    if (fs.existsSync(doc.filePath)) fs.unlinkSync(doc.filePath);
    // ...then delete the metadata record from MongoDB. If we only deleted the
    // DB record, the file would sit on disk forever taking up space with no reference to it.
    await doc.deleteOne();

    res.status(200).json({ success: true, message: 'Document deleted' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  uploadDocument,
  listDocuments,
  getDocument,
  deleteDocument,
  reprocessDocument,
};
