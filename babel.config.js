module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Required for expo-router
      'expo-router/babel',
      [
        'module:react-native-dotenv',
        {
          moduleName: '@env',
          path: '.env',
          blacklist: null,
          allowlist: [
            'GEMINI_API_KEY',
            'USDA_API_KEY',
            'MAPPEDIN_CLIENT_ID',
            'MAPPEDIN_CLIENT_SECRET'
          ],
          safe: true,
          allowUndefined: false,
        },
      ],
    ],
  };
};
