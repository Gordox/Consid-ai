// Release builds get their version from the workflow (implementation/assignment-4-delivery.md):
// TP_VERSION_CODE is the run number, unique and increasing, and TP_VERSION_NAME the matching
// name. Without them, development keeps app.json's version and versionCode 1.
const MAX_ANDROID_VERSION_CODE = 2100000000;

function releaseVersion(env) {
  const code = env.TP_VERSION_CODE;
  const name = env.TP_VERSION_NAME;
  if (code === undefined && name === undefined) return null;
  if (code === undefined || name === undefined) {
    throw new Error('Set both TP_VERSION_CODE and TP_VERSION_NAME, or neither.');
  }
  const versionCode = Number(code);
  if (!/^\d+$/.test(code) || versionCode < 1 || versionCode > MAX_ANDROID_VERSION_CODE) {
    throw new Error(`TP_VERSION_CODE must be an integer from 1 to ${MAX_ANDROID_VERSION_CODE}.`);
  }
  if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?$/.test(name)) {
    throw new Error('TP_VERSION_NAME must look like 0.1.0 or 0.1.0-alpha.12.');
  }
  return { versionCode, versionName: name };
}

module.exports = ({ config }) => {
  const release = releaseVersion(process.env);
  if (release === null) return config;
  return {
    ...config,
    version: release.versionName,
    android: { ...config.android, versionCode: release.versionCode },
  };
};

module.exports.releaseVersion = releaseVersion;
