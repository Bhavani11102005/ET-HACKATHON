// Wires up /api/chat/* URLs to their controller functions.
const express = require('express');
const { protect } = require('../middleware/auth');
const { askQuestion, getHistory, deleteMessage } = require('../controllers/chatController');

const router = express.Router();

router.use(protect); // every chat route requires login — you can't ask questions anonymously

router.post('/query', askQuestion);         // POST /api/chat/query
router.get('/history', getHistory);           // GET /api/chat/history
router.delete('/history/:id', deleteMessage);   // DELETE /api/chat/history/507f1f77...

module.exports = router;
