// Small reusable middleware — pairs with express-validator's `body()` checks
// (used in authRoutes.js). Those checks don't reject requests by themselves —
// they just COLLECT errors. This middleware is what actually looks at those
// collected errors and stops the request if any exist.
const { validationResult } = require('express-validator');

const validate = (req, res, next) => {
  const errors = validationResult(req); // gathers whatever the body() checks found

  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      // Reshape express-validator's verbose error objects into something simple
      // for the frontend to loop over and show next to each form field.
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }

  next(); // no errors -> let the request continue to the actual route handler
};

module.exports = validate;
