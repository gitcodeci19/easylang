/**
 * Parse and match user-configured domain/URL blocklist rules so the extension
 * never injects scripts or displays prompts on restricted websites.
 */

export function normalizeBlockedEntry(raw: string): string | null {
  let value = raw.trim().toLowerCase();
  if (!value || value.startsWith('#')) return null;

  value = value.replace(/^[a-z]+:\/\//, '');
  value = value.replace(/^\*\./, '');
  value = value.replace(/\/+$/, '');

  if (!value) return null;

  // If user pasted a full URL with only a root slash, keep just the host
  const slashIdx = value.indexOf('/');
  if (slashIdx === -1) {
    return value;
  }

  const hostPart = value.slice(0, slashIdx).trim();
  const pathPart = value.slice(slashIdx).replace(/\*+$/, '').replace(/\/+$/, '').trim();
  if (!hostPart) return null;
  if (!pathPart || pathPart === '/') return hostPart;
  return `${hostPart}${pathPart}`;
}

export function parseBlockedListText(text: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const line of text.split(/[\r\n,]+/)) {
    const norm = normalizeBlockedEntry(line);
    if (norm && !seen.has(norm)) {
      seen.add(norm);
      result.push(norm);
    }
  }
  return result;
}

export function isUrlBlocked(url: string | undefined, blockedPatterns: string[]): boolean {
  if (!url || blockedPatterns.length === 0) return false;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return false;
  }

  const hostname = parsed.hostname.toLowerCase();
  const hostWithPort = parsed.host.toLowerCase();
  const pathname = parsed.pathname.toLowerCase();

  for (const rawPattern of blockedPatterns) {
    const pattern = normalizeBlockedEntry(rawPattern);
    if (!pattern) continue;

    const slashIdx = pattern.indexOf('/');
    const targetHost = slashIdx === -1 ? pattern : pattern.slice(0, slashIdx);
    const targetPath = slashIdx === -1 ? null : pattern.slice(slashIdx);

    const hostMatches = targetHost.includes(':')
      ? hostWithPort === targetHost
      : hostname === targetHost || hostname.endsWith(`.${targetHost}`);

    if (!hostMatches) continue;
    if (targetPath === null) return true;
    if (pathname.startsWith(targetPath)) return true;
  }

  return false;
}

/**
 * Convert user blocklist entries into Chrome MV3 match patterns for
 * `chrome.scripting.registerContentScripts({ excludeMatches })`.
 */
export function toChromeExcludeMatches(blockedPatterns: string[]): string[] {
  const patterns = new Set<string>();

  for (const raw of blockedPatterns) {
    const norm = normalizeBlockedEntry(raw);
    if (!norm) continue;

    const slashIdx = norm.indexOf('/');
    const hostPart = slashIdx === -1 ? norm : norm.slice(0, slashIdx);
    const pathPart = slashIdx === -1 ? '' : norm.slice(slashIdx);

    // Chrome match patterns cannot include port numbers in the host
    const hostNoPort = hostPart.split(':')[0]?.trim();
    if (!hostNoPort || !/^[a-z0-9.-]+$/.test(hostNoPort)) continue;

    const pathSuffix = pathPart ? `${pathPart}*` : '/*';
    patterns.add(`*://${hostNoPort}${pathSuffix}`);
    if (!hostNoPort.startsWith('*.') && hostNoPort !== 'localhost' && !/^\d+\.\d+\.\d+\.\d+$/.test(hostNoPort)) {
      patterns.add(`*://*.${hostNoPort}${pathSuffix}`);
    }
  }

  return Array.from(patterns);
}
