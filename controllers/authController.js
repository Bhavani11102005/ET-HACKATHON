// The actual logic behind /api/auth/register, /login, /me.
// Routes files just say "when this URL is hit, call this function" — this is where the work happens.
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Small helper — turns a user's Mongo _id into a signed JWT string.
// The token itself just contains { id: "..." } plus an expiry — no password, no sensitive data.
const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d', // token stops working after this long, forcing re-login
  });

// @route POST /api/auth/register
const register = async (req, res, next) => {
  try {
    // req.body was parsed by express.json() middleware back in server.js
    const { name, email, password } = req.body;

    // Check if someone already registered with this email before we bother creating anything
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Email already registered' }); // 409 = Conflict
    }

    // User.create() triggers our pre('save') hook in the model, which hashes the password
    // automatically — we never touch bcrypt directly here.
    const user = await User.create({ name, email, password });

    const token = signToken(user._id); // immediately log them in after registering — no separate login step needed

    res.status(201).json({ // 201 = Created
      success: true,
      token,
      // Only send back safe fields — never the password hash, even though it's hashed
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    next(err); // hand off to errorHandler middleware (e.g. handles Mongoose validation errors)
  }
};

// @route POST /api/auth/login
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Remember password has `select: false` in the schema — so we MUST explicitly
    // request it here with .select('+password'), or user.password would be undefined.
    const user = await User.findOne({ email }).select('+password');

    // Combined check: either the email doesn't exist, OR the password doesn't match.
    // We deliberately give the SAME error message for both cases — if we said
    // "email not found" vs "wrong password" separately, an attacker could use that
    // to figure out which emails are registered (an information leak).
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const token = signToken(user._id);

    res.status(200).json({
      success: true,
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    next(err);
  }
};

// @route GET /api/auth/me
// This route runs AFTER the `protect` middleware, so req.user is already populated —
// this handler's only job is to shape the response.
const getMe = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, getMe };
