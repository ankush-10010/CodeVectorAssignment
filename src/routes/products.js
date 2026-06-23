const { Router } = require('express');
const pool = require('../db');
const { encodeCursor, decodeCursor } = require('../utils/cursor');

const router = Router();

// Allowed categories — used for validation
const CATEGORIES = [
  'Electronics',
  'Clothing',
  'Home & Garden',
  'Books',
  'Sports',
  'Toys',
  'Food',
  'Health',
  'Automotive',
  'Music',
];

/**
 * GET /products
 *
 * Query params:
 *   limit    — items per page, 1–100, default 50
 *   category — optional category filter
 *   cursor   — opaque cursor for the next page
 *
 * Response:
 *   { data: [...], pagination: { limit, has_next, next_cursor? } }
 */
router.get('/', async (req, res) => {
  const startTime = Date.now();

  try {
    // parse and validation of limits
    let limit = parseInt(req.query.limit, 10);
    if (isNaN(limit)) limit = 50;
    if (limit < 1 || limit > 100) {
      return res.status(400).json({
        error: 'limit must be between 1 and 100',
      });
    }

    // parse and validation of category
    const category = req.query.category || null;
    if (category && !CATEGORIES.includes(category)) {
      return res.status(400).json({
        error: `Invalid category. Must be one of: ${CATEGORIES.join(', ')}`,
      });
    }

    // parse and validation of cursor
    let cursorData = null;
    if (req.query.cursor) {
      try {
        cursorData = decodeCursor(req.query.cursor);
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }
    }

    // query
    // Fetch limit + 1 to determine if there's a next page
    const fetchLimit = limit + 1;
    let query;
    let params;

    if (cursorData) { 
      if (category) {
        query = `
          SELECT id, name, description, category, price, created_at
          FROM products
          WHERE category = $1
            AND (created_at, id) < ($2, $3)
          ORDER BY created_at DESC, id DESC
          LIMIT $4
        `;
        params = [category, cursorData.createdAt, cursorData.id, fetchLimit];
      } else {
        query = `
          SELECT id, name, description, category, price, created_at
          FROM products
          WHERE (created_at, id) < ($1, $2)
          ORDER BY created_at DESC, id DESC
          LIMIT $3
        `;
        params = [cursorData.createdAt, cursorData.id, fetchLimit];
      }
    } else {
      if (category) {
        query = `
          SELECT id, name, description, category, price, created_at
          FROM products
          WHERE category = $1
          ORDER BY created_at DESC, id DESC
          LIMIT $2
        `;
        params = [category, fetchLimit];
      } else {
        query = `
          SELECT id, name, description, category, price, created_at
          FROM products
          ORDER BY created_at DESC, id DESC
          LIMIT $1
        `;
        params = [fetchLimit];
      }
    }

    // execute
    const result = await pool.query(query, params);
    const rows = result.rows;

    // next page
    const hasNext = rows.length > limit;
    const data = hasNext ? rows.slice(0, limit) : rows;

    // next cursor
    let nextCursor = null;
    if (hasNext && data.length > 0) {
      const lastRow = data[data.length - 1];
      nextCursor = encodeCursor(lastRow.created_at, lastRow.id);
    }

    const elapsed = Date.now() - startTime;

    return res.json({
      data,
      pagination: {
        limit,
        has_next: hasNext,
        ...(nextCursor && { next_cursor: nextCursor }),
      },
      meta: {
        query_time_ms: elapsed,
      },
    });
  } catch (err) {
    console.error('Error fetching products:', err);
    return res.status(503).json({
      error: 'Database error. Please try again later.',
    });
  }
});

/**
 * GET /products/categories
 * Returns the list of valid categories.
 */
router.get('/categories', (_req, res) => {
  res.json({ categories: CATEGORIES });
});


router.post('/simulate', async (_req, res) => {
  try {
    const { faker } = require('@faker-js/faker');
    const placeholders = [];
    const values = [];

    for (let i = 0; i < 50; i++) {
      const idx = i * 4;
      placeholders.push(`($${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4}, NOW())`);
      values.push(
        `[NEW] ${faker.commerce.productName()}`,
        faker.commerce.productDescription(),
        CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)],
        (Math.random() * 998 + 1).toFixed(2)
      );
    }

    const query = `
      INSERT INTO products (name, description, category, price, created_at)
      VALUES ${placeholders.join(', ')}
    `;

    await pool.query(query, values);
    res.json({ success: true, message: '50 new products injected successfully.' });
  } catch (err) {
    console.error('Simulate error:', err);
    res.status(500).json({ error: 'Failed to inject products' });
  }
});


router.delete('/simulate', async (_req, res) => {
  try {
    const result = await pool.query("DELETE FROM products WHERE name LIKE '[NEW] %'");
    res.json({ success: true, deletedCount: result.rowCount });
  } catch (err) {
    console.error('Delete simulate error:', err);
    res.status(500).json({ error: 'Failed to delete simulated products' });
  }
});

module.exports = router;




