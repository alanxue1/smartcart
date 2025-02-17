import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { SplashScreen, Stack } from 'expo-router';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import * as Haptics from 'expo-haptics';

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

  // Custom theme with enhanced contrast and larger text
  const AccessibleLightTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      primary: '#000000',
      background: '#FFFFFF',
      text: '#000000',
      card: '#F0F0F0',
    },
  };

  const AccessibleDarkTheme = {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      primary: '#FFFFFF',
      background: '#000000',
      text: '#FFFFFF',
      card: '#1A1A1A',
    },
  };

  return (
    <ThemeProvider value={colorScheme === 'dark' ? AccessibleDarkTheme : AccessibleLightTheme}>
      <Stack
        screenOptions={{
          headerShown: true,
          headerLargeTitle: true,
          headerStyle: {
            backgroundColor: colorScheme === 'dark' ? '#000000' : '#FFFFFF',
          },
          headerTitleStyle: {
            fontSize: 24,
          },
          animation: 'none', // Reduces motion for vestibular disorders
          headerTintColor: colorScheme === 'dark' ? '#FFFFFF' : '#000000',
        }}
      >
        <Stack.Screen 
          name="(tabs)" 
          options={{ 
            headerShown: false,
            contentStyle: {
              backgroundColor: colorScheme === 'dark' ? '#000000' : '#FFFFFF',
            }
          }} 
        />
        <Stack.Screen 
          name="modal" 
          options={{ 
            presentation: 'modal',
            headerLargeTitle: true,
            contentStyle: {
              backgroundColor: colorScheme === 'dark' ? '#000000' : '#FFFFFF',
            }
          }} 
        />
      </Stack>
    </ThemeProvider>
  );
}
