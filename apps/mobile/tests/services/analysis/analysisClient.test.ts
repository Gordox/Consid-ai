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
  calibration: [
    { x: 200, y: 10 },
    { x: 390, y: 150 },
    { x: 200, y: 290 },
    { x: 10, y: 150 },
  ],
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

// A minimal metadata-free JPEG head: SOI, then the start of scan.
const CLEAN_JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0x00, 0x08]);

function deps(
  fetch: (url: string, init: RequestInit) => Promise<Response>,
  size: number | null = 1000,
  head: Uint8Array = CLEAN_JPEG,
) {
  return { fetch, fileSize: () => size, readHead: () => head, timeoutMs: 1000 };
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
      expect(JSON.parse(String(form.get('calibration')))).toEqual({
        points: REQUEST.calibration,
      });
    }
  });

  it('sends nothing when a photo still carries EXIF metadata or is not a JPEG', async () => {
    // EXIF block with a GPS directory entry (tag 0x8825), then the start of scan.
    const exif = new Uint8Array([
      0xff, 0xd8, 0xff, 0xe1, 0x00, 0x1c, 0x45, 0x78, 0x69, 0x66, 0, 0, 0x4d, 0x4d, 0, 42, 0, 0, 0,
      8, 0, 1, 0x88, 0x25, 0, 4, 0, 0, 0, 1, 0, 0, 0, 26, 0xff, 0xda, 0, 8,
    ]);
    for (const head of [exif, new Uint8Array([0x89, 0x50, 0x4e, 0x47])]) {
      const fetch = jest.fn();
      await expect(requestAnalysis(CONFIG, REQUEST, deps(fetch, 1000, head))).resolves.toEqual({
        ok: false,
        error: 'unsafePhoto',
      });
      expect(fetch).not.toHaveBeenCalled();
    }
  });

  it('separates a rejected calibration from other rejections', async () => {
    const result = await requestAnalysis(
      CONFIG,
      REQUEST,
      deps(async () =>
        jsonResponse(422, { code: 'invalidCalibration', message: 'x', requestId: 'r' }),
      ),
    );
    expect(result).toEqual({ ok: false, error: 'calibrationRejected' });
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
    // The service answers 504 when its own processing time limit is reached (contract 1.1).
    [504, 'timeout'],
    [400, 'rejected'],
    [413, 'fileTooLarge'],
    [415, 'rejected'],
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
