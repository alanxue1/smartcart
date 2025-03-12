import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from 'expo-router';
import { useColorScheme, StyleSheet } from 'react-native';
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

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: primaryColor,
        tabBarInactiveTintColor: isAccessibleMode ? '#aaa' : '#666',
        tabBarStyle: {
          backgroundColor: isAccessibleMode ? '#111' : '#fff',
          borderTopColor: isAccessibleMode ? primaryColor : '#e0e0e0',
          borderTopWidth: isAccessibleMode ? 1 : 0.5,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
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
        name="map"
        options={{
          title: 'Store Map',
          tabBarIcon: ({ color }) => <FontAwesome size={30} name="map" color={color} />,
          tabBarAccessibilityLabel: "Store Map Screen",
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
