import { Pool, PoolConfig } from "pg";
import dotenv from "dotenv";

// Load env (supports .env.local and .env)
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

// Database connection config
function getDatabaseConfig(): PoolConfig {
  // Prefer DATABASE_URL (recommended for containerized deployment)
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.DB_POOL_MAX ?? 10),
      idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS ?? 30000),
      connectionTimeoutMillis: Number(process.env.DB_CONN_TIMEOUT_MS ?? 5000),
    };
  }

  // Otherwise use separate env vars
  // Use placeholder at build time to avoid build failure
  const password = process.env.DATABASE_PASSWORD || 'placeholder_for_build';

  return {
    host: process.env.DATABASE_HOST ?? "127.0.0.1", // Use 127.0.0.1 to avoid IPv6 issues
    port: Number(process.env.DATABASE_PORT ?? 5432),
    database: process.env.DATABASE_NAME ?? "howard_sidewalk_db",
    user: process.env.DATABASE_USER ?? "appuser",
    password: password,
    max: Number(process.env.DB_POOL_MAX ?? 10),
    idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS ?? 30000),
    connectionTimeoutMillis: Number(process.env.DB_CONN_TIMEOUT_MS ?? 5000),
  };
}

const pool = new Pool(getDatabaseConfig());

// Test DB connection
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Lightweight retry helper (connection-level errors only)
async function retryOnConnectionError<T>(
  fn: () => Promise<T>,
  maxRetries: number = 10,
  initialDelay: number = 100
): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      // Retry only on connection-level errors
      const isConnectionError = 
        error.code === 'ECONNREFUSED' || 
        error.code === 'ETIMEDOUT' ||
        error.code === 'ENOTFOUND' ||
        error.code === 'EHOSTUNREACH';
      
      if (!isConnectionError || attempt === maxRetries) {
        throw error;
      }
      
      const delay = initialDelay * Math.pow(2, attempt); // Exponential backoff
      console.warn(`Database connection failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

// Query helper with retry
export async function query(text: string, params?: any[]) {
  const start = Date.now();
  try {
    const res = await retryOnConnectionError(() => pool.query(text, params));
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

// Get single row
export async function queryOne(text: string, params?: any[]) {
  const result = await query(text, params);
  return result.rows[0] || null;
}

// Get multiple rows
export async function queryMany(text: string, params?: any[]) {
  const result = await query(text, params);
  return result.rows;
}

// Run in transaction
export async function transaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export default pool;
