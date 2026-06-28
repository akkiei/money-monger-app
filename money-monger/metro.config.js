// Metro config. Extends Expo's defaults.
//
// colyseus.js → httpie ships multiple builds via package "exports". On native,
// Metro was matching httpie's `import` condition → its Node build (`./node`,
// which imports the `https` std lib and crashes the RN runtime). Adding
// `browser` (and `react-native`) to the active condition set makes Metro match
// httpie's `browser` export first → the XHR build, which works in React Native.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.unstable_conditionNames = ['react-native', 'browser', 'require', 'import'];

module.exports = config;
