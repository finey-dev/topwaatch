import { env } from "@topwaatch/env/server";
import { Pool, type PoolConfig } from "pg";

/** Vercel / other serverless runtimes reuse warm instances — keep pools tiny. */
const isServerless = process.env.VERCEL === "1" || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

const poolConfig: PoolConfig = {
  connectionString: env.DATABASE_URL,
  // Supabase transaction pooler (6543) already multiplexes; one slot per instance is enough.
  max: isServerless ? 1 : 5,
  idleTimeoutMillis: isServerless ? 5_000 : 30_000,
  connectionTimeoutMillis: 10_000,
  // Release connections quickly on idle serverless instances.
  allowExitOnIdle: isServerless,
};

declare global {
  // eslint-disable-next-line no-var
  var __topwaatchPgPool: Pool | undefined;
}

function createPool(): Pool {
  const pool = new Pool(poolConfig);

  pool.on("error", (err) => {
    console.error("[db] Unexpected idle pool client error", err);
  });

  return pool;
}

/** Singleton pool — survives warm serverless invocations via globalThis. */
export function getPool(): Pool {
  if (!globalThis.__topwaatchPgPool) {
    globalThis.__topwaatchPgPool = createPool();
  }
  return globalThis.__topwaatchPgPool;
}

/** Graceful shutdown (local dev / tests). No-op on cold serverless starts. */
export async function closePool(): Promise<void> {
  if (globalThis.__topwaatchPgPool) {
    await globalThis.__topwaatchPgPool.end();
    globalThis.__topwaatchPgPool = undefined;
  }
}
