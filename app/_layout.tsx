import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { SplashScreen, Stack } from 'expo-router';
import { useEffect } from 'react';
import { useColorScheme, StatusBar, Platform, ColorSchemeName } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ThemeProvider, useTheme } from './(tabs)/index';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  const colorScheme = useColorScheme();

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  
  return (
    <ThemeProvider>
      <AppWithTheme colorScheme={colorScheme} />
    </ThemeProvider>
  );
}

function AppWithTheme({ colorScheme }: { colorScheme: ColorSchemeName }) {
  const { isDarkMode } = useTheme();
  
  // Apply status bar style based on theme
  useEffect(() => {
    StatusBar.setBarStyle(isDarkMode ? 'light-content' : 'dark-content');
    if (Platform.OS === 'android') {
      StatusBar.setBackgroundColor(isDarkMode ? '#222' : '#fff');
    }
  }, [isDarkMode]);
  
  return (
    <NavigationThemeProvider value={isDarkMode ? DarkTheme : DefaultTheme}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: isDarkMode ? '#222' : '#fff',
          },
        }}
      />
    </NavigationThemeProvider>
  );
}
