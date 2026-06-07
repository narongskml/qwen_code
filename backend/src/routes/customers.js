const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const db = require('../database/db');
const { validateRequest } = require('../middleware/validation');

// Validation rules
const createCustomerValidator = [
  body('customer_code').notEmpty().withMessage('Customer code is required'),
  body('customer_name').notEmpty().withMessage('Customer name is required'),
  body('customer_type').isIn(['INDIVIDUAL', 'CORPORATE', 'INSTITUTIONAL']).withMessage('Invalid customer type'),
  body('email').isEmail().withMessage('Invalid email address'),
  validateRequest,
];

const updateCustomerValidator = [
  param('id').isUUID().withMessage('Invalid customer ID'),
  body('customer_name').optional().notEmpty(),
  body('email').optional().isEmail(),
  validateRequest,
];

/**
 * @route   GET /api/customers
 * @desc    Get all customers with pagination and filtering
 * @access  Private (Maker, Checker, Admin)
 */
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, type, status } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const values = [];
    let paramIndex = 1;

    if (search) {
      values.push(`%${search}%`);
      whereClause += ` AND (customer_name ILIKE $${paramIndex} OR customer_code ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`;
      paramIndex++;
    }

    if (type) {
      values.push(type);
      whereClause += ` AND customer_type = $${paramIndex}`;
      paramIndex++;
    }

    const queryText = `
      SELECT 
        customer_id,
        customer_code,
        customer_name,
        customer_type,
        email,
        phone,
        city,
        country,
        risk_profile,
        kyc_status,
        registration_date,
        created_at
      FROM customers
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    values.push(parseInt(limit), offset);

    const result = await db.query(queryText, values);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM customers
      ${whereClause}
    `;
    
    const countResult = await db.query(countQuery, values.slice(0, paramIndex));
    const total = parseInt(countResult.rows[0].total);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/customers/:id
 * @desc    Get customer by ID
 * @access  Private
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'SELECT * FROM customers WHERE customer_id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/customers
 * @desc    Create a new customer
 * @access  Private (Maker role)
 */
router.post('/', createCustomerValidator, async (req, res, next) => {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');

    const {
      customer_code,
      customer_name,
      customer_type,
      email,
      phone,
      address,
      city,
      country,
      postal_code,
      tax_id,
      risk_profile,
      notes,
    } = req.body;

    // Check if customer_code already exists
    const existingCode = await client.query(
      'SELECT customer_id FROM customers WHERE customer_code = $1',
      [customer_code]
    );

    if (existingCode.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Customer code already exists',
      });
    }

    const result = await client.query(
      `INSERT INTO customers (
        customer_code, customer_name, customer_type, email, phone,
        address, city, country, postal_code, tax_id, risk_profile, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        customer_code,
        customer_name,
        customer_type,
        email,
        phone,
        address,
        city,
        country,
        postal_code,
        tax_id,
        risk_profile || 'MEDIUM',
        notes,
      ]
    );

    // Create workflow approval record for maker-checker
    const workflowResult = await client.query(
      `INSERT INTO workflow_approvals (
        entity_type, entity_id, action_type, maker_id, proposed_data
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING approval_id`,
      ['CUSTOMER', result.rows[0].customer_id, 'CREATE', req.user?.user_id || null, JSON.stringify(result.rows[0])]
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Customer created successfully. Pending approval.',
      data: {
        ...result.rows[0],
        workflow: {
          approval_id: workflowResult.rows[0].approval_id,
          status: 'PENDING_APPROVAL',
        },
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

/**
 * @route   PUT /api/customers/:id
 * @desc    Update customer
 * @access  Private (Maker role)
 */
router.put('/:id', updateCustomerValidator, async (req, res, next) => {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const allowedFields = [
      'customer_name', 'email', 'phone', 'address', 'city',
      'country', 'postal_code', 'tax_id', 'risk_profile', 'notes'
    ];

    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramIndex = 1;

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${paramIndex}`);
        values.push(req.body[field]);
        paramIndex++;
      }
    });

    if (updates.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update',
      });
    }

    values.push(id);
    
    // Get current data for workflow
    const currentData = await client.query(
      'SELECT * FROM customers WHERE customer_id = $1',
      [id]
    );

    if (currentData.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
    }

    const result = await client.query(
      `UPDATE customers 
       SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE customer_id = $${paramIndex}
       RETURNING *`,
      values
    );

    // Create workflow approval
    await client.query(
      `INSERT INTO workflow_approvals (
        entity_type, entity_id, action_type, maker_id, original_data, proposed_data
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING approval_id`,
      [
        'CUSTOMER',
        id,
        'UPDATE',
        req.user?.user_id || null,
        JSON.stringify(currentData.rows[0]),
        JSON.stringify(result.rows[0]),
      ]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Customer updated successfully. Pending approval.',
      data: result.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

/**
 * @route   DELETE /api/customers/:id
 * @desc    Delete customer (soft delete via status change)
 * @access  Private (Checker/Admin role)
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `UPDATE customers 
       SET status = 'CLOSED', updated_at = CURRENT_TIMESTAMP
       WHERE customer_id = $1
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
    }

    res.json({
      success: true,
      message: 'Customer deleted successfully',
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
