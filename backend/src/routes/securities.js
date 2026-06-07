const express = require('express');
const router = express.Router();
const db = require('../database/db');

// Get all securities
router.get('/', async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM securities WHERE active = TRUE ORDER BY symbol');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
