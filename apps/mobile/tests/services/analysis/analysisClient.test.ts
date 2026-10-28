import {
  type AnalysisRequest,
  MAX_PHOTO_BYTES,
  requestAnalysis,
} from '../../../src/services/analysis/analysisClient';
import { parseAnalysisConfig } from '../../../src/services/analysis/analysisConfig';

const CONFIG = { baseUrl: 'https://analysis.example', host: 'analysis.example' };
const PHOTO = { uri: 'file:///doc/photos/a.jpg', fileName: 'a.jpg', width: 400, height: 300 };
const REQUEST: AnalysisRequest = {
  roundId: 'r1',
  attemptId: 'a1',
  targetId: 'demo-synthetic-v1',
  after: PHOTO,
  before: null,
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const GOOD = {
  roundId: 'r1',
  attemptId: 'a1',
  status: 'succeeded',
  algorithmVersion: 'v1',
  image: { width: 400, height: 300 },
  candidates: [],
  warnings: [],
};

function deps(
  fetch: (url: string, init: RequestInit) => Promise<Response>,
  size: number | null = 1000,
) {
  return { fetch, fileSize: () => size, timeoutMs: 1000 };
}

describe('requestAnalysis', () => {
  it('posts the round, attempt, mode and photos to the analyses endpoint', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const result = await requestAnalysis(
      CONFIG,
      { ...REQUEST, before: { ...PHOTO, fileName: 'b.png', uri: 'file:///doc/photos/b.png' } },
      deps(async (url, init) => {
        calls.push({ url, init });
        return jsonResponse(200, GOOD);
      }),
    );
    expect(result.ok).toBe(true);
    expect(calls[0]?.url).toBe('https://analysis.example/v1/analyses');
    expect(calls[0]?.init.method).toBe('POST');
    const form = calls[0]?.init.body;
    expect(form).toBeInstanceOf(FormData);
    if (form instanceof FormData) {
      expect(form.get('mode')).toBe('paired');
      expect(form.get('attemptId')).toBe('a1');
    }
  });

  it('refuses photos over the size limit, or unreadable ones, without sending anything', async () => {
    const fetch = jest.fn();
    expect(await requestAnalysis(CONFIG, REQUEST, deps(fetch, MAX_PHOTO_BYTES + 1))).toEqual({
      ok: false,
      error: 'fileTooLarge',
    });
    expect(await requestAnalysis(CONFIG, REQUEST, deps(fetch, null))).toEqual({
      ok: false,
      error: 'fileTooLarge',
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    [429, 'rateLimited'],
    [500, 'serverError'],
    [504, 'serverError'],
    [400, 'rejected'],
    [413, 'rejected'],
    [401, 'rejected'],
  ])('classifies HTTP %s as %s', async (status, error) => {
    expect(
      await requestAnalysis(
        CONFIG,
        REQUEST,
        deps(async () => jsonResponse(status, {})),
      ),
    ).toEqual({ ok: false, error });
  });

  it('separates network failures, timeouts and unreadable bodies', async () => {
    expect(
      await requestAnalysis(
        CONFIG,
        REQUEST,
        deps(async () => {
          throw new TypeError('Network request failed');
        }),
      ),
    ).toEqual({ ok: false, error: 'network' });

    jest.useFakeTimers();
    const pending = requestAnalysis(
      CONFIG,
      REQUEST,
      deps(
        (_url, init) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
          }),
      ),
    );
    jest.advanceTimersByTime(1000);
    await expect(pending).resolves.toEqual({ ok: false, error: 'timeout' });
    jest.useRealTimers();

    const broken = new Response('{not json', { status: 200 });
    expect(
      await requestAnalysis(
        CONFIG,
        REQUEST,
        deps(async () => broken),
      ),
    ).toEqual({ ok: false, error: 'invalidResponse' });
  });

  it('never turns an invalid answer into an empty success', async () => {
    const result = await requestAnalysis(
      CONFIG,
      REQUEST,
      deps(async () => jsonResponse(200, { ...GOOD, candidates: null })),
    );
    expect(result).toEqual({ ok: false, error: 'invalidResponse' });
  });

  it('reports a late answer to another attempt as stale', async () => {
    const result = await requestAnalysis(
      CONFIG,
      REQUEST,
      deps(async () => jsonResponse(200, { ...GOOD, attemptId: 'old' })),
    );
    expect(result).toEqual({ ok: false, error: 'stale' });
  });
});

describe('parseAnalysisConfig', () => {
  it('is off without an address', () => {
    expect(parseAnalysisConfig(undefined, true)).toBeNull();
    expect(parseAnalysisConfig('  ', true)).toBeNull();
  });

  it('requires HTTPS, except a local service during development', () => {
    expect(parseAnalysisConfig('https://analysis.example/', false)).toEqual({
      baseUrl: 'https://analysis.example',
      host: 'analysis.example',
    });
    expect(parseAnalysisConfig('http://127.0.0.1:8000', true)?.host).toBe('127.0.0.1:8000');
    expect(parseAnalysisConfig('http://127.0.0.1:8000', false)).toBeNull();
    expect(parseAnalysisConfig('http://analysis.example', true)).toBeNull();
  });

  it('refuses credentials, queries and malformed addresses', () => {
    expect(parseAnalysisConfig('https://user:secret@analysis.example', true)).toBeNull();
    expect(parseAnalysisConfig('https://analysis.example/?key=secret', true)).toBeNull();
    expect(parseAnalysisConfig('not a url', true)).toBeNull();
  });
});
