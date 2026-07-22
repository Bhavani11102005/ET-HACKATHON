// A "4-argument" Express function (err, req, res, next) is automatically treated
// as ERROR-handling middleware — Express routes any error passed to next(err)
// straight here, skipping all normal middleware in between.
const errorHandler = (err, req, res, next) => {
  console.error(err.stack); // full stack trace goes to OUR server logs (never to the client — that'd leak internals)

  // Mongoose throws this when you pass a malformed ID, e.g. GET /documents/not-a-real-id
  if (err.name === 'CastError') {
    return res.status(400).json({ success: false, message: 'Invalid ID format' });
  }

  // MongoDB's error code for violating a `unique: true` field (e.g. duplicate email)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0]; // figure out WHICH field caused the clash
    return res.status(409).json({ success: false, message: `${field} already in use` });
  }

  // Mongoose schema validation failures (e.g. password too short) that slipped
  // past express-validator, or came from a direct model call
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ success: false, message: messages.join(', ') });
  }

  // File-upload-specific errors from multer (wrong file type, file too large, etc.)
  if (err.name === 'MulterError') {
    return res.status(400).json({ success: false, message: err.message });
  }

  // Fallback for anything we didn't specifically handle above —
  // use the error's own status code if it set one, otherwise default to 500
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Server error',
  });
};

// Runs only if a request's URL didn't match ANY route we defined —
// placed right before errorHandler in server.js
const notFound = (req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.originalUrl}` });
};

module.exports = { errorHandler, notFound };
