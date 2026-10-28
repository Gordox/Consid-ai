import { analysisBlock, latestAttemptText } from '../../../src/features/analysis/analysisText';

const READY = {
  hasAfter: true,
  photosMissing: false,
  oldPhotoCopy: false,
  calibrated: true,
  targetKnown: true,
};

describe('analysisBlock', () => {
  it('allows analysis only with a present, normalised, calibrated after photo', () => {
    expect(analysisBlock(READY)).toBeNull();
    expect(analysisBlock({ ...READY, hasAfter: false })).toBe('noAfterPhoto');
    expect(analysisBlock({ ...READY, photosMissing: true })).toBe('photoMissing');
    expect(analysisBlock({ ...READY, oldPhotoCopy: true })).toBe('oldPhotoCopy');
    expect(analysisBlock({ ...READY, calibrated: false })).toBe('notCalibrated');
  });

  it('names the first thing to fix', () => {
    expect(analysisBlock({ ...READY, hasAfter: false, calibrated: false })).toBe('noAfterPhoto');
  });
});

describe('latestAttemptText', () => {
  it('reports a pending attempt that is not running here as interrupted', () => {
    const pending = { status: 'pending', errorCode: null, source: 'service' } as const;
    expect(latestAttemptText(pending, true)).toEqual({ tone: 'info', text: 'Analysing…' });
    expect(latestAttemptText(pending, false).tone).toBe('error');
    expect(latestAttemptText(pending, false).text).toContain("didn't finish");
  });

  it('explains stored failures and never shows an unknown code', () => {
    expect(
      latestAttemptText({ status: 'failed', errorCode: 'timeout', source: 'service' }, false).text,
    ).toContain('took too long');
    expect(
      latestAttemptText({ status: 'failed', errorCode: 'x-unknown', source: 'service' }, false)
        .text,
    ).toBe('The last analysis failed. Try again.');
  });

  it('labels demo runs as demo', () => {
    expect(
      latestAttemptText({ status: 'succeeded', errorCode: null, source: 'demo' }, false).text,
    ).toContain('demo');
  });
});
