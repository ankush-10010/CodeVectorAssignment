# Product Listing API

A high-performance REST API serving 200,000+ products with **cursor-based pagination** that handles real-time data changes without duplicates or missed items.

## Live Demo

- **Frontend:** [https://code-vector-assignment-one.vercel.app/](https://code-vector-assignment-one.vercel.app/)
- **API (Products):** `https://codevectorassignment-3uda.onrender.com/products`
- **API (Health):** `https://codevectorassignment-3uda.onrender.com/health`


## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js (v20+) |
| Framework | Express.js |
| Database | PostgreSQL (Neon.tech) |
| Query Driver | `pg` (node-postgres) |

## Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/your-username/codevector-products-api.git
cd codevector-products-api
npm install
```

### 2. Configure Database

Create a free PostgreSQL database on [neon.tech](https://neon.tech) and add your connection string to `.env`:

```
DATABASE_URL=postgresql://user:pass@host/dbname?sslmode=require
PORT=3000
```

### 3. Run Migration

```bash
npm run migrate
```

This creates the `products` table and two composite indexes.

### 4. Seed 200,000 Products

```bash
npm run seed
```

Uses batched multi-row inserts (5,000 per batch) — completes in ~10 seconds instead of minutes.

### 5. Start the Server

```bash
npm run dev    # development (auto-restart on changes)
npm start      # production
```

Visit `http://localhost:3000` for the frontend, or hit the API directly using POSTMAN or Curl

---

## API Reference

### `GET /products`

Returns a paginated list of products, sorted by newest first.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `limit` | integer | `50` | Items per page (1–100) |
| `category` | string | — | Filter by category |
| `cursor` | string | — | Opaque cursor for the next page |

**Example Request:**
```
GET /products?limit=20&category=Electronics
GET /products?limit=20&cursor=eyJ0IjoiMjAyNS0wNi0yMFQxNDozMjowMC4wMDBaIiwiaSI6MTk5Nzk4fQ
```

**Example Response:**
```json
{
  "data": [
    {
      "id": 199847,
      "name": "Ergonomic Steel Chair",
      "description": "Comfortable office chair...",
      "category": "Home & Garden",
      "price": "149.99",
      "created_at": "2025-06-20T14:32:00.000Z"
    }
  ],
  "pagination": {
    "limit": 20,
    "has_next": true,
    "next_cursor": "eyJ0IjoiMjAyNS0wNi0yMF..."
  },
  "meta": {
    "query_time_ms": 12
  }
}
```

### `GET /products/categories`

Returns the list of valid category values.

### `POST /products/simulate`

**BONUS:** Injects 50 brand new products at the current timestamp, prefixed with `[NEW]`. 
This endpoint exists explicitly to allow the reviewer to test the "data changing while browsing" requirement in real-time.

### `DELETE /products/simulate`

**BONUS:** Deletes all products that were created by the simulate endpoint, allowing you to reset the database and run the test again.

### `GET /health`

Returns server health, database connection status, and total product count.

---

## Design Decisions (Short Note)

### Why Cursor-Based Pagination?

**The problem with offset pagination:** If 50 new products are inserted while a user is viewing Page 1, requesting Page 2 with `OFFSET 50` shifts the entire result set — the user sees duplicates from the bottom of Page 1.

**The cursor solution:** Instead of saying "skip 50 rows", the API says "give me rows that come *after* this specific row". The cursor encodes the last seen row's `(created_at, id)` pair. No matter how many rows are inserted or deleted, the next page always starts at the correct position.

```
Page 1 returns items with ids: [200000, 199999, ..., 199951]
Cursor = encode(created_at of 199951, id 199951)

→ 50 new products are inserted (ids 200001–200050)

Page 2 request: WHERE (created_at, id) < (cursor_timestamp, 199951)
→ Returns [199950, 199949, ..., 199901]  ← Correct, no duplicates!
```

### Why the `id` Tie-Breaker?

If two products share the exact same `created_at` timestamp, ordering by `created_at` alone is non-deterministic. Adding `id` as a secondary sort key guarantees a unique, stable ordering.

### Database Indexes

Two composite indexes make cursor queries fast on 200k+ rows:

1. **`(created_at DESC, id DESC)`** — covers the default browse query
2. **`(category, created_at DESC, id DESC)`** — covers category-filtered queries

Without these, PostgreSQL would do a full sequential scan of 200k rows on every request.

### Bulk Seeding Strategy

Instead of 200,000 individual `INSERT` statements, the seed script batches rows into groups of 5,000 using multi-row `INSERT ... VALUES (...), (...), ...` inside a single transaction. This reduces:

- Network round-trips: from 200,000 to 40
- Transaction overhead: from 200,000 commits to 1
- Total time: from ~3–5 minutes to ~10 seconds

---

## Project Structure

```
├── src/
│   ├── server.js              # Express entry point
│   ├── db.js                  # PostgreSQL connection pool
│   ├── routes/
│   │   └── products.js        # GET /products with cursor pagination
│   └── utils/
│       └── cursor.js          # Cursor encode/decode helpers
├── scripts/
│   ├── migrate.js             # Create table & indexes
│   └── seed.js                # Bulk-insert 200k products
├── public/
│   └── index.html             # Frontend UI
├── .env                       # Database connection (git-ignored)
├── implementation_plan.md     # Detailed implementation plan
├── package.json
└── README.md
```
