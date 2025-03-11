import { useState, useEffect } from 'react';
import { StyleSheet, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Keyboard, Alert } from 'react-native';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { db } from '../../firebaseConfig';
import { collection, addDoc, query, onSnapshot, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import config from '../../config';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import * as Audio from 'expo-av';
import FontAwesome from '@expo/vector-icons/FontAwesome';

interface GroceryItem {
  id: string;
  text: string;
  completed: boolean;
  category: string;
}

// Food categories with common items
const FOOD_CATEGORIES: Record<string, readonly string[]> = {
  'Produce': [
    'apple', 'banana', 'orange', 'lettuce', 'tomato', 'carrot', 'onion', 'potato', 'broccoli', 'spinach',
    'cucumber', 'pepper', 'garlic', 'lemon', 'lime', 'avocado', 'celery', 'mushroom', 'zucchini', 'kale',
    'fresh herbs', 'fresh fruit', 'fresh vegetable'
  ],
  'Dairy': [
    'milk', 'cheese', 'yogurt', 'butter', 'cream', 'eggs', 'sour cream', 'cottage cheese', 'cream cheese',
    'half and half', 'whipped cream', 'heavy cream', 'almond milk', 'oat milk', 'soy milk'
  ],
  'Meat': [
    'chicken', 'beef', 'pork', 'turkey', 'ham', 'steak', 'ground beef', 'bacon', 'sausage', 'lamb',
    'ground turkey', 'ground pork', 'veal', 'duck', 'fresh meat', 'deli meat', 'hot dog', 'meatball'
  ],
  'Seafood': [
    'fish', 'salmon', 'tuna', 'shrimp', 'crab', 'lobster', 'scallop', 'mussel', 'clam', 'oyster',
    'tilapia', 'cod', 'halibut', 'fresh fish', 'fresh seafood', 'sushi grade', 'calamari', 'octopus'
  ],
  'Pantry': [
    'rice', 'pasta', 'bread', 'cereal', 'flour', 'sugar', 'oil', 'vinegar', 'sauce', 'spice',
    'seasoning', 'canned', 'dried', 'baking', 'condiment', 'syrup', 'honey', 'peanut butter',
    'jam', 'jelly', 'bean', 'lentil', 'grain'
  ],
  'Snacks': [
    'chips', 'cookies', 'crackers', 'nuts', 'candy', 'chocolate', 'popcorn', 'pretzel', 'granola bar',
    'protein bar', 'trail mix', 'dried fruit', 'gummy', 'snack'
  ],
  'Beverages': [
    'water', 'juice', 'soda', 'coffee', 'tea', 'beer', 'wine', 'alcohol', 'drink', 'sparkling water',
    'energy drink', 'sports drink', 'orange juice', 'apple juice', 'grape juice', 'coconut water'
  ],
  'Frozen': [
    'ice cream', 'frozen pizza', 'frozen vegetables', 'frozen fruit', 'frozen dinner', 'frozen meal',
    'frozen food', 'frozen', 'ice', 'popsicle', 'frozen yogurt', 'frozen meat', 'frozen fish'
  ],
  'Other': []
} as const;

type Category = keyof typeof FOOD_CATEGORIES;

const askAIForCategory = async (item: string): Promise<Category> => {
  console.log('🔍 Attempting to categorize:', item);
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent?key=${config.geminiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Categorize this grocery item: "${item}" into exactly one of these categories: Produce, Dairy, Meat, Seafood, Pantry, Snacks, Beverages, Frozen, Other. Reply with just the category name and nothing else.`
          }]
        }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 5,
          topP: 1,
          topK: 1
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ Gemini API error:', errorData);
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('📡 Raw API response:', JSON.stringify(data, null, 2));
    
    if (!data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      console.error('❌ Invalid response format:', data);
      throw new Error('Invalid API response format');
    }

    const suggestedCategory = data.candidates[0].content.parts[0].text.trim();
    console.log('🤖 AI suggested category:', suggestedCategory);
    
    // Clean up the response to match our categories
    const normalizedCategory = Object.keys(FOOD_CATEGORIES).find(
      cat => suggestedCategory.toLowerCase().includes(cat.toLowerCase())
    );

    console.log('✅ Final category:', normalizedCategory || 'Other', 
                normalizedCategory ? '(matched)' : '(fallback to Other)');

    return (normalizedCategory as Category) || 'Other';
  } catch (error) {
    console.error('❌ AI categorization failed:', error);
    // Fallback to basic categorization
    const lowercaseItem = item.toLowerCase();
    let fallbackCategory: Category = 'Other';
    
    if (lowercaseItem.includes('fresh') || lowercaseItem.includes('vegetable') || lowercaseItem.includes('fruit')) {
      fallbackCategory = 'Produce';
    } else if (lowercaseItem.includes('frozen')) {
      fallbackCategory = 'Frozen';
    } else if (lowercaseItem.includes('milk') || lowercaseItem.includes('cheese')) {
      fallbackCategory = 'Dairy';
    } else if (lowercaseItem.includes('fish') || lowercaseItem.includes('seafood') || 
               lowercaseItem.includes('shrimp') || lowercaseItem.includes('crab')) {
      fallbackCategory = 'Seafood';
    } else if (lowercaseItem.includes('meat') || lowercaseItem.includes('chicken') || 
               lowercaseItem.includes('beef') || lowercaseItem.includes('pork')) {
      fallbackCategory = 'Meat';
    }
    
    console.log('🔄 Using fallback categorization:', fallbackCategory);
    return fallbackCategory;
  }
};

const categorizeItem = async (text: string): Promise<Category> => {
  const lowercaseText = text.toLowerCase().trim();
  
  // Check for exact matches first
  for (const [category, items] of Object.entries(FOOD_CATEGORIES)) {
    if (items.includes(lowercaseText)) {
      return category as Category;
    }
  }
  
  // Check for compound words (e.g., "orange juice" should match "orange juice" in beverages, not "orange" in produce)
  for (const [category, items] of Object.entries(FOOD_CATEGORIES)) {
    const compoundMatch = items.find(item => 
      item.includes(' ') && lowercaseText.includes(item)
    );
    if (compoundMatch) {
      return category as Category;
    }
  }
  
  // Check for partial matches
  for (const [category, items] of Object.entries(FOOD_CATEGORIES)) {
    const partialMatch = items.find(item => 
      lowercaseText.includes(item) || 
      item.includes(lowercaseText)
    );
    if (partialMatch) {
      return category as Category;
    }
  }
  
  // If no match found, ask AI for help
  return await askAIForCategory(text);
};

export default function ListScreen() {
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [newItem, setNewItem] = useState('');
  const [isAddingItem, setIsAddingItem] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'groceryItems'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const itemsArr: GroceryItem[] = [];
      querySnapshot.forEach((doc) => {
        itemsArr.push({ id: doc.id, ...doc.data() } as GroceryItem);
      });
      
      // Sort items by category
      itemsArr.sort((a, b) => a.category.localeCompare(b.category));
      setItems(itemsArr);
    });

    return () => unsubscribe();
  }, []);

  const addItem = async () => {
    if (newItem.trim() === '' || isAddingItem) return;
    
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      setIsAddingItem(true);
      const category = await categorizeItem(newItem.trim());
      await addDoc(collection(db, 'groceryItems'), {
        text: newItem.trim(),
        completed: false,
        category,
      });
      setNewItem('');
      
      // Speak the added item
      Speech.speak(`Added ${newItem.trim()} to ${category}`, {
        language: 'en',
        pitch: 1,
        rate: 0.9,
        volume: 1,
      });
    } catch (error) {
      console.error('Error adding item:', error);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsAddingItem(false);
    }
  };

  const toggleItem = async (id: string, completed: boolean, text: string) => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const itemRef = doc(db, 'groceryItems', id);
      await updateDoc(itemRef, {
        completed: !completed,
      });

      // Speak when marking as completed or uncompleted
      Speech.speak(completed ? `Added back ${text}` : `Removed ${text}`, {
        language: 'en',
        pitch: 1,
        rate: 0.9,
        volume: 1,
      });
    } catch (error) {
      console.error('Error toggling item:', error);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const deleteItem = async (id: string) => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      await deleteDoc(doc(db, 'groceryItems', id));
    } catch (error) {
      console.error('Error deleting item:', error);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const clearAllItems = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      Alert.alert(
        "Clear All Items",
        "Are you sure you want to remove all items from your list?",
        [
          {
            text: "Cancel",
            style: "cancel"
          },
          {
            text: "Clear All",
            style: "destructive",
            onPress: async () => {
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              const batch = items.map(item => deleteDoc(doc(db, 'groceryItems', item.id)));
              await Promise.all(batch);
              Speech.speak("Cleared all items", {
                language: 'en',
                pitch: 1,
                rate: 0.9,
                volume: 1,
              });
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error clearing items:', error);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  // Group items by category
  const itemsByCategory = items.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, GroceryItem[]>);

  const showHelpAlert = () => {
    Alert.alert(
      "Text-to-Speech Help",
      "To hear items read aloud, make sure your device is not in silent mode and tap the speaker icon next to any category.",
      [{ text: "OK", style: "default" }]
    );
  };

  const speakItem = async (text: string, category: string) => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await Speech.speak(text, {
        language: 'en',
        pitch: 1,
        rate: 0.9,
        volume: 1,
      });
    } catch (error) {
      console.error('Error speaking item:', error);
    }
  };

  const speakCategoryItems = async (category: string, items: GroceryItem[]) => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const uncheckedItems = items.filter(item => !item.completed);
      
      if (uncheckedItems.length === 0) {
        Speech.speak(`No unchecked items in ${category}`, {
          language: 'en',
          pitch: 1,
          rate: 0.9,
          volume: 1,
        });
        return;
      }

      const itemsList = uncheckedItems.map(item => item.text).join(', ');
      Speech.speak(`${category} items: ${itemsList}`, {
        language: 'en',
        pitch: 1,
        rate: 0.9,
        volume: 1,
      });
    } catch (error) {
      console.error('Error speaking category items:', error);
    }
  };

  const deleteCategoryItems = async (category: string, items: GroceryItem[]) => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      Alert.alert(
        `Clear ${category}`,
        `Are you sure you want to remove all items from ${category}?`,
        [
          {
            text: "Cancel",
            style: "cancel"
          },
          {
            text: "Clear",
            style: "destructive",
            onPress: async () => {
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              const batch = items.map(item => deleteDoc(doc(db, 'groceryItems', item.id)));
              await Promise.all(batch);
              Speech.speak(`Cleared all items from ${category}`, {
                language: 'en',
                pitch: 1,
                rate: 0.9,
                volume: 1,
              });
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error clearing category items:', error);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
      keyboardVerticalOffset={100}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Shopping List</Text>
        <View style={styles.headerButtons}>
          <Pressable 
            style={styles.clearButton}
            onPress={clearAllItems}
          >
            <FontAwesome name="trash" size={20} color="#FF3B30" />
          </Pressable>
          <Pressable 
            style={styles.helpButton}
            onPress={showHelpAlert}
          >
            <FontAwesome name="question-circle" size={24} color="#4A90E2" />
          </Pressable>
        </View>
      </View>
      
      <ScrollView 
        style={styles.listContainer}
        keyboardShouldPersistTaps="handled"
      >
        {Object.entries(itemsByCategory).map(([category, categoryItems]) => (
          <View key={category} style={styles.categoryContainer}>
            <View style={styles.categoryHeader}>
              <Text style={styles.categoryTitle}>{category}</Text>
              <View style={styles.categoryActions}>
                <Pressable
                  style={styles.categoryButton}
                  onPress={() => speakCategoryItems(category, categoryItems)}
                >
                  <FontAwesome name="volume-up" size={16} color="#4A90E2" />
                </Pressable>
                <Pressable
                  style={styles.categoryButton}
                  onPress={() => deleteCategoryItems(category, categoryItems)}
                >
                  <FontAwesome name="trash" size={16} color="#FF3B30" />
                </Pressable>
              </View>
            </View>
            {categoryItems.map((item) => (
              <View key={item.id} style={styles.itemContainer}>
                <Pressable
                  style={[
                    styles.item,
                    item.completed && styles.itemCompleted
                  ]}
                  onPress={() => toggleItem(item.id, item.completed, item.text)}
                  onLongPress={() => deleteItem(item.id)}
                  onPressIn={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
                >
                  <Text style={[
                    styles.itemText,
                    item.completed && styles.itemTextCompleted
                  ]}>
                    {item.text}
                  </Text>
                </Pressable>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>

      <View style={styles.inputContainer}>
        <TextInput
          style={[
            styles.input,
            isAddingItem && styles.inputDisabled
          ]}
          value={newItem}
          onChangeText={setNewItem}
          placeholder="Add new item..."
          placeholderTextColor="#666"
          onSubmitEditing={addItem}
          editable={!isAddingItem}
        />
        <Pressable 
          style={[styles.addButton, isAddingItem && styles.addButtonDisabled]} 
          onPress={addItem}
          disabled={isAddingItem}
          onPressIn={() => !isAddingItem && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
        >
          {isAddingItem ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.addButtonText}>+</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    paddingTop: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    marginTop: 15,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  clearButton: {
    padding: 8,
  },
  helpButton: {
    padding: 8,
  },
  listContainer: {
    flex: 1,
    marginBottom: 20,
  },
  categoryContainer: {
    marginBottom: 15,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingLeft: 4,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4A90E2',
    marginRight: 10,
  },
  categoryActions: {
    flexDirection: 'row',
    gap: 8,
  },
  categoryButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  item: {
    backgroundColor: '#f0f0f0',
    padding: 16,
    borderRadius: 10,
    flex: 1,
  },
  itemCompleted: {
    backgroundColor: '#e8e8e8',
    opacity: 0.8,
  },
  itemText: {
    fontSize: 16,
    color: '#333',
  },
  itemTextCompleted: {
    textDecorationLine: 'line-through',
    color: '#666',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: Platform.OS === 'ios' ? 20 : 0,
  },
  input: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    padding: 16,
    borderRadius: 10,
    fontSize: 16,
    color: '#333',
  },
  addButton: {
    backgroundColor: '#4A90E2',
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '600',
    lineHeight: 28,
    textAlign: 'center',
    marginTop: 1,
  },
  inputDisabled: {
    opacity: 0.7,
  },
  addButtonDisabled: {
    opacity: 0.7,
  },
}); 