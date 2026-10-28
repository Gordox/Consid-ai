// The analysis service address is the only analysis setting in the app. It is not a secret;
// provider credentials stay on the server. Without it, analysis is off and marking is manual.

export type AnalysisConfig = { readonly baseUrl: string; readonly host: string };

// Private IPv4 ranges (RFC 1918): a computer on the same home or office network.
function isPrivateNetworkAddress(hostname: string): boolean {
  const parts = hostname.split('.');
  if (parts.length !== 4 || !parts.every((part) => /^\d{1,3}$/.test(part))) return false;
  const [a, b] = parts.map(Number);
  if (a === undefined || b === undefined || parts.some((part) => Number(part) > 255)) return false;
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

// HTTPS everywhere. Plain HTTP only in development, and only to this computer or to a computer
// on the same private network (the local analysis service, services/analysis/README.md).
export function parseAnalysisConfig(
  value: string | undefined,
  isDevelopment: boolean,
): AnalysisConfig | null {
  if (value === undefined || value.trim() === '') {
    return null;
  }
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  const local =
    url.hostname === '127.0.0.1' ||
    url.hostname === 'localhost' ||
    isPrivateNetworkAddress(url.hostname);
  const allowed = url.protocol === 'https:' || (isDevelopment && url.protocol === 'http:' && local);
  if (
    !allowed ||
    url.username !== '' ||
    url.password !== '' ||
    url.search !== '' ||
    url.hash !== ''
  ) {
    return null;
  }
  return { baseUrl: url.toString().replace(/\/+$/, ''), host: url.host };
}

export function readAnalysisConfig(): AnalysisConfig | null {
  return parseAnalysisConfig(process.env.EXPO_PUBLIC_ANALYSIS_URL, __DEV__);
}
