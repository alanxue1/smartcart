import { Platform } from 'react-native';
import { GEMINI_API_KEY, MAPPEDIN_CLIENT_ID, MAPPEDIN_CLIENT_SECRET } from '@env';

const config = {
  geminiKey: GEMINI_API_KEY,
  mappedInKey: MAPPEDIN_CLIENT_ID,
  mappedInSecret: MAPPEDIN_CLIENT_SECRET,
  appIdentifier: Platform.select({
    ios: 'com.navicart.app',
    android: 'com.navicart.app',
    default: 'https://github.com/alanxue1/navicart'
  })
};

export default config; 