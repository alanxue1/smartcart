import { useState, useEffect } from 'react';
import { StyleSheet, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Keyboard } from 'react-native';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { db } from '../../firebaseConfig';
import { collection, addDoc, query, onSnapshot, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import config from '../../config';
import * as Haptics from 'expo-haptics';

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
    const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${config.geminiKey}`, {
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
    } catch (error) {
      console.error('Error adding item:', error);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsAddingItem(false);
    }
  };

  const toggleItem = async (id: string, completed: boolean) => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const itemRef = doc(db, 'groceryItems', id);
      await updateDoc(itemRef, {
        completed: !completed,
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

  // Group items by category
  const itemsByCategory = items.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, GroceryItem[]>);

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
      keyboardVerticalOffset={100}
    >
      <Text style={styles.title}>Grocery List</Text>
      
      <ScrollView 
        style={styles.listContainer}
        keyboardShouldPersistTaps="handled"
      >
        {Object.entries(itemsByCategory).map(([category, categoryItems]) => (
          <View key={category} style={styles.categoryContainer}>
            <Text style={styles.categoryTitle}>{category}</Text>
            {categoryItems.map((item) => (
              <Pressable
                key={item.id}
                style={[styles.item, item.completed && styles.itemCompleted]}
                onPress={() => toggleItem(item.id, item.completed)}
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
            ))}
          </View>
        ))}
      </ScrollView>

      <View style={styles.inputContainer}>
        <TextInput
          style={[styles.input, isAddingItem && styles.inputDisabled]}
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
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    marginTop: 40,
  },
  listContainer: {
    flex: 1,
    marginBottom: 20,
  },
  categoryContainer: {
    marginBottom: 20,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4A90E2',
    marginBottom: 10,
    paddingLeft: 4,
  },
  item: {
    backgroundColor: '#f0f0f0',
    padding: 16,
    borderRadius: 10,
    marginBottom: 10,
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