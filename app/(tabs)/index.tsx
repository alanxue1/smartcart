import { StyleSheet } from 'react-native';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';

export default function HomeScreen() {
  const router = useRouter();

  const handleCreateList = () => {
    router.push('/list');
  };

  return (
    <View style={styles.container}>
      <View style={styles.welcomeContainer}>
        <Text style={styles.title}>Welcome to</Text>
        <Text style={styles.subtitle}>Indoor Navigation</Text>
        <Text style={styles.description}>
          Simplify your shopping experience with smart navigation
        </Text>
      </View>
      
      <Pressable style={styles.button} onPress={handleCreateList}>
        <Text style={styles.buttonText}>Create Grocery List</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    justifyContent: 'space-between',
    paddingBottom: 100,
  },
  welcomeContainer: {
    marginTop: '30%',
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  description: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    maxWidth: '80%',
  },
  button: {
    backgroundColor: '#4A90E2',
    padding: 16,
    borderRadius: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
