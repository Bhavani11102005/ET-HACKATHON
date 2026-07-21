// Configures multer — the library that actually receives file uploads over HTTP
// and saves them to disk. This file only sets up the RULES; the actual saving
// happens automatically when a route uses `upload.single('file')`.
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Where uploaded files physically live on the server's disk
const uploadDir = path.join(__dirname, '..', 'uploads');

// Create the folder if it doesn't exist yet (fresh clone of the repo won't have it,
// since it's gitignored)
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// diskStorage = "save the raw file to a folder on disk" (the alternative,
// memoryStorage, would hold the whole file in RAM — bad for large files)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir), // cb = callback: (error, value)

  filename: (req, file, cb) => {
    // We can't just use file.originalname — two users uploading "report.pdf" would
    // overwrite each other. So we prefix with a timestamp + random number.
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname); // keep the original extension, e.g. ".pdf"
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

// Only these file types are allowed — matches what the hackathon brief asks for
const allowedTypes = ['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt'];

// Runs BEFORE the file is fully saved — rejects it early if the extension isn't allowed
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedTypes.includes(ext)) {
    cb(null, true); // true = accept the file
  } else {
    // Passing an Error here makes multer reject the upload; our errorHandler
    // middleware (via the MulterError check) turns this into a clean 400 response
    cb(new Error(`Unsupported file type: ${ext}. Allowed: ${allowedTypes.join(', ')}`));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 25 * 1024 * 1024 }, // reject anything over 25 MB (in bytes: 25 * 1024 * 1024)
});

// Exported as a ready-to-use middleware — routes call upload.single('file')
// where 'file' must match the form-data field name the frontend sends.
module.exports = upload;
