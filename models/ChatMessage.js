// Defines a single Q&A exchange in the chat history — one document per question asked.
const mongoose = require('mongoose');

// A "sub-schema" — not its own collection, just the shape of objects that live
// INSIDE a chat message's citations array. { _id: false } stops Mongoose from
// generating a wasted unique ID for each tiny citation object.
const citationSchema = new mongoose.Schema(
  {
    documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' }, // which doc this citation came from
    documentName: String,   // display name, so frontend doesn't need a second lookup just to show "manual.pdf"
    snippet: String,          // the actual quoted/relevant text the answer was based on
    page: Number,               // page number in the source document, if applicable
    confidence: Number,           // how confident the AI is that this citation is relevant (0 to 1)
  },
  { _id: false }
);

const chatMessageSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // who asked the question

    // null = the question was asked across the WHOLE document corpus (not scoped to one file).
    // If set, it's a question about one specific document.
    documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', default: null },

    question: { type: String, required: true }, // what the user typed
    answer: { type: String, required: true },     // what the AI responded

    citations: [citationSchema], // array of citation objects (defined above) backing up the answer

    confidenceScore: { type: Number, default: null }, // overall confidence for the whole answer, 0 to 1
  },
  { timestamps: true } // createdAt is what we use to order the conversation chronologically
);

// Speeds up "get this user's chat history, in order" — our most common chat query.
chatMessageSchema.index({ owner: 1, createdAt: -1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
