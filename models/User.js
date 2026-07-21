// Defines what a "User" document looks like in MongoDB, plus two behaviors:
// auto-hashing the password before save, and comparing a login attempt against it.
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // library for one-way hashing passwords (never store plaintext!)

const userSchema = new mongoose.Schema(
  {
    // Each field below defines: type, and any rules Mongoose should enforce.
    name: { type: String, required: true, trim: true }, // trim = auto-remove leading/trailing whitespace

    email: {
      type: String,
      required: true,
      unique: true,     // MongoDB will reject a second user with the same email
      lowercase: true,   // auto-converts to lowercase so "A@B.com" and "a@b.com" are treated as the same
      trim: true,
    },

    // select: false means this field is EXCLUDED from query results by default —
    // so a normal `User.find()` will never accidentally leak password hashes to the client.
    // We only include it explicitly when we need to check a login (see authController).
    password: { type: String, required: true, minlength: 6, select: false },

    role: { type: String, enum: ['user', 'admin'], default: 'user' }, // enum = only these 2 values allowed
  },
  { timestamps: true } // auto-adds createdAt and updatedAt fields to every document
);

// A Mongoose "pre-save hook" — this function runs automatically right before
// any User document is saved to the database (on both create and update).
userSchema.pre('save', async function (next) {
  // isModified checks if the password field specifically changed in this save.
  // Without this check, we'd re-hash an ALREADY-hashed password every time the
  // user updates their name, email, etc. — which would break their login.
  if (!this.isModified('password')) return next();

  const salt = await bcrypt.genSalt(10); // generates random data mixed into the hash (defeats rainbow-table attacks)
  this.password = await bcrypt.hash(this.password, salt); // replace plaintext password with its hash
  next(); // tell Mongoose "done, continue with the actual save"
});

// Instance method — callable on any user document as `user.comparePassword(...)`.
// Used during login to check "does this typed-in password match the stored hash?"
userSchema.methods.comparePassword = async function (candidatePassword) {
  // bcrypt.compare hashes candidatePassword the same way and checks if it matches —
  // you can NEVER "un-hash" a password, only re-hash and compare.
  return bcrypt.compare(candidatePassword, this.password);
};

// Turns the schema into a usable Model — this is what we import elsewhere as `User`
// and call User.create(), User.findOne(), etc. on. Mongoose auto-pluralizes
// 'User' -> the MongoDB collection is actually named "users".
module.exports = mongoose.model('User', userSchema);
