/**
 * Seed script — bulk-inserts 200,000 products into the database.
 *
 * Uses batched multi-row INSERT statements (5,000 rows per batch)
 * inside a single transaction for maximum speed.
 *
 * Usage:
 *   node scripts/seed.js
 */
require('dotenv').config();
const pool = require('../src/db');
const { faker } = require('@faker-js/faker');

const TOTAL_PRODUCTS = 200_000;
const BATCH_SIZE = 5_000;

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
 * Generate a random date within the past 2 years.
 */
function randomDate() {
  const now = Date.now();
  const twoYearsAgo = now - 2 * 365 * 24 * 60 * 60 * 1000;
  const randomMs = twoYearsAgo + Math.random() * (now - twoYearsAgo);
  return new Date(randomMs).toISOString();
}

/**
 * Generate a random price between min and max (2 decimal places).
 */
function randomPrice(min = 1.99, max = 999.99) {
  return (Math.random() * (max - min) + min).toFixed(2);
}

async function seed() {
  const client = await pool.connect();
  const overallStart = Date.now();

  try {
    // Check if data already exists
    const existing = await client.query('SELECT COUNT(*) AS cnt FROM products');
    const count = parseInt(existing.rows[0].cnt, 10);

    if (count > 0) {
      console.log(`⚠️  Table already has ${count.toLocaleString()} rows.`);
      console.log('   Truncating and re-seeding...\n');
      await client.query('TRUNCATE TABLE products RESTART IDENTITY');
    }

    console.log(`🌱 Seeding ${TOTAL_PRODUCTS.toLocaleString()} products in batches of ${BATCH_SIZE.toLocaleString()}...\n`);

    await client.query('BEGIN');

    for (let offset = 0; offset < TOTAL_PRODUCTS; offset += BATCH_SIZE) {
      const batchStart = Date.now();
      const currentBatchSize = Math.min(BATCH_SIZE, TOTAL_PRODUCTS - offset);

      // Build the multi-row VALUES clause
      const values = [];
      const placeholders = [];

      for (let i = 0; i < currentBatchSize; i++) {
        const idx = i * 5; // 5 columns per row
        placeholders.push(
          `($${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4}, $${idx + 5})`
        );
        values.push(
          faker.commerce.productName(),
          faker.commerce.productDescription(),
          CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)],
          randomPrice(),
          randomDate()
        );
      }

      const query = `
        INSERT INTO products (name, description, category, price, created_at)
        VALUES ${placeholders.join(', ')}
      `;

      await client.query(query, values);

      const batchElapsed = Date.now() - batchStart;
      const inserted = offset + currentBatchSize;
      const pct = ((inserted / TOTAL_PRODUCTS) * 100).toFixed(1);
      console.log(
        `  📦 ${inserted.toLocaleString()} / ${TOTAL_PRODUCTS.toLocaleString()} (${pct}%) — batch took ${batchElapsed}ms`
      );
    }

    await client.query('COMMIT');

    const totalElapsed = ((Date.now() - overallStart) / 1000).toFixed(2);
    console.log(`\n🎉 Seeding complete! ${TOTAL_PRODUCTS.toLocaleString()} products in ${totalElapsed}s`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
