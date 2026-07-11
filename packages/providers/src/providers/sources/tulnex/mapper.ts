/**
 * Extracts a stream URL (and optional headers) from the many different
 * response shapes returned by Tulnex backend servers.
 */

export interface ExtractedStream {
  url: string;
  headers: Record<string, string> | null;
}

type AnyRecord = Record<string, unknown>;

function wrap(url: unknown, headers: Record<string, string> | null = null): ExtractedStream | null {
  if (!url || typeof url !== 'string' || !url.includes('http')) return null;
  return { url, headers };
}

export function extractUrl(data: unknown): ExtractedStream | null {
  if (!data) return null;
  if (typeof data === 'string' && data.includes('http')) return wrap(data);

  const d = data as AnyRecord;
  const headers = (d.headers as Record<string, string>) ?? null;

  if (typeof d.url === 'string' && d.url.includes('http')) return wrap(d.url, headers);
  if (typeof d.stream === 'string' && d.stream.includes('http')) return wrap(d.stream, headers);
  if (typeof d.playlist === 'string' && d.playlist.includes('http')) return wrap(d.playlist, headers);
  if (typeof d.streamUrl === 'string' && d.streamUrl.includes('http')) return wrap(d.streamUrl, headers);
  if (typeof d.stream_url === 'string' && d.stream_url.includes('http')) return wrap(d.stream_url, headers);
  if (typeof d.streaming_url === 'string' && d.streaming_url.includes('http')) return wrap(d.streaming_url, headers);
  if (typeof d.video_url === 'string' && d.video_url.includes('http')) return wrap(d.video_url, headers);
  if (typeof d.m3u8 === 'string' && d.m3u8.includes('http')) return wrap(d.m3u8, headers);

  // { sources: { primary: { url, headers } } }
  const srcsPrimary = (d.sources as AnyRecord)?.primary as AnyRecord | undefined;
  if (srcsPrimary?.url) return wrap(srcsPrimary.url, (srcsPrimary.headers as Record<string, string>) ?? headers);

  // { sources: [{ url, quality, headers }] }
  if (Array.isArray(d.sources) && d.sources.length > 0) {
    const sorted = (d.sources as AnyRecord[])
      .filter((s) => typeof s.url === 'string' && (s.url as string).includes('http'))
      .sort((a, b) => {
        const qa = parseInt(((a.quality as string) ?? '').replace('p', '') || '0');
        const qb = parseInt(((b.quality as string) ?? '').replace('p', '') || '0');
        return qb - qa;
      });
    if (sorted.length > 0) return wrap(sorted[0].url, (sorted[0].headers as Record<string, string>) ?? headers);
  }

  // { languages: [{ original: true, sources: [...] }] }
  if (Array.isArray(d.languages)) {
    const orig = (d.languages as AnyRecord[]).find(
      (l) => l.original === true && Array.isArray(l.sources) && (l.sources as unknown[]).length > 0,
    );
    if (orig) {
      const sorted = [...(orig.sources as AnyRecord[])].sort(
        (a, b) =>
          parseInt(((b.quality as string) ?? '').replace('p', '') || '0') -
          parseInt(((a.quality as string) ?? '').replace('p', '') || '0'),
      );
      return wrap(sorted[0].url ?? sorted[0].file, (sorted[0].headers as Record<string, string>) ?? (orig.headers as Record<string, string>) ?? headers);
    }
  }

  // { links: [{ url }] }
  if (Array.isArray(d.links) && d.links.length > 0) {
    const link = (d.links as AnyRecord[]).find((l) => typeof l.url === 'string' && (l.url as string).includes('http'));
    if (link) return wrap(link.url, headers);
  }

  // Nested { data: { data: { stream: { playlist } } } } or { data: { stream: { playlist } } }
  const nested = d.data as AnyRecord | undefined;
  if (nested?.data && (nested.data as AnyRecord)?.stream)
    return wrap(((nested.data as AnyRecord).stream as AnyRecord)?.playlist, headers);
  if (nested?.stream) return wrap((nested.stream as AnyRecord)?.playlist, headers);
  if (typeof nested?.url === 'string' && nested.url.includes('http'))
    return wrap(nested.url, (nested.headers as Record<string, string>) ?? headers);
  if (Array.isArray(nested?.sources)) {
    const src = (nested!.sources as AnyRecord[]).find(
      (s) => typeof s.url === 'string' && (s.url as string).includes('http'),
    );
    if (src) return wrap(src.url, (src.headers as Record<string, string>) ?? headers);
  }

  // { streams: [{ url | link }] }
  if (Array.isArray(d.streams)) {
    const src = (d.streams as AnyRecord[]).find(
      (s) =>
        (typeof s.url === 'string' && (s.url as string).includes('http')) ||
        (typeof s.link === 'string' && (s.link as string).includes('http')),
    );
    if (src) return wrap(src.url ?? src.link, (src.headers as Record<string, string>) ?? headers);
  }

  return null;
}
