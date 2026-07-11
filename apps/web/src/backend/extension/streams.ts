import type { Stream } from "@topwaatch/providers";

/** No-op  stream headers are handled by the Worker proxy. */
export async function prepareStream(_stream: Stream): Promise<void> {
  // intentionally empty
}
