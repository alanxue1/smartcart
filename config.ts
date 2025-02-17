import { Platform } from 'react-native';
import { GEMINI_API_KEY } from '@env';

const config = {
  geminiKey: GEMINI_API_KEY,
  appIdentifier: Platform.select({
    ios: 'com.navicart.app',
    android: 'com.navicart.app',
    default: 'https://github.com/alanxue1/navicart'
  })
};

export default config; 