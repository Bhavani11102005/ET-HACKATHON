// Loads variables from the .env file (MONGO_URI, JWT_SECRET, etc.) into process.env
// MUST be the very first line — everything below depends on these values existing.
require('dotenv').config();

const express = require('express');           // the web framework — handles HTTP requests/responses
const cors = require('cors');                  // lets our React frontend (different port) call this API
const helmet = require('helmet');               // sets security-related HTTP headers automatically
const morgan = require('morgan');                // logs every incoming request to the console (for debugging)
const rateLimit = require('express-rate-limit');  // blocks an IP if it sends too many requests too fast

const connectDB = require('./config/db');                          // function that opens the MongoDB connection
const { errorHandler, notFound } = require('./middleware/errorHandler'); // our custom error-response handlers

const authRoutes = require('./routes/authRoutes');           // all /api/auth/* endpoints
const documentRoutes = require('./routes/documentRoutes');    // all /api/documents/* endpoints
const chatRoutes = require('./routes/chatRoutes');              // all /api/chat/* endpoints

connectDB(); // actually connect to MongoDB now (this runs once, at server startup)

const app = express(); // create the Express application object — everything attaches to this

// --- Security & core middleware ---
// "Middleware" = a function that runs on EVERY request before it reaches your route handlers.
// They run top-to-bottom in the order you app.use() them.

app.use(helmet()); // adds headers like X-Content-Type-Options to block common attacks

app.use(
  cors({
    origin: process.env.CLIENT_URL || '*', // only allow requests from our React app's URL
    credentials: true,                      // allow the Authorization header / cookies to be sent
  })
);

app.use(express.json({ limit: '10mb' }));        // parses incoming JSON bodies into req.body (max 10mb)
app.use(express.urlencoded({ extended: true })); // parses form-urlencoded bodies too

if (process.env.NODE_ENV !== 'test') app.use(morgan('dev')); // print "GET /api/auth/me 200 12ms" style logs, skip during tests

// Global rate limiter (protects against brute force / abuse)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // the time window: 15 minutes, in milliseconds
  max: 300,                  // max requests allowed per IP within that window
  standardHeaders: true,      // send rate-limit info back in standard RateLimit-* headers
  legacyHeaders: false,        // don't send the old-style X-RateLimit-* headers
});
app.use(globalLimiter); // applies to every route below this line

// Stricter limiter JUST for auth routes (login/register are brute-force targets)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // only 20 login/register attempts per 15 min per IP
  message: { success: false, message: 'Too many auth attempts, try again later' },
});
app.use('/api/auth', authLimiter); // only attaches to paths starting with /api/auth

// --- Routes ---
// Simple health check — hit this to confirm the server is alive (useful for deployment checks)
app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, message: 'API is healthy', timestamp: new Date() });
});

// Mount each route file under its base path.
// e.g. authRoutes has a route "/login" -> becomes reachable at "/api/auth/login"
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/chat', chatRoutes);

// --- Error handling (must be LAST, order matters in Express) ---
app.use(notFound);     // if no route above matched the URL, this sends a clean 404 JSON response
app.use(errorHandler); // if any route called next(err), this catches it and sends a clean error JSON response

const PORT = process.env.PORT || 5000; // use .env PORT, or default to 5000 if not set

app.listen(PORT, () => {
  // this callback runs once the server has actually started listening for connections
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

module.exports = app; // exported so testing tools (e.g. supertest) can import the app without starting a real server
