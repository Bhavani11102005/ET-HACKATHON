// Defines what a "Document" record looks like — this stores METADATA about an
// uploaded file (owner, name, status), not the file's actual content/text.
// The actual text extraction/embeddings live in Member 3's ChromaDB, linked via aiDocumentId.
const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema(
  {
    // ObjectId + ref: 'User' creates a reference/link to a User document —
    // like a foreign key in SQL. Lets us later do Document.find().populate('owner')
    // to pull in the full user info if needed.
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    originalName: { type: String, required: true },  // the filename as the user uploaded it, e.g. "manual.pdf"
    storedFileName: { type: String, required: true },  // the randomized filename actually saved on disk (avoids collisions)
    filePath: { type: String, required: true },          // full path where multer saved the file, e.g. /uploads/17...-manual.pdf
    fileType: { type: String, required: true },            // extracted extension without the dot: "pdf", "docx", etc.
    fileSizeBytes: { type: Number, required: true },         // file size, useful for displaying "2.4 MB" in the UI

    // This tracks where the file is in the AI pipeline (set by our own code, not the user)
    processingStatus: {
      type: String,
      enum: ['uploaded', 'processing', 'ready', 'failed'], // only these 4 values are valid
      default: 'uploaded', // every new document starts here
    },

    aiDocumentId: { type: String, default: null }, // ID Member 3's service gives back (e.g. its ChromaDB collection ID)
    summary: { type: String, default: null },        // AI-generated summary, filled in once processing finishes
    keywords: [{ type: String }],                      // array of extracted keywords, e.g. ["pressure valve", "OISD-STD-118"]
    errorMessage: { type: String, default: null },       // if processingStatus becomes 'failed', why it failed
  },
  { timestamps: true } // adds createdAt / updatedAt automatically
);

// A compound index: speeds up our most common query — "get this user's documents,
// newest first" (exactly what listDocuments() in the controller does).
// Without this, MongoDB would have to scan every document in the whole collection.
documentSchema.index({ owner: 1, createdAt: -1 });

module.exports = mongoose.model('Document', documentSchema);
