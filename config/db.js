// This file's only job: open a connection to MongoDB using Mongoose (an ODM —
// Object Data Modeling library — that lets us define schemas/models instead of
// writing raw MongoDB queries everywhere).
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // mongoose.connect returns a promise — we await it so we know connection succeeded
    // before the server starts accepting requests. MONGO_URI comes from .env, e.g.
    // "mongodb://localhost:27017/iki_platform" or an Atlas connection string.
    const conn = await mongoose.connect(process.env.MONGO_URI);

    // conn.connection.host tells us which MongoDB host we actually connected to —
    // useful to confirm you're hitting the right database (local vs Atlas).
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (err) {
    // If the URI is wrong, MongoDB is down, or credentials fail, we land here.
    console.error(`MongoDB connection error: ${err.message}`);

    // No point running a server that can't reach its database — exit immediately
    // with a non-zero code so process managers (e.g. PM2, Docker) know it failed.
    process.exit(1);
  }
};

module.exports = connectDB;
