import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from 'expo-router';
import { useColorScheme, StyleSheet, Platform } from 'react-native';
import { useTheme } from './index';
import * as Haptics from 'expo-haptics';

/**
 * You can explore the built-in icon families and icons on the web at https://icons.expo.fyi/
 */
function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={28} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { isAccessibleMode, primaryColor } = useTheme();

  // Calculate bottom padding based on platform and device
  // iPhones with home indicator need more padding
  const isIPhoneWithHomeIndicator = Platform.OS === 'ios' && !Platform.isPad && (Platform.constants?.interfaceIdiom === 'handset');
  const bottomPadding = isIPhoneWithHomeIndicator ? 34 : Platform.OS === 'ios' ? 20 : 8;
  const tabBarHeight = isIPhoneWithHomeIndicator ? 90 : Platform.OS === 'ios' ? 80 : 60;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: primaryColor,
        tabBarInactiveTintColor: isAccessibleMode ? '#aaa' : '#666',
        tabBarStyle: {
          backgroundColor: isAccessibleMode ? '#111' : '#fff',
          borderTopColor: isAccessibleMode ? primaryColor : '#e0e0e0',
          borderTopWidth: isAccessibleMode ? 1 : 0.5,
          height: tabBarHeight,
          paddingBottom: bottomPadding,
          paddingTop: 8,
          // Add safe area bottom inset support
          ...(Platform.OS === 'ios' && {
            safeAreaInsets: { bottom: 0 },
            paddingBottom: bottomPadding
          })
        },
        headerStyle: {
          backgroundColor: isAccessibleMode ? '#111' : '#fff',
          borderBottomColor: isAccessibleMode ? primaryColor : '#e0e0e0',
          borderBottomWidth: isAccessibleMode ? 1 : 0.5,
        },
        headerTitleStyle: {
          color: isAccessibleMode ? primaryColor : '#333',
          fontWeight: isAccessibleMode ? '700' : '600',
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: isAccessibleMode ? '700' : '500',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <TabBarIcon name="home" color={color} />,
          tabBarAccessibilityLabel: "Home Screen",
        }}
        listeners={{
          tabPress: () => Haptics.selectionAsync(),
        }}
      />
      <Tabs.Screen
        name="recipes"
        options={{
          title: 'Recipes',
          tabBarIcon: ({ color }) => <FontAwesome size={30} name="cutlery" color={color} />,
          tabBarAccessibilityLabel: "Recipes Screen",
        }}
        listeners={{
          tabPress: () => Haptics.selectionAsync(),
        }}
      />
      <Tabs.Screen
        name="list"
        options={{
          title: 'Shopping List',
          tabBarIcon: ({ color }) => <TabBarIcon name="list" color={color} />,
          tabBarAccessibilityLabel: "Shopping List Screen",
        }}
        listeners={{
          tabPress: () => Haptics.selectionAsync(),
        }}
      />
    </Tabs>
  );
}
