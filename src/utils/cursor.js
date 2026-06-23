/**
 * Encode a cursor from the last row's created_at and id.
 * @param {string|Date} createdAt
 * @param {number} id
 * @returns {string} base64url-encoded cursor string
 */
function encodeCursor(createdAt, id) {
  const payload = JSON.stringify({
    t: typeof createdAt === 'string' ? createdAt : createdAt.toISOString(),
    i: id,
  });
  return Buffer.from(payload).toString('base64url');
}

/**
 * Decode a cursor string back into { createdAt, id }.
 * @param {string} cursor
 * @returns {{ createdAt: string, id: number }}
 * @throws {Error} if the cursor is malformed
 */
function decodeCursor(cursor) {
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf-8');
    const parsed = JSON.parse(raw);

    if (!parsed.t || typeof parsed.i !== 'number') {
      throw new Error('Missing cursor fields');
    }

    // Validate that 't' is a parseable date
    const date = new Date(parsed.t);
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date in cursor');
    }

    return { createdAt: parsed.t, id: parsed.i };
  } catch (err) {
    throw new Error(`Invalid cursor: ${err.message}`);
  }
}

module.exports = { encodeCursor, decodeCursor };
