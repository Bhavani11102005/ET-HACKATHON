// Defines WHICH URLs exist under /api/auth and what runs for each — the actual
// logic lives in authController.js; this file just wires URL -> validation -> handler.
const express = require('express');
const { body } = require('express-validator'); // lets us declare per-field validation rules
const { register, login, getMe } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router(); // a mini, self-contained set of routes we'll mount in server.js

router.post(
  '/register', // full path becomes /api/auth/register once mounted
  [
    // Each of these checks req.body's fields and queues up an error if it fails —
    // doesn't stop the request by itself, that's what `validate` (next in the chain) does.
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  validate,  // checks the results of the array above; rejects with 400 if anything failed
  register   // only reached if validation passed
);

router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validate,
  login
);

// `protect` runs first here — if there's no valid token, getMe never even executes
router.get('/me', protect, getMe);

module.exports = router;
