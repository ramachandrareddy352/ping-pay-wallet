// metro.config.js
const { getDefaultConfig } = require('@react-native/metro-config');

module.exports = (async () => {
  const config = await getDefaultConfig(__dirname);

  // keep your extraNodeModules
  config.resolver.extraNodeModules = {
    ...config.resolver.extraNodeModules,
    stream: require.resolve('stream-browserify'),
    events: require.resolve('events'),
    buffer: require.resolve('buffer'),
    process: require.resolve('process/browser'),
    crypto: require.resolve('react-native-crypto'),
  };

  // enable svg transformer
  config.transformer = {
    ...config.transformer,
    babelTransformerPath: require.resolve('react-native-svg-transformer'),
  };

  config.resolver.assetExts = config.resolver.assetExts.filter(
    ext => ext !== 'svg',
  );
  if (!config.resolver.assetExts.includes('txt')) {
    config.resolver.assetExts.push('txt');
  }
  config.resolver.sourceExts = [...config.resolver.sourceExts, 'svg'];

  return config;
})();
