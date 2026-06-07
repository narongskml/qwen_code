const express = require('express');
const router = express.Router();
const db = require('../database/db');

// Get all trades
router.get('/', async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM v_trade_summary ORDER BY trade_date DESC LIMIT 100');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
