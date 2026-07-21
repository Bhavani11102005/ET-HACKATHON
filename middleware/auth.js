// This middleware is the "bouncer" — it runs before any protected route and checks:
// "does this request have a valid JWT proving who the user is?"
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  // The frontend is expected to send the token like this:
  // Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    // "Bearer <token>" -> split on the space -> take the part after it
    token = authHeader.split(' ')[1];
  }

  // No header at all, or wrong format -> reject immediately, don't even touch the DB
  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token provided' });
  }

  try {
    // Verifies the token's signature using our JWT_SECRET, AND checks it hasn't expired.
    // If someone tampered with the token or it's expired, this THROWS an error
    // (caught below) — it does not return null silently.
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // decoded.id is the user's Mongo _id that we embedded when we signed the token at login.
    // We look the user up fresh from the DB (rather than trusting the token blindly) in
    // case the account was deleted after the token was issued.
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ success: false, message: 'User no longer exists' });
    }

    // Attach the found user onto the request object — every route handler AFTER
    // this middleware can now read `req.user` to know who's making the request.
    req.user = user;

    next(); // pass control to whatever route handler comes next
  } catch (err) {
    // jwt.verify throws here if the token is malformed, tampered with, or expired
    return res.status(401).json({ success: false, message: 'Not authorized, token invalid or expired' });
  }
};

// A second layer, for routes that need role-checking on top of "logged in".
// Usage: router.delete('/something', protect, authorize('admin'), handler)
// (Not currently wired into any route, but here if you need an admin-only endpoint.)
const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Forbidden: insufficient permissions' });
  }
  next();
};

module.exports = { protect, authorize };
