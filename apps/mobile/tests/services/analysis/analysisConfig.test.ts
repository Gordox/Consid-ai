import { parseAnalysisConfig } from '../../../src/services/analysis/analysisConfig';

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
