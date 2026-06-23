/**
 * Migration script — creates the products table and composite indexes.
 *
 * Usage:
 *   node scripts/migrate.js
 */
require('dotenv').config();
const pool = require('../src/db');

async function migrate() {
  const client = await pool.connect();

  try {
    console.log('🔧 Running migration...\n');

    // Create the products table
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id            SERIAL PRIMARY KEY,
        name          VARCHAR(255) NOT NULL,
        description   TEXT,
        category      VARCHAR(100) NOT NULL,
        price         NUMERIC(10, 2) NOT NULL,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log('✅ Table "products" created (or already exists).');

    // Composite index for default browse (newest first)
    // This lets cursor pagination do an index-only scan instead of a full table scan.
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_products_created_id
        ON products (created_at DESC, id DESC);
    `);
    console.log('✅ Index "idx_products_created_id" created.');

    // Composite index for category-filtered browse
    // Covers WHERE category = $1 AND (created_at, id) < (...) queries.
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_products_category_created_id
        ON products (category, created_at DESC, id DESC);
    `);
    console.log('✅ Index "idx_products_category_created_id" created.');

    console.log('\n🎉 Migration complete!');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
