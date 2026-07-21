// Logic behind all /api/chat/* routes — asking questions and reading history.
const axios = require('axios');
const ChatMessage = require('../models/ChatMessage');
const Document = require('../models/Document');

// @route POST /api/chat/query
// body: { question: string, documentId?: string }
const askQuestion = async (req, res, next) => {
  try {
    const { question, documentId } = req.body;

    // .trim() catches the case where someone sends "   " (just whitespace) as a "question"
    if (!question || !question.trim()) {
      return res.status(400).json({ success: false, message: 'Question is required' });
    }

    // If the frontend scoped this question to one specific document, validate it BEFORE
    // wasting an API call to the AI service.
    if (documentId) {
      // Again: filtering by owner too, so users can only query their own documents.
      const doc = await Document.findOne({ _id: documentId, owner: req.user._id });
      if (!doc) {
        return res.status(404).json({ success: false, message: 'Document not found' });
      }
      if (doc.processingStatus !== 'ready') {
        // 409 = Conflict — the request is valid but the resource isn't in the right state yet
        return res.status(409).json({
          success: false,
          message: `Document is not ready for querying yet (status: ${doc.processingStatus})`,
        });
      }
    }

    const aiServiceUrl = process.env.AI_SERVICE_URL;
    if (!aiServiceUrl) {
      return res.status(500).json({ success: false, message: 'AI service is not configured' });
    }

    let aiResponse;
    try {
      // Forward the question to Member 3's Python RAG service. This call IS awaited
      // (unlike document upload) because the user is sitting there waiting for an answer.
      const { data } = await axios.post(`${aiServiceUrl}/query`, {
        userId: req.user._id.toString(),
        question,
        documentId: documentId || null, // null tells the AI service "search across everything"
      });
      aiResponse = data;
    } catch (err) {
      // 502 = Bad Gateway — the right code for "the service I depend on failed",
      // as opposed to 500 which implies OUR code broke.
      return res.status(502).json({
        success: false,
        message: 'AI service is unreachable or returned an error',
        detail: err.message,
      });
    }

    // Save the full exchange — question, answer, citations — so it shows up in
    // chat history later and survives a page refresh / new session.
    const chatMessage = await ChatMessage.create({
      owner: req.user._id,
      documentId: documentId || null,
      question,
      answer: aiResponse.answer,
      citations: aiResponse.citations || [],           // default to empty array if AI service sends none
      confidenceScore: aiResponse.confidenceScore ?? null, // ?? = only fall back if it's null/undefined, not if it's 0
    });

    res.status(200).json({ success: true, message: chatMessage });
  } catch (err) {
    next(err);
  }
};

// @route GET /api/chat/history
// optional query: ?documentId=...
const getHistory = async (req, res, next) => {
  try {
    const { documentId } = req.query;

    const filter = { owner: req.user._id }; // always scoped to the logged-in user
    if (documentId) filter.documentId = documentId; // narrow further if frontend asked for one doc's thread

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;

    const messages = await ChatMessage.find(filter)
      .sort({ createdAt: 1 })  // ascending (oldest first) — reads top-to-bottom like a real chat thread
      .skip((page - 1) * limit)
      .limit(limit);

    res.status(200).json({ success: true, messages });
  } catch (err) {
    next(err);
  }
};

// @route DELETE /api/chat/history/:id
const deleteMessage = async (req, res, next) => {
  try {
    const msg = await ChatMessage.findOne({ _id: req.params.id, owner: req.user._id });
    if (!msg) return res.status(404).json({ success: false, message: 'Message not found' });
    await msg.deleteOne();
    res.status(200).json({ success: true, message: 'Deleted' });
  } catch (err) {
    next(err);
  }
};

module.exports = { askQuestion, getHistory, deleteMessage };
