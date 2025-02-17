import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from 'expo-router';
import { useColorScheme } from 'react-native';
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

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          height: 80,
          paddingBottom: 20,
          backgroundColor: colorScheme === 'dark' ? '#000000' : '#FFFFFF',
        },
        tabBarActiveTintColor: colorScheme === 'dark' ? '#FFFFFF' : '#000000',
        tabBarInactiveTintColor: colorScheme === 'dark' ? '#666666' : '#999999',
        tabBarLabelStyle: {
          fontSize: 16,
        },
        tabBarIconStyle: {
          size: 30,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <FontAwesome size={30} name="home" color={color} />,
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
          tabBarIcon: ({ color }) => <FontAwesome size={30} name="list" color={color} />,
          tabBarAccessibilityLabel: "Shopping List Screen",
        }}
        listeners={{
          tabPress: () => Haptics.selectionAsync(),
        }}
      />
    </Tabs>
  );
}
