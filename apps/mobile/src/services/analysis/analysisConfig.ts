// The analysis service address is the only analysis setting in the app. It is not a secret;
// provider credentials stay on the server. Without it, analysis is off and marking is manual.

export type AnalysisConfig = { readonly baseUrl: string; readonly host: string };

// HTTPS everywhere; plain HTTP only for a service on this computer during development.
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
  const local = url.hostname === '127.0.0.1' || url.hostname === 'localhost';
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
