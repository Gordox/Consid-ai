import {
  isAnalysisAddressRefused,
  parseAnalysisConfig,
} from '../../../src/services/analysis/analysisConfig';

describe('parseAnalysisConfig on a private network', () => {
  it.each(['http://192.168.1.23:8000', 'http://10.0.0.5:8000', 'http://172.20.1.2:8000'])(
    'allows plain HTTP to %s in development only',
    (url) => {
      expect(parseAnalysisConfig(url, true)).not.toBeNull();
      expect(parseAnalysisConfig(url, false)).toBeNull();
    },
  );

  it.each([
    'http://172.32.0.1:8000',
    'http://8.8.8.8:8000',
    'http://192.168.1.300:8000',
    'http://example.com:8000',
    'http://192.168.1.23.example.com',
  ])('refuses plain HTTP to the public address %s even in development', (url) => {
    expect(parseAnalysisConfig(url, true)).toBeNull();
  });
});

describe('isAnalysisAddressRefused', () => {
  it('is false without an address, which simply leaves analysis off', () => {
    expect(isAnalysisAddressRefused(undefined, false)).toBe(false);
    expect(isAnalysisAddressRefused('  ', false)).toBe(false);
  });

  it('is true for a local HTTP address in a release build and false in development', () => {
    expect(isAnalysisAddressRefused('http://192.168.1.23:8000', false)).toBe(true);
    expect(isAnalysisAddressRefused('http://192.168.1.23:8000', true)).toBe(false);
  });

  it('is false for an HTTPS address in a release build', () => {
    expect(isAnalysisAddressRefused('https://analysis.example', false)).toBe(false);
  });
});
