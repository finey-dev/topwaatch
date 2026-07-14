// import { alphaScraper, deltaScraper } from '@/providers/embeds/nsbx';
// import { astraScraper, novaScraper, orionScraper } from '@/providers/embeds/whvx';
import { bombtheirishScraper } from '@/providers/archive/sources/bombtheirish';
import { streamtapeScraper } from '@/providers/embeds/streamtape';
import { warezcdnembedMp4Scraper } from '@/providers/embeds/warezcdn/mp4';
import { FedAPIScraper } from '@/providers/sources/fedapi';
import { FedAPIDBScraper } from '@/providers/sources/fedapidb';
import { Stream } from '@/providers/streams';
import { IndividualEmbedRunnerOptions } from '@/runners/individualRunner';
import { ProviderRunnerOptions } from '@/runners/runner';

const SKIP_VALIDATION_CHECK_IDS = [
  warezcdnembedMp4Scraper.id,
  streamtapeScraper.id,
  // deltaScraper.id,
  // alphaScraper.id,
  // novaScraper.id,
  // astraScraper.id,
  // orionScraper.id,
];

const UNPROXIED_VALIDATION_CHECK_IDS = [
  // sources here are always proxied, so we dont need to validate with a proxy
  bombtheirishScraper.id, // this one is dead, but i'll keep it here for now
  // Febbox/shegu CDN URLs are KEY-signed to the browser IP  proxied validation 404s.
  FedAPIScraper.id,
  FedAPIDBScraper.id,
];

export function isValidStream(stream: Stream | undefined): boolean {
  if (!stream) return false;
  if (stream.type === 'hls') {
    if (!stream.playlist) return false;
    return true;
  }
  if (stream.type === 'file') {
    const validQualities = Object.values(stream.qualities).filter((v) => v.url.length > 0);
    if (validQualities.length === 0) return false;
    return true;
  }
  if (stream.type === 'iframe') {
    return Boolean(stream.embedUrl);
  }

  return false;
}

/**
 * Check if a URL is already going through our proxy and should be validated
 * with normal fetch (no double-proxy). Do NOT treat CDN hosts like shegu.net
 * as "already proxied"  those need proxiedFetcher for CORS + same egress IP.
 */
function isAlreadyProxyUrl(url: string): boolean {
  return (
    url.includes('/m3u8-proxy?url=') ||
    url.includes('/ts-proxy?url=') ||
    url.includes('/proxy?destination=') ||
    url.includes('destination=')
  );
}

/**
 * Check if a response result indicates an invalid/error response that should fail validation
 */
function isErrorResponse(result: { statusCode: number; body: string | any; finalUrl?: string }): boolean {
  if (result.statusCode === 403) return true;

  const bodyStr = typeof result.body === 'string' ? result.body : String(result.body);
  if (result.statusCode === 200 && bodyStr.trim() === 'error_wrong_ip') return true;

  if (result.statusCode === 200) {
    try {
      const parsed = JSON.parse(bodyStr);
      if (parsed.status === 403 && parsed.msg === 'Access Denied') return true;
    } catch {
      // Not JSON, continue
    }
  }

  return false;
}

function bodyToBytes(body: unknown): Uint8Array | null {
  if (body == null) return null;
  if (body instanceof ArrayBuffer) return new Uint8Array(body);
  if (ArrayBuffer.isView(body)) {
    return new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
  }
  if (typeof body === 'string') {
    // Latin1 round-trip for small binary probes returned as text
    const out = new Uint8Array(body.length);
    for (let i = 0; i < body.length; i += 1) out[i] = body.charCodeAt(i) & 0xff;
    return out;
  }
  return null;
}

/**
 * Reject MKV containers  browsers often play video but not AC3/DTS audio.
 */
export function isMkvHeader(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3
  );
}

/**
 * Reject MP4s that HTML5 <video> cannot play: containers whose first mdat
 * extends to EOF with no moov beforehand (common doodstream hotlink decoy).
 * Fast-start (moov first) and moov-at-end (finite mdat size) both pass.
 */
export function isHtml5PlayableMp4Header(bytes: Uint8Array): boolean {
  if (bytes.length < 8) return true; // not enough to judge  keep stream

  let offset = 0;
  while (offset + 8 <= bytes.length) {
    const size =
      (bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3];
    // >>> 0 keeps size unsigned (JS bitwise is signed 32-bit)
    const unsignedSize = size >>> 0;
    const type = String.fromCharCode(
      bytes[offset + 4],
      bytes[offset + 5],
      bytes[offset + 6],
      bytes[offset + 7],
    );

    if (type === 'moov') return true;

    if (type === 'mdat') {
      // size 0 ⇒ atom runs to EOF; no room for a trailing moov → unplayable
      if (unsignedSize === 0) return false;
      // Finite mdat (moov likely at end) or continue  accept
      return true;
    }

    if (unsignedSize === 1) {
      // 64-bit extended size
      if (offset + 16 > bytes.length) break;
      const large = Number(
        (BigInt(bytes[offset + 8]) << 56n) |
          (BigInt(bytes[offset + 9]) << 48n) |
          (BigInt(bytes[offset + 10]) << 40n) |
          (BigInt(bytes[offset + 11]) << 32n) |
          (BigInt(bytes[offset + 12]) << 24n) |
          (BigInt(bytes[offset + 13]) << 16n) |
          (BigInt(bytes[offset + 14]) << 8n) |
          BigInt(bytes[offset + 15]),
      );
      if (!Number.isFinite(large) || large < 16) return false;
      offset += large;
      continue;
    }

    if (unsignedSize === 0) break;
    if (unsignedSize < 8) return false;
    offset += unsignedSize;
  }

  return true;
}

async function probeFileQuality(
  url: string,
  headers: Record<string, string>,
  ops: ProviderRunnerOptions | IndividualEmbedRunnerOptions,
  useNormalFetch: boolean,
): Promise<{ statusCode: number; body: unknown; finalUrl?: string }> {
  const rangeHeaders = {
    ...headers,
    Range: 'bytes=0-511',
  };

  if (useNormalFetch) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: rangeHeaders,
        signal: AbortSignal.timeout(20000),
      });
      return {
        statusCode: response.status,
        body: await response.arrayBuffer(),
        finalUrl: response.url,
      };
    } catch {
      return { statusCode: 500, body: '', finalUrl: url };
    }
  }

  try {
    return await Promise.race([
      ops.proxiedFetcher.full(url, {
        method: 'GET',
        headers: rangeHeaders,
      }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), 20000);
      }),
    ]);
  } catch {
    return { statusCode: 500, body: '', finalUrl: url };
  }
}

export async function validatePlayableStream(
  stream: Stream,
  ops: ProviderRunnerOptions | IndividualEmbedRunnerOptions,
  sourcererId: string,
): Promise<Stream | null> {
  if (SKIP_VALIDATION_CHECK_IDS.includes(sourcererId)) return stream;
  if (stream.skipValidation) return stream;
  if (stream.type === 'iframe') return stream;

  const alwaysUseNormalFetch = UNPROXIED_VALIDATION_CHECK_IDS.includes(sourcererId);

  if (stream.type === 'hls') {
    // dirty temp fix for base64 urls to prep for fmhy poll
    if (stream.playlist.startsWith('data:')) return stream;

    const useNormalFetch = alwaysUseNormalFetch || isAlreadyProxyUrl(stream.playlist);

    let result;
    if (useNormalFetch) {
      try {
        const response = await fetch(stream.playlist, {
          method: 'GET',
          headers: {
            ...stream.preferredHeaders,
            ...stream.headers,
          },
          signal: AbortSignal.timeout(20000),
        });
        result = {
          statusCode: response.status,
          body: await response.text(),
          finalUrl: response.url,
        };
      } catch (error) {
        return null;
      }
    } else {
      try {
        result = await Promise.race([
          ops.proxiedFetcher.full(stream.playlist, {
            method: 'GET',
            headers: {
              ...stream.preferredHeaders,
              ...stream.headers,
            },
          }),
          new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Timeout')), 20000);
          }),
        ]);
      } catch {
        return null;
      }
    }

    if (result.statusCode < 200 || result.statusCode >= 400 || isErrorResponse(result)) return null;
    return stream;
  }

  if (stream.type === 'file') {
    const headerBag = {
      ...stream.preferredHeaders,
      ...stream.headers,
    };
    const qualityEntries = Object.entries(stream.qualities);
    const validQualitiesResults = await Promise.all(
      qualityEntries.map(async ([, quality]) => {
        const useNormalFetch = alwaysUseNormalFetch || isAlreadyProxyUrl(quality.url);
        return probeFileQuality(quality.url, headerBag, ops, useNormalFetch);
      }),
    );

    const validQualities = { ...stream.qualities };
    qualityEntries.forEach(([qualityKey], index) => {
      const result = validQualitiesResults[index];
      if (
        result.statusCode < 200 ||
        result.statusCode >= 400 ||
        isErrorResponse(result)
      ) {
        delete validQualities[qualityKey as keyof typeof stream.qualities];
        return;
      }
      const bytes = bodyToBytes(result.body);
      if (bytes && isMkvHeader(bytes)) {
        delete validQualities[qualityKey as keyof typeof stream.qualities];
        return;
      }
      if (bytes && !isHtml5PlayableMp4Header(bytes)) {
        delete validQualities[qualityKey as keyof typeof stream.qualities];
      }
    });

    if (Object.keys(validQualities).length === 0) return null;
    return { ...stream, qualities: validQualities };
  }

  return null;
}

export async function validatePlayableStreams(
  streams: Stream[],
  ops: ProviderRunnerOptions | IndividualEmbedRunnerOptions,
  sourcererId: string,
): Promise<Stream[]> {
  if (SKIP_VALIDATION_CHECK_IDS.includes(sourcererId)) return streams;

  return (await Promise.all(streams.map((stream) => validatePlayableStream(stream, ops, sourcererId)))).filter(
    (v) => v !== null,
  ) as Stream[];
}
