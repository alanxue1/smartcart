import { StyleSheet } from 'react-native';
import { View, Text, Pressable, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Link } from 'expo-router';

const TUTORIAL_STEPS = [
  {
    title: "Welcome to NaviCart! 🛒",
    description: "Let's learn how to use the app in a few simple steps."
  },
  {
    title: "Adding Items ➕",
    description: "Type your grocery item in the input box and tap the + button or press enter. Our AI will automatically categorize it for you!"
  },
  {
    title: "Managing Items ✅",
    description: "Tap any item to mark it as complete. Long press to delete it from your list."
  },
  {
    title: "Smart Categories 🤖",
    description: "Your items are automatically sorted into categories like Produce, Dairy, Meat, etc. This helps you shop more efficiently!"
  },
  {
    title: "Real-time Sync 🔄",
    description: "Your list updates in real-time across all your devices. Changes are saved automatically!"
  }
];

export default function HomeScreen() {
  const router = useRouter();
  const [showTutorial, setShowTutorial] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    checkFirstTime();
  }, []);

  const checkFirstTime = async () => {
    try {
      const hasSeenTutorial = await AsyncStorage.getItem('hasSeenTutorial');
      if (!hasSeenTutorial) {
        setShowTutorial(true);
      }
    } catch (error) {
      console.error('Error checking tutorial status:', error);
    }
  };

  const handleTutorialComplete = async () => {
    try {
      await AsyncStorage.setItem('hasSeenTutorial', 'true');
      setShowTutorial(false);
    } catch (error) {
      console.error('Error saving tutorial status:', error);
    }
  };

  const handleCreateList = () => {
    router.push('/list');
  };

  const nextStep = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (currentStep < TUTORIAL_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleTutorialComplete();
    }
  };

  const prevStep = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <View style={styles.container}>
      <Pressable 
        style={styles.helpButton}
        onPress={async () => {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setCurrentStep(0);
          setShowTutorial(true);
        }}
      >
        <Text style={styles.helpButtonText}>?</Text>
      </Pressable>

      <View style={styles.welcomeContainer}>
        <Text style={styles.title}>Welcome to</Text>
        <Text style={styles.appName}>NaviCart</Text>
        <View style={styles.iconContainer}>
          <FontAwesome name="shopping-cart" size={80} color="#4A90E2" style={styles.cartIcon} />
          <View style={styles.markerContainer}>
            <View style={styles.markerBackground}>
              <FontAwesome name="map-marker" size={40} color="#4A90E2" />
            </View>
          </View>
          <View style={styles.markerShadow} />
        </View>
        <Text style={styles.subtitle}>
          Simplify your shopping experience{'\n'}with smart navigation
        </Text>
      </View>
      
      <Link href="/list" asChild>
        <Pressable style={styles.button} onPress={handleCreateList}>
          <Text style={styles.buttonText}>Create Grocery List</Text>
        </Pressable>
      </Link>

      <Modal
        animationType="slide"
        transparent={true}
        visible={showTutorial}
        onRequestClose={handleTutorialComplete}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.tutorialTitle}>{TUTORIAL_STEPS[currentStep].title}</Text>
            <Text style={styles.tutorialDescription}>{TUTORIAL_STEPS[currentStep].description}</Text>
            
            <View style={styles.navigationContainer}>
              {currentStep > 0 && (
                <Pressable 
                  style={[styles.navButton, { left: 10 }]} 
                  onPress={prevStep}
                >
                  <FontAwesome name="chevron-left" size={24} color="#4A90E2" />
                </Pressable>
              )}
              
              <View style={styles.tutorialProgress}>
                {TUTORIAL_STEPS.map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.progressDot,
                      index === currentStep && styles.progressDotActive
                    ]}
                  />
                ))}
              </View>
              
              {currentStep < TUTORIAL_STEPS.length - 1 && (
                <Pressable 
                  style={[styles.navButton, { right: 10 }]} 
                  onPress={nextStep}
                >
                  <FontAwesome name="chevron-right" size={24} color="#4A90E2" />
                </Pressable>
              )}
            </View>

            {currentStep === TUTORIAL_STEPS.length - 1 && (
              <Pressable 
                style={styles.tutorialButton} 
                onPress={handleTutorialComplete}
              >
                <Text style={styles.tutorialButtonText}>
                  Get Started!
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </Modal>
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
  appName: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  iconContainer: {
    position: 'relative',
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  cartIcon: {
    marginBottom: 0,
    transform: [{scale: 1.1}],
  },
  markerContainer: {
    position: 'absolute',
    top: -15,
    right: -5,
    zIndex: 2,
  },
  markerBackground: {
    backgroundColor: 'white',
    borderRadius: 25,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  markerShadow: {
    position: 'absolute',
    top: -25,
    right: -25,
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(74, 144, 226, 0.15)',
    zIndex: 1,
  },
  subtitle: {
    fontSize: 20,
    color: '#666',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 28,
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
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 25,
    width: '85%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  tutorialTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  tutorialDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 25,
    lineHeight: 22,
  },
  tutorialButton: {
    backgroundColor: '#4A90E2',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
  },
  tutorialButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  tutorialProgress: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#DDD',
  },
  progressDotActive: {
    backgroundColor: '#4A90E2',
    width: 16,
  },
  helpButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 1,
  },
  helpButtonText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  helpArrowContainer: {
    position: 'absolute',
    top: 95,
    right: 25,
    alignItems: 'flex-end',
    zIndex: 1,
  },
  helpArrowText: {
    color: '#4A90E2',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  arrow: {
    fontSize: 24,
    marginRight: 15,
  },
  navigationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 30,
    position: 'relative',
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
  },
});
