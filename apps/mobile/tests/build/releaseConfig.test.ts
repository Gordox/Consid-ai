import { releaseVersion } from '../../app.config';
import { applyReleaseSigning } from '../../plugins/withReleaseSigning';

// The release block of the Expo SDK 58 template (android/app/build.gradle after prebuild).
const TEMPLATE = `android {
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug
            minifyEnabled enableMinifyInReleaseBuilds
        }
    }
}`;

describe('applyReleaseSigning', () => {
  it('signs release builds with the key from the environment and debug builds as before', () => {
    const gradle = applyReleaseSigning(TEMPLATE);
    expect(gradle).toContain('storeFile file(uploadStoreFile)');
    expect(gradle).toContain("System.getenv('TP_UPLOAD_KEY_PASSWORD')");
    const release = gradle.slice(gradle.indexOf('buildTypes'));
    expect(release.match(/signingConfig signingConfigs\.\w+/g)).toEqual([
      'signingConfig signingConfigs.debug',
      'signingConfig signingConfigs.release',
    ]);
  });

  it('changes nothing when applied twice', () => {
    const once = applyReleaseSigning(TEMPLATE);
    expect(applyReleaseSigning(once)).toBe(once);
  });

  it('stops when the template no longer signs release builds with the debug key', () => {
    expect(() => applyReleaseSigning(TEMPLATE.replace(/release \{[^}]*\}/, 'release { }'))).toThrow(
      /expected template/,
    );
  });
});

describe('releaseVersion', () => {
  it('leaves development builds alone when neither value is set', () => {
    expect(releaseVersion({})).toBeNull();
  });

  it('reads a run number and a matching name', () => {
    expect(releaseVersion({ TP_VERSION_CODE: '12', TP_VERSION_NAME: '0.1.0-alpha.12' })).toEqual({
      versionCode: 12,
      versionName: '0.1.0-alpha.12',
    });
  });

  it.each([
    [{ TP_VERSION_CODE: '12' }, /both/],
    [{ TP_VERSION_CODE: '0', TP_VERSION_NAME: '0.1.0' }, /integer/],
    [{ TP_VERSION_CODE: '1.5', TP_VERSION_NAME: '0.1.0' }, /integer/],
    [{ TP_VERSION_CODE: '2100000001', TP_VERSION_NAME: '0.1.0' }, /integer/],
    [{ TP_VERSION_CODE: '3', TP_VERSION_NAME: 'alpha' }, /look like/],
  ])('refuses %j', (env, message) => {
    expect(() => releaseVersion(env)).toThrow(message);
  });
});
