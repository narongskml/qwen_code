const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const db = require('../database/db');
const rustFS = require('../storage/rustfs');
const { validateRequest } = require('../middleware/validation');

// Validation rules for on-demand report generation
const createReportValidator = [
  body('template_id').isUUID().withMessage('Valid template ID is required'),
  body('report_name').notEmpty().withMessage('Report name is required'),
  body('portfolio_id').optional().isUUID(),
  body('format').optional().isIn(['PDF', 'EXCEL', 'CSV']),
  body('view_only').optional().isBoolean(),
  validateRequest,
];

// Validation rules for scheduled reports
const scheduleReportValidator = [
  body('template_id').isUUID().withMessage('Valid template ID is required'),
  body('schedule_name').notEmpty().withMessage('Schedule name is required'),
  body('cron_expression').notEmpty().withMessage('Cron expression is required'),
  body('portfolio_id').optional().isUUID(),
  body('start_date').isISO8601().withMessage('Valid start date is required'),
  body('end_date').optional().isISO8601(),
  body('timezone').optional().default('UTC'),
  body('parameters').optional().isObject(),
  body('recipient_emails').optional(),
  body('enabled').optional().isBoolean(),
  validateRequest,
];

/**
 * @route   GET /api/reports
 * @desc    Get all generated reports
 * @access  Private
 */
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, template_id } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const values = [];
    let paramIndex = 1;

    if (status) {
      values.push(status);
      whereClause += ` AND gr.status = $${paramIndex}`;
      paramIndex++;
    }

    if (template_id) {
      values.push(template_id);
      whereClause += ` AND gr.template_id = $${paramIndex}`;
      paramIndex++;
    }

    const queryText = `
      SELECT 
        gr.report_id,
        gr.report_name,
        gr.generation_date,
        gr.format,
        gr.status,
        gr.file_path,
        gr.object_storage_key,
        gr.storage_location,
        gr.file_size_bytes,
        gr.emailed_to_customer,
        gr.download_count,
        rt.template_name,
        rt.report_type,
        p.portfolio_code,
        c.customer_name,
        u.full_name as generated_by_name
      FROM generated_reports gr
      JOIN report_templates rt ON gr.template_id = rt.template_id
      LEFT JOIN portfolios p ON gr.portfolio_id = p.portfolio_id
      LEFT JOIN customers c ON gr.customer_id = c.customer_id
      LEFT JOIN app_users u ON gr.generated_by = u.user_id
      ${whereClause}
      ORDER BY gr.generation_date DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    values.push(parseInt(limit), offset);

    const result = await db.query(queryText, values);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: result.rows.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/reports/:id/download
 * @desc    Download a report from RustFS
 * @access  Private
 */
router.get('/:id/download', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get report metadata from database
    const result = await db.query(
      'SELECT * FROM generated_reports WHERE report_id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Report not found',
      });
    }

    const report = result.rows[0];

    if (!report.object_storage_key) {
      return res.status(404).json({
        success: false,
        message: 'Report file not found in storage',
      });
    }

    // Download from RustFS
    const fileBuffer = await rustFS.downloadFile(
      report.object_storage_key,
      report.storage_location || 'reports'
    );

    // Increment download count
    await db.query(
      'UPDATE generated_reports SET download_count = download_count + 1 WHERE report_id = $1',
      [id]
    );

    // Set appropriate headers
    res.setHeader('Content-Type', `application/${report.format.toLowerCase()}`);
    res.setHeader('Content-Disposition', `attachment; filename="${report.report_name}.${report.format.toLowerCase()}"`);
    
    res.send(fileBuffer);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/reports/:id/url
 * @desc    Get presigned URL for temporary access to report
 * @access  Private
 */
router.get('/:id/url', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { expiresIn = 3600 } = req.query;

    const result = await db.query(
      'SELECT object_storage_key, storage_location FROM generated_reports WHERE report_id = $1',
      [id]
    );

    if (result.rows.length === 0 || !result.rows[0].object_storage_key) {
      return res.status(404).json({
        success: false,
        message: 'Report not found',
      });
    }

    const presignedUrl = rustFS.generatePresignedUrl(
      result.rows[0].object_storage_key,
      parseInt(expiresIn),
      result.rows[0].storage_location || 'reports'
    );

    res.json({
      success: true,
      data: {
        url: presignedUrl,
        expires_in: parseInt(expiresIn),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/reports/generate
 * @desc    Generate a new report and store in RustFS
 * @access  Private (Maker role)
 */
router.post('/generate', createReportValidator, async (req, res, next) => {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');

    const {
      template_id,
      report_name,
      portfolio_id,
      customer_id,
      format = 'PDF',
      parameters = {},
      period_start,
      period_end,
    } = req.body;

    // Get template details
    const templateResult = await client.query(
      'SELECT * FROM report_templates WHERE template_id = $1 AND active = TRUE',
      [template_id]
    );

    if (templateResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Template not found or inactive',
      });
    }

    const template = templateResult.rows[0];

    // Generate report content (simplified - in real app, use report engine)
    const reportContent = await generateReportContent(template, parameters, format);
    const fileBuffer = Buffer.from(reportContent);

    // Create storage key
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const storageKey = `reports/${portfolio_id || 'general'}/${timestamp}_${report_name}.${format.toLowerCase()}`;

    // Upload to RustFS
    const uploadResult = await rustFS.uploadFile(
      fileBuffer,
      storageKey,
      'reports',
      `application/${format.toLowerCase()}`
    );

    // Save report metadata to database
    const insertResult = await client.query(
      `INSERT INTO generated_reports (
        template_id, report_name, portfolio_id, customer_id,
        report_period_start, report_period_end, parameters,
        file_path, file_size_bytes, storage_location, object_storage_key,
        format, status, generated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        template_id,
        report_name,
        portfolio_id,
        customer_id,
        period_start,
        period_end,
        JSON.stringify(parameters),
        uploadResult.location,
        fileBuffer.length,
        'reports',
        storageKey,
        format,
        'PENDING_APPROVAL',
        req.user?.user_id || null,
      ]
    );

    // Create workflow approval
    await client.query(
      `INSERT INTO workflow_approvals (
        entity_type, entity_id, action_type, maker_id, proposed_data
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING approval_id`,
      ['REPORT', insertResult.rows[0].report_id, 'GENERATE', req.user?.user_id || null, JSON.stringify(insertResult.rows[0])]
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Report generated successfully. Pending approval.',
      data: {
        ...insertResult.rows[0],
        storage: {
          location: uploadResult.location,
          key: storageKey,
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
 * @route   POST /api/reports/:id/approve
 * @desc    Approve a report (Checker role)
 * @access  Private (Checker role)
 */
router.post('/:id/approve', async (req, res, next) => {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const { approval_comments } = req.body;

    // Update report status
    const result = await client.query(
      `UPDATE generated_reports 
       SET status = 'APPROVED', approved_by = $1, approved_at = CURRENT_TIMESTAMP
       WHERE report_id = $2
       RETURNING *`,
      [req.user?.user_id, id]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Report not found',
      });
    }

    // Update workflow approval
    await client.query(
      `UPDATE workflow_approvals 
       SET workflow_status = 'APPROVED', checker_id = $1, 
           checker_action_timestamp = CURRENT_TIMESTAMP, approval_comments = $2
       WHERE entity_type = 'REPORT' AND entity_id = $3`,
      [req.user?.user_id, approval_comments, id]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Report approved successfully',
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
 * @route   DELETE /api/reports/:id
 * @desc    Delete a report from database and RustFS
 * @access  Private (Admin role)
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get report to find storage key
    const result = await db.query(
      'SELECT object_storage_key, storage_location FROM generated_reports WHERE report_id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Report not found',
      });
    }

    const report = result.rows[0];

    // Delete from RustFS
    if (report.object_storage_key) {
      await rustFS.deleteFile(report.object_storage_key, report.storage_location || 'reports');
    }

    // Delete from database
    await db.query('DELETE FROM generated_reports WHERE report_id = $1', [id]);

    res.json({
      success: true,
      message: 'Report deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

// Helper function to generate report content
async function generateReportContent(template, parameters, format) {
  // This is a simplified implementation
  // In production, integrate with JasperReports, BIRT, or custom report generator
  
  const content = {
    template: template.template_name,
    generated_at: new Date().toISOString(),
    parameters,
    data: 'Report data would be generated here based on template and parameters',
  };

  if (format === 'JSON') {
    return JSON.stringify(content, null, 2);
  } else if (format === 'CSV') {
    return 'field1,field2,field3\nvalue1,value2,value3';
  } else {
    // For PDF/Excel, return placeholder HTML or use a library like pdfkit
    return `<html><body><h1>${template.template_name}</h1><p>Generated at: ${content.generated_at}</p></body></html>`;
  }
}

module.exports = router;
