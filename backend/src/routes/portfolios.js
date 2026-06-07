const express = require('express');
const router = express.Router();
const db = require('../database/db');

// Get all portfolios
router.get('/', async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM v_portfolio_summary ORDER BY created_at DESC');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// Get portfolio by ID
router.get('/:id', async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM portfolios WHERE portfolio_id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Portfolio not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
