const { withAndroidManifest } = require('expo/config-plugins');

const PACKAGES = ['com.google.android.apps.maps', 'com.waze'];

module.exports = function withAndroidMapQueries(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    manifest.queries = manifest.queries ?? [{ package: [] }];
    const block = manifest.queries[0];
    block.package = block.package ?? [];
    for (const pkg of PACKAGES) {
      if (!block.package.some((p) => p.$['android:name'] === pkg)) {
        block.package.push({ $: { 'android:name': pkg } });
      }
    }
    return config;
  });
};
