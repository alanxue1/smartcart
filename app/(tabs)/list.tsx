import { useState, useEffect } from 'react';
import { StyleSheet, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { db } from '../../firebaseConfig';
import { collection, addDoc, query, onSnapshot, deleteDoc, doc, updateDoc } from 'firebase/firestore';

interface GroceryItem {
  id: string;
  text: string;
  completed: boolean;
  category: string;
}

// Food categories with common items
const FOOD_CATEGORIES = {
  'Produce': ['apple', 'banana', 'orange', 'lettuce', 'tomato', 'carrot', 'onion', 'potato', 'broccoli', 'spinach'],
  'Dairy': ['milk', 'cheese', 'yogurt', 'butter', 'cream', 'eggs'],
  'Meat': ['chicken', 'beef', 'pork', 'fish', 'salmon', 'turkey', 'ham'],
  'Pantry': ['rice', 'pasta', 'bread', 'cereal', 'flour', 'sugar', 'oil'],
  'Snacks': ['chips', 'cookies', 'crackers', 'nuts', 'candy'],
  'Beverages': ['water', 'juice', 'soda', 'coffee', 'tea'],
  'Frozen': ['ice cream', 'frozen pizza', 'frozen vegetables'],
  'Other': []
} as const;

type Category = keyof typeof FOOD_CATEGORIES;

const categorizeItem = (text: string): Category => {
  const lowercaseText = text.toLowerCase();
  
  for (const [category, items] of Object.entries(FOOD_CATEGORIES)) {
    if (items.some(item => lowercaseText.includes(item))) {
      return category as Category;
    }
  }
  
  return 'Other';
};

export default function ListScreen() {
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [newItem, setNewItem] = useState('');

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
    if (newItem.trim() === '') return;
    
    try {
      const category = categorizeItem(newItem.trim());
      await addDoc(collection(db, 'groceryItems'), {
        text: newItem.trim(),
        completed: false,
        category,
      });
      setNewItem('');
    } catch (error) {
      console.error('Error adding item:', error);
    }
  };

  const toggleItem = async (id: string, completed: boolean) => {
    try {
      const itemRef = doc(db, 'groceryItems', id);
      await updateDoc(itemRef, {
        completed: !completed,
      });
    } catch (error) {
      console.error('Error toggling item:', error);
    }
  };

  const deleteItem = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'groceryItems', id));
    } catch (error) {
      console.error('Error deleting item:', error);
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
    >
      <Text style={styles.title}>Grocery List</Text>
      
      <ScrollView style={styles.listContainer}>
        {Object.entries(itemsByCategory).map(([category, categoryItems]) => (
          <View key={category} style={styles.categoryContainer}>
            <Text style={styles.categoryTitle}>{category}</Text>
            {categoryItems.map((item) => (
              <Pressable
                key={item.id}
                style={[styles.item, item.completed && styles.itemCompleted]}
                onPress={() => toggleItem(item.id, item.completed)}
                onLongPress={() => deleteItem(item.id)}
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
          style={styles.input}
          value={newItem}
          onChangeText={setNewItem}
          placeholder="Add new item..."
          placeholderTextColor="#666"
          onSubmitEditing={addItem}
        />
        <Pressable style={styles.addButton} onPress={addItem}>
          <Text style={styles.addButtonText}>+</Text>
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
  },
  addButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
}); 