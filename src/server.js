require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const pool = require('./db');
const productsRouter = require('./routes/products');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(cors());
app.use(express.json());

// Request logger
app.use((req, _res, next) => {
  const start = Date.now();
  const originalEnd = _res.end;
  _res.end = function (...args) {
    const elapsed = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl} — ${_res.statusCode} (${elapsed}ms)`);
    originalEnd.apply(this, args);
  };
  next();
});

// --- Serve static frontend ---
app.use(express.static(path.join(__dirname, '..', 'public')));

// routes
app.use('/products', productsRouter);

// health check
app.get('/health', async (_req, res) => {
  try {
    const start = Date.now();
    const result = await pool.query('SELECT COUNT(*) AS total FROM products');
    const elapsed = Date.now() - start;

    res.json({
      status: 'ok',
      total_products: parseInt(result.rows[0].total, 10),
      health_query_ms: elapsed,
    });
  } catch (err) {
    res.status(503).json({ status: 'error', message: err.message });
  }
});

//starting the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`API:     http://localhost:${PORT}/products`);
  console.log(`Health:  http://localhost:${PORT}/health`);
});



