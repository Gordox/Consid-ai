// Signs release builds with the upload key named by environment variables at Gradle time, so the
// generated android/ folder (prebuild) never contains a key or password. Without the variables a
// release build stops with Gradle's missing-storeFile error instead of falling back to the debug
// key, so an unsigned or debug-signed release APK cannot be produced by accident.
//
//   TP_UPLOAD_STORE_FILE      absolute path to the keystore
//   TP_UPLOAD_STORE_PASSWORD  keystore password
//   TP_UPLOAD_KEY_ALIAS       key alias
//   TP_UPLOAD_KEY_PASSWORD    key password
const { withAppBuildGradle } = require('expo/config-plugins');

const RELEASE_SIGNING = `
        release {
            def uploadStoreFile = System.getenv('TP_UPLOAD_STORE_FILE')
            if (uploadStoreFile) {
                storeFile file(uploadStoreFile)
                storePassword System.getenv('TP_UPLOAD_STORE_PASSWORD')
                keyAlias System.getenv('TP_UPLOAD_KEY_ALIAS')
                keyPassword System.getenv('TP_UPLOAD_KEY_PASSWORD')
            }
        }`;

// The release build type of the Expo SDK 58 template signs with the debug key.
const DEBUG_SIGNED_RELEASE =
  /(release \{\s*\n(?:\s*\/\/[^\n]*\n)*\s*)signingConfig signingConfigs\.debug/;

function applyReleaseSigning(gradle) {
  if (gradle.includes("System.getenv('TP_UPLOAD_STORE_FILE')")) return gradle;
  if (!gradle.includes('signingConfigs {') || !DEBUG_SIGNED_RELEASE.test(gradle)) {
    throw new Error(
      'withReleaseSigning: android/app/build.gradle does not have the expected template. ' +
        'Check the release signing against the current Expo template before building.',
    );
  }
  return gradle
    .replace('signingConfigs {', `signingConfigs {${RELEASE_SIGNING}`)
    .replace(DEBUG_SIGNED_RELEASE, '$1signingConfig signingConfigs.release');
}

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (gradleConfig) => {
    if (gradleConfig.modResults.language !== 'groovy') {
      throw new Error('withReleaseSigning: expected a Groovy android/app/build.gradle.');
    }
    gradleConfig.modResults.contents = applyReleaseSigning(gradleConfig.modResults.contents);
    return gradleConfig;
  });
};

module.exports.applyReleaseSigning = applyReleaseSigning;
