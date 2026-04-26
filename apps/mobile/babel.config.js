module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    // react-native-reanimated/plugin must be the LAST plugin in the list.
    'react-native-reanimated/plugin',
  ],
};
