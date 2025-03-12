import { StyleSheet, View, Text, Pressable, Modal, Switch, SafeAreaView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Link } from 'expo-router';

// Theme context
type ThemeContextType = {
  isAccessibleMode: boolean;
  toggleTheme: () => void;
  primaryColor: string;
  buttonSize: string;
  setButtonSize: (size: string) => void;
};

const ThemeContext = createContext<ThemeContextType>({
  isAccessibleMode: false,
  toggleTheme: () => {},
  primaryColor: '#4A90E2',
  buttonSize: 'medium',
  setButtonSize: () => {},
});

export const useTheme = () => useContext(ThemeContext);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isAccessibleMode, setIsAccessibleMode] = useState(false);
  const [buttonSize, setButtonSize] = useState('medium');
  
  // Load theme preference from storage
  useEffect(() => {
    const loadThemePreference = async () => {
      try {
        const storedTheme = await AsyncStorage.getItem('isAccessibleMode');
        if (storedTheme !== null) {
          setIsAccessibleMode(storedTheme === 'true');
        }
        
        const storedButtonSize = await AsyncStorage.getItem('buttonSize');
        if (storedButtonSize) {
          setButtonSize(storedButtonSize);
        }
      } catch (error) {
        console.error('Error loading preferences:', error);
      }
    };
    
    loadThemePreference();
  }, []);
  
  // Save theme preference to storage
  const toggleTheme = async () => {
    try {
      const newMode = !isAccessibleMode;
      setIsAccessibleMode(newMode);
      await AsyncStorage.setItem('isAccessibleMode', newMode.toString());
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  };
  
  const updateButtonSize = async (size: string) => {
    try {
      setButtonSize(size);
      await AsyncStorage.setItem('buttonSize', size);
    } catch (error) {
      console.error('Error saving button size:', error);
    }
  };
  
  // Primary color based on theme
  const primaryColor = isAccessibleMode ? '#00FFFF' : '#4A90E2';
  
  return (
    <ThemeContext.Provider value={{ 
      isAccessibleMode, 
      toggleTheme, 
      primaryColor,
      buttonSize,
      setButtonSize: updateButtonSize
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

const TUTORIAL_STEPS = [
  {
    title: "Welcome to NaviCart! 🛒",
    description: "Let's learn how to use the app in a few simple steps."
  },
  {
    title: "Adding Items ➕",
    description: "Speak or type your grocery item in the input box and tap the + button or press enter."
  },
  {
    title: "Managing Items ✅",
    description: "Tap any item to mark it as complete. Long press to delete it from your list."
  },
  {
    title: "Smart Categories 🤖",
    description: "By leverging AI, your items are automatically sorted into categories like Produce, Dairy, Meat, etc. This helps you shop more efficiently!"
  },
  {
    title: "Real-time Sync 🔄",
    description: "Your list updates in real-time across all your devices. Changes are saved automatically!"
  },
  {
    title: "Efficient Navigation 🛍️",
    description: "Our AI will navigate you to the item in the store. Just follow the directions and you'll be done in no time!"
  }
];

export default function HomeScreen() {
  const router = useRouter();
  const [showTutorial, setShowTutorial] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const { isAccessibleMode, toggleTheme, primaryColor, buttonSize, setButtonSize } = useTheme();

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

  const speakTutorialContent = async () => {
    // Remove emojis from title and description using regex
    const cleanTitle = TUTORIAL_STEPS[currentStep].title.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2700}-\u{27BF}]|[\u{2600}-\u{26FF}]/gu, '').trim();
    const cleanDescription = TUTORIAL_STEPS[currentStep].description.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2700}-\u{27BF}]|[\u{2600}-\u{26FF}]/gu, '').trim();
    const content = `${cleanTitle}. ${cleanDescription}`;
    
    if (isSpeaking) {
      await Speech.stop();
      setIsSpeaking(false);
    } else {
      setIsSpeaking(true);
      await Speech.speak(content, {
        onDone: () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false),
      });
    }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  useEffect(() => {
    Speech.stop();
    setIsSpeaking(false);
  }, [currentStep]);

  return (
    <SafeAreaView style={[styles.safeArea, isAccessibleMode && styles.safeAreaAccessible]}>
      <View style={[styles.container, isAccessibleMode && styles.containerAccessible]}>
        <Pressable 
          style={[
            styles.helpButton,
            { backgroundColor: primaryColor }
          ]}
          onPress={() => {
            setCurrentStep(0);
            setShowTutorial(true);
          }}
        >
          <Text style={styles.helpButtonText}>?</Text>
        </Pressable>

        <Pressable 
          style={[
            styles.settingsButton,
            { backgroundColor: primaryColor }
          ]}
          onPress={() => setShowSettings(true)}
        >
          <FontAwesome name="gear" size={36} color="white" />
        </Pressable>

        <View style={styles.contentContainer}>
          <View style={styles.welcomeContainer}>
            <Text style={[styles.welcomeText, isAccessibleMode && styles.welcomeTextAccessible]}>Welcome to</Text>
            <Text style={[styles.appName, isAccessibleMode && styles.appNameAccessible]}>NaviCart</Text>
            <Text style={[styles.subtitle, isAccessibleMode && styles.subtitleAccessible]}>
              Simplify your shopping experience{'\n'}with smart navigation
            </Text>
          </View>
          
          <View style={styles.buttonContainer}>
            <Pressable 
              style={[
                styles.createButton,
                { 
                  backgroundColor: isAccessibleMode ? '#00FFFF' : '#5B9AE8',
                  borderWidth: isAccessibleMode ? 2 : 0,
                  borderColor: '#FFFFFF',
                  shadowColor: isAccessibleMode ? '#00FFFF' : '#000',
                  shadowOpacity: isAccessibleMode ? 0.8 : 0.4,
                  shadowRadius: isAccessibleMode ? 10 : 6,
                  height: buttonSize === 'large' ? 90 : buttonSize === 'medium' ? 80 : 70,
                  borderRadius: buttonSize === 'large' ? 45 : buttonSize === 'medium' ? 40 : 35,
                }
              ]}
              onPress={() => router.push('/list')}
            >
              <Text style={[
                styles.createButtonText,
                isAccessibleMode && { color: '#000' },
                { 
                  fontSize: buttonSize === 'large' ? 30 : buttonSize === 'medium' ? 26 : 22,
                  fontWeight: buttonSize === 'large' ? '800' : buttonSize === 'medium' ? '700' : '600',
                }
              ]}>
                Create Grocery List
              </Text>
            </Pressable>
          </View>
        </View>

        <Modal
          animationType="slide"
          transparent={true}
          visible={showTutorial}
          onRequestClose={handleTutorialComplete}
        >
          <Pressable 
            style={styles.modalContainer} 
            onPress={handleTutorialComplete}
          >
            <Pressable 
              style={[styles.modalContent, isAccessibleMode && styles.modalContentAccessible]} 
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.tutorialHeader}>
                <Text style={[styles.tutorialTitle, isAccessibleMode && styles.tutorialTitleAccessible]}>
                  {currentStep + 1}. {TUTORIAL_STEPS[currentStep].title}
                </Text>
                <Pressable 
                  style={styles.speakerButton} 
                  onPress={speakTutorialContent}
                >
                  <FontAwesome 
                    name={isSpeaking ? "volume-up" : "volume-off"} 
                    size={24} 
                    color={primaryColor} 
                  />
                </Pressable>
              </View>
              <Text style={[styles.tutorialDescription, isAccessibleMode && styles.tutorialDescriptionAccessible]}>
                {TUTORIAL_STEPS[currentStep].description}
              </Text>
              
              <View style={styles.navigationContainer}>
                {currentStep > 0 && (
                  <Pressable 
                    style={[styles.navButton, isAccessibleMode && styles.navButtonAccessible, { left: 10 }]} 
                    onPress={prevStep}
                  >
                    <FontAwesome name="chevron-left" size={24} color={primaryColor} />
                  </Pressable>
                )}
                
                <View style={styles.tutorialProgress}>
                  {TUTORIAL_STEPS.map((_, index) => (
                    <View
                      key={index}
                      style={[
                        styles.progressDot,
                        isAccessibleMode && styles.progressDotAccessible,
                        index === currentStep && [styles.progressDotActive, { backgroundColor: primaryColor }]
                      ]}
                    />
                  ))}
                </View>
                
                {currentStep < TUTORIAL_STEPS.length - 1 && (
                  <Pressable 
                    style={[styles.navButton, isAccessibleMode && styles.navButtonAccessible, { right: 10 }]} 
                    onPress={nextStep}
                  >
                    <FontAwesome name="chevron-right" size={24} color={primaryColor} />
                  </Pressable>
                )}
              </View>

              {currentStep === TUTORIAL_STEPS.length - 1 && (
                <Pressable 
                  style={[styles.tutorialButton, { backgroundColor: primaryColor }]} 
                  onPress={handleTutorialComplete}
                >
                  <Text style={styles.tutorialButtonText}>
                    Get Started!
                  </Text>
                </Pressable>
              )}
            </Pressable>
          </Pressable>
        </Modal>

        {/* Settings Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={showSettings}
          onRequestClose={() => setShowSettings(false)}
        >
          <Pressable 
            style={styles.modalContainer} 
            onPress={() => setShowSettings(false)}
          >
            <Pressable 
              style={[styles.modalContent, isAccessibleMode && styles.modalContentAccessible]} 
              onPress={(e) => e.stopPropagation()}
            >
              <Text style={[styles.modalTitle, isAccessibleMode && styles.modalTitleAccessible]}>
                Settings
              </Text>
              
              <View style={styles.settingRow}>
                <Text style={[styles.settingLabel, isAccessibleMode && styles.settingLabelAccessible]}>
                  High Contrast Mode
                </Text>
                <Switch
                  value={isAccessibleMode}
                  onValueChange={toggleTheme}
                  trackColor={{ false: '#767577', true: '#81b0ff' }}
                  thumbColor={isAccessibleMode ? '#00FFFF' : '#f4f3f4'}
                  ios_backgroundColor="#3e3e3e"
                  style={{ transform: [{ scaleX: 1.3 }, { scaleY: 1.3 }] }}
                />
              </View>
              
              <Text style={[styles.settingHeader, isAccessibleMode && styles.settingHeaderAccessible]}>
                Button Size
              </Text>
              
              <View style={styles.buttonSizeOptions}>
                <Pressable 
                  style={[
                    styles.sizeOption,
                    buttonSize === 'default' && [styles.sizeOptionSelected, { borderColor: primaryColor }]
                  ]}
                  onPress={() => {
                    setButtonSize('default');
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                >
                  <Text style={[
                    styles.sizeOptionText,
                    buttonSize === 'default' && { color: primaryColor },
                    isAccessibleMode && styles.sizeOptionTextAccessible
                  ]}>
                    Default
                  </Text>
                </Pressable>
                
                <Pressable 
                  style={[
                    styles.sizeOption,
                    buttonSize === 'medium' && [styles.sizeOptionSelected, { borderColor: primaryColor }]
                  ]}
                  onPress={() => {
                    setButtonSize('medium');
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                >
                  <Text style={[
                    styles.sizeOptionText,
                    buttonSize === 'medium' && { color: primaryColor },
                    isAccessibleMode && styles.sizeOptionTextAccessible
                  ]}>
                    Medium
                  </Text>
                </Pressable>
                
                <Pressable 
                  style={[
                    styles.sizeOption,
                    buttonSize === 'large' && [styles.sizeOptionSelected, { borderColor: primaryColor }]
                  ]}
                  onPress={() => {
                    setButtonSize('large');
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                >
                  <Text style={[
                    styles.sizeOptionText,
                    buttonSize === 'large' && { color: primaryColor },
                    isAccessibleMode && styles.sizeOptionTextAccessible
                  ]}>
                    Large
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  safeAreaAccessible: {
    backgroundColor: '#000',
  },
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  containerAccessible: {
    backgroundColor: '#000',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'space-between',
    paddingBottom: Platform.OS === 'ios' ? 100 : 80,
  },
  helpButton: {
    position: 'absolute',
    top: 20,
    left: 20,
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 8,
  },
  helpButtonText: {
    color: 'white',
    fontSize: 36,
    fontWeight: 'bold',
  },
  settingsButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 8,
  },
  welcomeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  welcomeText: {
    fontSize: 32,
    color: '#333',
    marginBottom: 8,
  },
  welcomeTextAccessible: {
    color: '#00FFFF',
  },
  appName: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  appNameAccessible: {
    color: '#00FFFF',
  },
  subtitle: {
    fontSize: 20,
    color: '#666',
    textAlign: 'center',
    lineHeight: 28,
  },
  subtitleAccessible: {
    color: '#00FFFF',
  },
  buttonContainer: {
    width: '100%',
    marginBottom: 20,
  },
  createButton: {
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
  createButtonText: {
    color: 'white',
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
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
    position: 'relative',
  },
  modalContentAccessible: {
    backgroundColor: '#333',
  },
  tutorialHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 15,
    position: 'relative',
  },
  tutorialTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    flex: 1,
    paddingHorizontal: 40,
  },
  tutorialTitleAccessible: {
    color: '#00FFFF',
  },
  tutorialDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 25,
    lineHeight: 22,
  },
  tutorialDescriptionAccessible: {
    color: '#aaa',
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
  progressDotAccessible: {
    backgroundColor: '#555',
  },
  progressDotActive: {
    backgroundColor: '#4A90E2',
    width: 16,
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
  navButtonAccessible: {
    backgroundColor: '#444',
  },
  navigationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 30,
    position: 'relative',
  },
  speakerButton: {
    position: 'absolute',
    right: 0,
    padding: 8,
  },
  modalTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 40,
  },
  modalTitleAccessible: {
    color: '#00FFFF',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 40,
  },
  settingLabel: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  settingLabelAccessible: {
    color: '#00FFFF',
  },
  settingHeader: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 25,
  },
  settingHeaderAccessible: {
    color: '#00FFFF',
  },
  buttonSizeOptions: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 40,
    justifyContent: 'center',
    width: '100%',
  },
  sizeOption: {
    width: 110,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#DDD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sizeOptionSelected: {
    borderWidth: 3,
  },
  sizeOptionText: {
    fontSize: 20,
    color: '#333',
    fontWeight: 'bold',
  },
  sizeOptionTextAccessible: {
    color: '#00FFFF',
  },
});
