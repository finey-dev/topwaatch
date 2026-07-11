/**
 * Run async work over items with a fixed concurrency limit.
 * Batches run sequentially so we don't overwhelm proxies / rate limits.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
  options?: { delayBetweenBatchesMs?: number },
): Promise<R[]> {
  const limit = Math.max(1, concurrency);
  const results: R[] = [];
  const delayMs = options?.delayBetweenBatchesMs ?? 0;

  for (let i = 0; i < items.length; i += limit) {
    const batch = items.slice(i, i + limit);
    const batchResults = await Promise.all(
      batch.map((item, batchIndex) => mapper(item, i + batchIndex)),
    );
    results.push(...batchResults);

    if (delayMs > 0 && i + limit < items.length) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return results;
}
