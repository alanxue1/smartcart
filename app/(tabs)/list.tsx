import { useState, useEffect } from 'react';
import { StyleSheet, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Keyboard, Alert } from 'react-native';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { db } from '../../firebaseConfig';
import { collection, addDoc, query, onSnapshot, deleteDoc, doc, updateDoc, getDocs, where } from 'firebase/firestore';
import config from '../../config';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import * as Audio from 'expo-av';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useTheme } from './index';

interface GroceryItem {
  id: string;
  text: string;
  completed: boolean;
  category: string;
  quantity: number;
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
    'jam', 'jelly', 'bean', 'lentil', 'grain', 'fish sauce', 'oyster sauce', 'soy sauce', 
    'hot sauce', 'tomato sauce', 'worcestershire sauce', 'BBQ sauce', 'teriyaki sauce', 
    'hoisin sauce', 'salsa', 'ketchup', 'mustard', 'mayo', 'mayonnaise', 'salt', 'pepper'
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

// Common compound terms that need special handling
const COMPOUND_TERMS: Record<string, Category> = {
  'fish sauce': 'Pantry',
  'oyster sauce': 'Pantry',
  'soy sauce': 'Pantry',
  'hot sauce': 'Pantry',
  'tomato sauce': 'Pantry',
  'pasta sauce': 'Pantry',
  'bbq sauce': 'Pantry',
  'barbecue sauce': 'Pantry',
  'worcestershire sauce': 'Pantry',
  'teriyaki sauce': 'Pantry',
  'hoisin sauce': 'Pantry',
  'chicken stock': 'Pantry',
  'beef stock': 'Pantry',
  'vegetable stock': 'Pantry',
  'chicken broth': 'Pantry',
  'beef broth': 'Pantry',
  'vegetable broth': 'Pantry',
  'coconut milk': 'Pantry',
  'tomato paste': 'Pantry',
  'tomato puree': 'Pantry',
  'chicken seasoning': 'Pantry',
  'beef seasoning': 'Pantry',
  'fish seasoning': 'Pantry',
  'taco seasoning': 'Pantry',
  'italian seasoning': 'Pantry',
  'cajun seasoning': 'Pantry',
};

type Category = keyof typeof FOOD_CATEGORIES;

// Simple exact match categorization 
const exactMatchCategory = (item: string): Category | null => {
  const lowercaseItem = item.toLowerCase().trim();
  
  // First check for exact compound terms
  for (const [term, category] of Object.entries(COMPOUND_TERMS)) {
    if (lowercaseItem === term) {
      console.log(`Exact compound term match: "${item}" → ${category}`);
      return category;
    }
  }
  
  // Next check for exact matches in categories
  for (const [category, keywords] of Object.entries(FOOD_CATEGORIES)) {
    if (category === 'Other') continue;
    
    if (keywords.includes(lowercaseItem)) {
      console.log(`Exact keyword match: "${item}" → ${category}`);
      return category as Category;
    }
  }
  
  // No exact match found
  return null;
};

const askAIForCategory = async (item: string): Promise<Category> => {
  console.log('🔍 Attempting to categorize with AI:', item);
  
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${config.geminiKey}`, {
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
    
    if (!data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      console.error('❌ Invalid response format:', data);
      throw new Error('Invalid API response format');
    }

    const suggestedCategory = data.candidates[0].content.parts[0].text.trim();
    console.log('🤖 AI suggested category:', suggestedCategory);
    
    // Clean up the response to match our categories
    const normalizedCategory = Object.keys(FOOD_CATEGORIES).find(
      cat => suggestedCategory.toLowerCase() === cat.toLowerCase()
    );

    console.log('✅ Final AI category:', normalizedCategory || 'Other');
    return (normalizedCategory as Category) || 'Other';
  } catch (error) {
    console.error('❌ AI categorization failed:', error);
    return 'Other';
  }
};

const categorizeItem = async (text: string): Promise<Category> => {
  // Try exact matching first
  const exactMatch = exactMatchCategory(text);
  if (exactMatch) {
    return exactMatch;
  }
  
  // If no exact match, ask AI
  const aiCategory = await askAIForCategory(text);
  
  // Use AI's response or fall back to Other
  return aiCategory;
};

export default function ListScreen() {
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [newItem, setNewItem] = useState('');
  const [isAddingItem, setIsAddingItem] = useState(false);
  const { isAccessibleMode, primaryColor, buttonSize } = useTheme();

  // Migrate existing items to add textLowercase field
  useEffect(() => {
    const migrateExistingItems = async () => {
      try {
        const q = query(collection(db, 'groceryItems'));
        const querySnapshot = await getDocs(q);
        
        const batch: Promise<void>[] = [];
        querySnapshot.forEach((docSnapshot) => {
          const data = docSnapshot.data();
          // Only update if textLowercase doesn't exist
          if (!data.textLowercase && data.text) {
            batch.push(
              updateDoc(doc(db, 'groceryItems', docSnapshot.id), {
                textLowercase: data.text.toLowerCase()
              })
            );
          }
        });
        
        if (batch.length > 0) {
          console.log(`Migrating ${batch.length} items to add textLowercase field`);
          await Promise.all(batch);
        }
        
        // After migration, check for and merge duplicates
        await mergeDuplicateItems();
      } catch (error) {
        console.error('Error migrating items:', error);
      }
    };
    
    // Function to detect and merge duplicate items
    const mergeDuplicateItems = async () => {
      try {
        console.log("Running initial duplicate check...");
        const snapshot = await getDocs(collection(db, 'groceryItems'));
        
        // Create a map of items grouped by their lowercase text
        const itemMap: Record<string, {id: string, quantity: number, doc: any}[]> = {};
        
        snapshot.forEach(doc => {
          const data = doc.data();
          if (!data.text) return;
          
          const textLower = data.text.toLowerCase();
          
          if (!itemMap[textLower]) {
            itemMap[textLower] = [];
          }
          
          itemMap[textLower].push({
            id: doc.id,
            quantity: data.quantity || 1,
            doc: data
          });
        });
        
        // Find and merge any duplicates
        const mergePromises: Promise<void>[] = [];
        
        Object.entries(itemMap).forEach(([textLower, items]) => {
          if (items.length > 1) {
            console.log(`Found ${items.length} duplicates for '${textLower}'`);
            
            // Keep the first item and add quantities from the rest
            const primaryItem = items[0];
            const duplicates = items.slice(1);
            
            let totalQuantity = primaryItem.quantity;
            
            // Add up quantities from duplicates
            duplicates.forEach(duplicate => {
              totalQuantity += duplicate.quantity;
            });
            
            // Update the primary item with total quantity
            mergePromises.push(
              updateDoc(doc(db, 'groceryItems', primaryItem.id), {
                quantity: totalQuantity,
                textLowercase: textLower // Ensure lowercase field exists
              })
            );
            
            // Delete all the duplicates
            duplicates.forEach(duplicate => {
              mergePromises.push(
                deleteDoc(doc(db, 'groceryItems', duplicate.id))
              );
            });
            
            console.log(`Merged items with total quantity: ${totalQuantity}`);
          }
        });
        
        if (mergePromises.length > 0) {
          await Promise.all(mergePromises);
          console.log(`Successfully merged ${mergePromises.length} operations during initial check`);
        } else {
          console.log("No duplicates found during initial check");
        }
      } catch (error) {
        console.error('Error merging duplicate items:', error);
      }
    };
    
    migrateExistingItems();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'groceryItems'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const itemsArr: GroceryItem[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        // Ensure quantity exists with a default of 1
        itemsArr.push({ 
          id: doc.id, 
          ...data,
          quantity: data.quantity || 1 
        } as GroceryItem);
      });
      
      // Sort items by category
      itemsArr.sort((a, b) => a.category.localeCompare(b.category));
      setItems(itemsArr);
    });

    // Run duplicate check when the component mounts
    checkAndMergeDuplicates();

    return () => unsubscribe();
  }, []);

  const addItem = async () => {
    if (newItem.trim() === '' || isAddingItem) return;
    
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      setIsAddingItem(true);
      
      // Check for duplicates (case-insensitive)
      const trimmedNewItem = newItem.trim();
      const lowerCaseNewItem = trimmedNewItem.toLowerCase();
      
      // First, check in our local items state which is faster
      const existingItem = items.find(item => 
        item.text.toLowerCase() === lowerCaseNewItem
      );
      
      if (existingItem) {
        // If item already exists, update its quantity instead of adding a new one
        const itemRef = doc(db, 'groceryItems', existingItem.id);
        const newQuantity = (existingItem.quantity || 1) + 1;
        
        await updateDoc(itemRef, {
          quantity: newQuantity,
          textLowercase: lowerCaseNewItem // Ensure this field exists
        });
        
        setNewItem('');
        
        // Speak feedback about incrementing quantity
        Speech.speak(`Added ${trimmedNewItem}. Now have ${newQuantity} in your list.`, {
          language: 'en',
          pitch: 1,
          rate: 0.9,
          volume: 1,
        });
      } else {
        // Add as a new item if no duplicate found
        const category = await categorizeItem(trimmedNewItem);
        await addDoc(collection(db, 'groceryItems'), {
          text: trimmedNewItem,
          textLowercase: lowerCaseNewItem, // Store lowercase version for easier searching
          completed: false,
          category,
          quantity: 1, // Default quantity
          timestamp: new Date().getTime()
        });
        setNewItem('');
        
        // Speak the added item with quantity
        Speech.speak(`Added 1 ${trimmedNewItem} to ${category}`, {
          language: 'en',
          pitch: 1,
          rate: 0.9,
          volume: 1,
        });
      }

      // Force a check for duplicates after adding
      setTimeout(() => {
        checkAndMergeDuplicates();
      }, 1000); // Small delay to ensure Firestore has updated
      
    } catch (error) {
      console.error('Error adding item:', error);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsAddingItem(false);
    }
  };

  // More aggressive duplicate checking that runs after every update
  const checkAndMergeDuplicates = async () => {
    try {
      console.log("Running duplicate check...");
      const snapshot = await getDocs(collection(db, 'groceryItems'));
      
      // Create a map of items grouped by their lowercase text
      const itemMap: Record<string, {id: string, quantity: number, doc: any}[]> = {};
      
      snapshot.forEach(doc => {
        const data = doc.data();
        if (!data.text) return;
        
        const textLower = data.text.toLowerCase();
        
        if (!itemMap[textLower]) {
          itemMap[textLower] = [];
        }
        
        itemMap[textLower].push({
          id: doc.id,
          quantity: data.quantity || 1,
          doc: data
        });
      });
      
      // Find and merge any duplicates
      const mergePromises: Promise<void>[] = [];
      
      Object.entries(itemMap).forEach(([textLower, items]) => {
        if (items.length > 1) {
          console.log(`Found ${items.length} duplicates for '${textLower}'`);
          
          // Keep the first item and add quantities from the rest
          const primaryItem = items[0];
          const duplicates = items.slice(1);
          
          let totalQuantity = primaryItem.quantity;
          
          // Add up quantities from duplicates
          duplicates.forEach(duplicate => {
            totalQuantity += duplicate.quantity;
          });
          
          // Update the primary item with total quantity
          mergePromises.push(
            updateDoc(doc(db, 'groceryItems', primaryItem.id), {
              quantity: totalQuantity,
              textLowercase: textLower // Ensure lowercase field exists
            })
          );
          
          // Delete all the duplicates
          duplicates.forEach(duplicate => {
            mergePromises.push(
              deleteDoc(doc(db, 'groceryItems', duplicate.id))
            );
          });
          
          console.log(`Merged items with total quantity: ${totalQuantity}`);
        }
      });
      
      if (mergePromises.length > 0) {
        await Promise.all(mergePromises);
        console.log(`Successfully merged ${mergePromises.length} operations`);
      } else {
        console.log("No duplicates found to merge");
      }
    } catch (error) {
      console.error("Error merging duplicates:", error);
    }
  };

  const toggleItem = async (id: string, completed: boolean, text: string, quantity: number) => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const itemRef = doc(db, 'groceryItems', id);
      await updateDoc(itemRef, {
        completed: !completed,
      });

      // Speak when marking as completed or uncompleted, including quantity
      const pluralText = quantity > 1 ? `${quantity} ${text}s` : `1 ${text}`;
      Speech.speak(completed ? `Added back ${pluralText}` : `Removed ${pluralText}`, {
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
              
              // Count total items before clearing
              const totalItems = items.length;
              
              const batch = items.map(item => deleteDoc(doc(db, 'groceryItems', item.id)));
              await Promise.all(batch);
              
              const totalMessage = totalItems === 1 ? '1 item' : `${totalItems} items`;
              Speech.speak(`Cleared ${totalMessage}`, {
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

  const updateQuantity = async (id: string, quantity: number, increment: boolean, itemText: string) => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      // Ensure we have a valid quantity to start with
      const currentQuantity = quantity || 1;
      const newQuantity = increment ? currentQuantity + 1 : Math.max(1, currentQuantity - 1);
      
      console.log(`Updating quantity for item ${id}: ${currentQuantity} → ${newQuantity}`);
      
      const itemRef = doc(db, 'groceryItems', id);
      await updateDoc(itemRef, {
        quantity: newQuantity,
      });
      
      // Provide voice feedback for quantity changes
      if (increment) {
        // When increasing quantity
        const message = newQuantity === 1 
          ? `Now 1 ${itemText}` 
          : `Now ${newQuantity} ${itemText}${newQuantity > 1 ? 's' : ''}`;
        
        Speech.speak(message, {
          language: 'en',
          pitch: 1,
          rate: 0.9,
          volume: 1,
        });
      } else if (currentQuantity > 1) {
        // Only speak when decreasing and not removing the last item
        const message = newQuantity === 1 
          ? `Now 1 ${itemText}` 
          : `Now ${newQuantity} ${itemText}${newQuantity > 1 ? 's' : ''}`;
        
        Speech.speak(message, {
          language: 'en',
          pitch: 1,
          rate: 0.9,
          volume: 1,
        });
      }
      // No speech when reducing from 1 to 1 (minimum quantity)
      
    } catch (error) {
      console.error('Error updating quantity:', error);
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
      "Shopping List Help",
      "• Tap items to mark as complete\n• Long press to delete items\n• Use + and - to adjust quantities\n• Use the trash icon to clear all items\n• Use the magic wand to remove duplicates",
      [{ text: "OK", style: "default" }]
    );
  };

  const showMagicWandHelp = () => {
    Alert.alert(
      "Clean Up Shopping List",
      "This will scan your list for any duplicate items and combine them into a single item with the total quantity. Would you like to clean up your list now?",
      [
        { 
          text: "Cancel", 
          style: "cancel" 
        },
        { 
          text: "Clean Up", 
          onPress: async () => {
            try {
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              await checkAndMergeDuplicates();
              Alert.alert("Success", "Your shopping list has been cleaned up.");
            } catch (error) {
              console.error('Error cleaning up list:', error);
              Alert.alert('Error', 'Failed to clean up shopping list');
            }
          }
        }
      ]
    );
  };

  const speakItem = async (text: string, quantity: number) => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const message = quantity === 1 ? `1 ${text}` : `${quantity} ${text}s`;
      await Speech.speak(message, {
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

      // Format each item with its quantity and proper pluralization
      const itemsList = uncheckedItems.map(item => {
        const quantity = item.quantity || 1;
        return quantity === 1 ? `1 ${item.text}` : `${quantity} ${item.text}s`;
      }).join(', ');
      
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
              
              // Create a summary of items being cleared with their quantities and proper pluralization
              const itemSummary = items.map(item => {
                const quantity = item.quantity || 1;
                return quantity === 1 ? `1 ${item.text}` : `${quantity} ${item.text}s`;
              }).join(', ');
              
              const batch = items.map(item => deleteDoc(doc(db, 'groceryItems', item.id)));
              await Promise.all(batch);
              
              Speech.speak(`Cleared ${items.length} items from ${category}: ${itemSummary}`, {
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
      style={[
        styles.container,
        { backgroundColor: isAccessibleMode ? '#111' : '#fff' },
        { paddingTop: Platform.OS === 'ios' ? 60 : 40 }
      ]}
      keyboardVerticalOffset={100}
    >
      <View style={styles.header}>
        <Text style={[styles.title, isAccessibleMode && styles.titleAccessible]}>Shopping List</Text>
        <View style={styles.headerButtons}>
          <Pressable 
            style={[styles.cleanUpButton, isAccessibleMode && styles.cleanUpButtonAccessible]}
            onPress={showMagicWandHelp}
          >
            <FontAwesome 
              name="magic" 
              size={32} 
              color={isAccessibleMode ? "#00FFFF" : primaryColor} 
            />
          </Pressable>
          <Pressable 
            style={[
              styles.clearButton,
              isAccessibleMode && styles.clearButtonAccessible
            ]}
            onPress={clearAllItems}
          >
            <FontAwesome 
              name="trash" 
              size={32} 
              color={isAccessibleMode ? "#FF00FF" : "#FF3B30"} 
            />
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
              <Text style={[styles.categoryTitle, { color: isAccessibleMode ? "#FF00FF" : primaryColor }]}>{category}</Text>
              <View style={styles.categoryActions}>
                <Pressable
                  style={[styles.categoryButton, isAccessibleMode && styles.categoryButtonAccessible]}
                  onPress={() => speakCategoryItems(category, categoryItems)}
                >
                  <FontAwesome name="volume-up" size={32} color={isAccessibleMode ? "#00FFFF" : primaryColor} />
                </Pressable>
                <Pressable
                  style={[styles.categoryButton, isAccessibleMode && styles.categoryButtonAccessible]}
                  onPress={() => deleteCategoryItems(category, categoryItems)}
                >
                  <FontAwesome name="trash" size={32} color={isAccessibleMode ? "#FF00FF" : "#FF3B30"} />
                </Pressable>
              </View>
            </View>
            {categoryItems.map((item, index) => (
              <View key={item.id} style={styles.itemContainer}>
                <View style={[
                  styles.itemWrapper,
                  isAccessibleMode && styles.itemWrapperAccessible,
                  item.completed && styles.itemCompleted,
                  item.completed && isAccessibleMode && styles.itemCompletedAccessible
                ]}>
                  <Pressable
                    style={styles.itemTextContainer}
                    onPress={() => toggleItem(item.id, item.completed, item.text, item.quantity || 1)}
                    onLongPress={() => deleteItem(item.id)}
                    onPressIn={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
                  >
                    <Text style={[
                      styles.itemText,
                      isAccessibleMode && styles.itemTextAccessible,
                      item.completed && styles.itemTextCompleted,
                      item.completed && isAccessibleMode && styles.itemTextCompletedAccessible
                    ]}>
                      {item.text}
                    </Text>
                  </Pressable>
                  
                  <View style={styles.quantityWrapper}>
                    <Pressable 
                      style={[
                        styles.quantityButton, 
                        isAccessibleMode ? styles.minusButtonAccessible : styles.minusButton,
                        { 
                          width: buttonSize === 'large' ? 56 : buttonSize === 'medium' ? 48 : 40,
                          height: buttonSize === 'large' ? 56 : buttonSize === 'medium' ? 48 : 40,
                          borderRadius: buttonSize === 'large' ? 14 : buttonSize === 'medium' ? 12 : 10
                        }
                      ]}
                      onPress={() => updateQuantity(item.id, item.quantity || 1, false, item.text)}
                    >
                      <Text style={[
                        styles.quantityButtonText,
                        { fontSize: buttonSize === 'large' ? 30 : buttonSize === 'medium' ? 26 : 22 }
                      ]}>-</Text>
                    </Pressable>
                    <View style={[
                      styles.quantityContainer, 
                      isAccessibleMode && styles.quantityContainerAccessible
                    ]}>
                      <Text style={[
                        styles.quantityText, 
                        { color: isAccessibleMode ? "#FF00FF" : primaryColor }
                      ]}>
                        {item.quantity || 1}
                      </Text>
                    </View>
                    <Pressable 
                      style={[
                        styles.quantityButton, 
                        isAccessibleMode ? styles.plusButtonAccessible : styles.plusButton,
                        { 
                          width: buttonSize === 'large' ? 64 : buttonSize === 'medium' ? 56 : 48,
                          height: buttonSize === 'large' ? 64 : buttonSize === 'medium' ? 56 : 48,
                          borderRadius: buttonSize === 'large' ? 32 : buttonSize === 'medium' ? 28 : 24
                        }
                      ]}
                      onPress={() => updateQuantity(item.id, item.quantity || 1, true, item.text)}
                    >
                      <Text style={[
                        styles.quantityButtonText,
                        { fontSize: buttonSize === 'large' ? 30 : buttonSize === 'medium' ? 26 : 22 }
                      ]}>+</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>

      <View style={styles.inputContainer}>
        <TextInput
          style={[
            styles.input,
            isAccessibleMode && styles.inputAccessible,
            isAddingItem && styles.inputDisabled
          ]}
          value={newItem}
          onChangeText={setNewItem}
          placeholder="Add new item..."
          placeholderTextColor={isAccessibleMode ? "#888" : "#666"}
          onSubmitEditing={addItem}
          editable={!isAddingItem}
        />
        <Pressable 
          style={[
            styles.addButton, 
            { 
              backgroundColor: isAccessibleMode ? "#00FFFF" : primaryColor,
              width: buttonSize === 'large' ? 84 : buttonSize === 'medium' ? 72 : 60,
              height: buttonSize === 'large' ? 84 : buttonSize === 'medium' ? 72 : 60,
              borderRadius: buttonSize === 'large' ? 42 : buttonSize === 'medium' ? 36 : 30,
            },
            isAddingItem && styles.addButtonDisabled
          ]} 
          onPress={addItem}
          disabled={isAddingItem}
          onPressIn={() => !isAddingItem && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
        >
          {isAddingItem ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={[
              styles.addButtonText,
              { fontSize: buttonSize === 'large' ? 44 : buttonSize === 'medium' ? 38 : 32 }
            ]}>+</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 10,
  },
  containerAccessible: {
    backgroundColor: '#111',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 10,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#333',
  },
  titleAccessible: {
    color: '#00FFFF',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  cleanUpButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  cleanUpButtonAccessible: {
    backgroundColor: '#222222',
    borderWidth: 2,
    borderColor: '#00FFFF',
    shadowColor: '#00FFFF',
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  clearButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  clearButtonAccessible: {
    backgroundColor: 'rgba(255, 0, 255, 0.2)',
    borderWidth: 2,
    borderColor: '#FF00FF',
    shadowColor: '#FF00FF',
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  listContainer: {
    flex: 1,
    marginBottom: 20,
  },
  categoryContainer: {
    marginBottom: 32,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    paddingLeft: 6,
  },
  categoryTitle: {
    fontSize: 26,
    fontWeight: '700',
    marginRight: 16,
  },
  categoryActions: {
    flexDirection: 'row',
    gap: 18,
  },
  categoryButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  categoryButtonAccessible: {
    backgroundColor: '#222222',
    borderWidth: 2,
    borderColor: '#00FFFF',
    shadowColor: '#FF00FF',
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 8,
  },
  itemContainer: {
    marginBottom: 22,
  },
  itemWrapper: {
    backgroundColor: '#e0e0e0',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingLeft: 20,
    paddingRight: 14,
    flexWrap: 'nowrap',
  },
  itemWrapperAccessible: {
    backgroundColor: '#222222',
    borderWidth: 1,
    borderColor: '#00FFFF',
  },
  itemTextContainer: {
    flex: 1,
    paddingVertical: 8,
    paddingRight: 10,
    maxWidth: '60%',
    minWidth: 0,
    overflow: 'hidden',
  },
  itemCompleted: {
    backgroundColor: '#c8c8c8',
    opacity: 0.8,
  },
  itemCompletedAccessible: {
    backgroundColor: '#333333',
    opacity: 0.8,
    borderColor: '#00FF00',
  },
  itemText: {
    fontSize: 20,
    color: '#333',
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  itemTextAccessible: {
    color: '#00FFFF',
  },
  itemTextCompleted: {
    textDecorationLine: 'line-through',
    color: '#666',
  },
  itemTextCompletedAccessible: {
    color: '#888888',
    textDecorationColor: '#00FF00',
  },
  quantityWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 140,
  },
  quantityContainer: {
    backgroundColor: 'rgba(74, 144, 226, 0.15)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    minWidth: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
  },
  quantityContainerAccessible: {
    backgroundColor: 'rgba(255, 0, 255, 0.2)',
    borderWidth: 1,
    borderColor: '#FF00FF',
  },
  quantityButton: {
    width: 52,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  minusButton: {
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    width: 48,
    height: 48,
  },
  minusButtonAccessible: {
    backgroundColor: '#FF00FF',
    borderRadius: 12,
    width: 48,
    height: 48,
  },
  plusButton: {
    backgroundColor: '#34C759',
    borderRadius: 26,
    width: 56,
    height: 56,
  },
  plusButtonAccessible: {
    backgroundColor: '#00FF00',
    borderRadius: 26,
    width: 56,
    height: 56,
  },
  quantityButtonText: {
    color: 'white',
    fontSize: 26,
    fontWeight: 'bold',
  },
  quantityText: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  itemNumber: {
    fontWeight: '600',
    color: '#4A90E2',
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
    padding: 20,
    borderRadius: 14,
    fontSize: 20,
    color: '#333',
  },
  inputAccessible: {
    backgroundColor: '#222222',
    color: '#00FFFF',
    borderWidth: 1,
    borderColor: '#00FFFF',
  },
  addButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 8,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
    lineHeight: 38,
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