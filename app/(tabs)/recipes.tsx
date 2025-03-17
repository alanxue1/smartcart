import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../../firebaseConfig';
import { collection, addDoc, getDocs, doc, updateDoc, query, where, deleteDoc } from 'firebase/firestore';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import config from '../../config';
import { useTheme } from './index';

interface GroceryItem {
  id?: string;
  text: string;
  completed: boolean;
  category: string;
  quantity: number;
  timestamp?: number;
}

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
    'jam', 'jelly', 'bean', 'lentil', 'grain', 'pepper flakes', 'red pepper flakes', 'salt', 'black pepper'
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

// Maximum number of retries
const MAX_RETRIES = 3;

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
  
  // First try exact matching
  const exactMatch = exactMatchCategory(item);
  if (exactMatch) {
    return exactMatch;
  }
  
  let retries = 0;
  
  while (retries < MAX_RETRIES) {
    try {
      // Add delay based on retry count (exponential backoff)
      if (retries > 0) {
        const delayMs = Math.pow(2, retries) * 1000; // 2s, 4s, 8s...
        console.log(`Retry attempt ${retries}. Waiting ${delayMs/1000}s before retry...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
      
      const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash-lite:generateContent?key=${config.geminiKey}`, {
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
        
        // Check if it's a quota error
        if (response.status === 429) {
          console.log('Quota exceeded error. Will retry with backoff...');
          retries++;
          continue; // Retry with backoff
        }
        
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      
      // Success - exit the retry loop
      if (!data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        console.error('❌ Invalid response format:', data);
        throw new Error('Invalid API response format');
      }

      const suggestedCategory = data.candidates[0].content.parts[0].text.trim();
      console.log('🤖 AI suggested category:', suggestedCategory);

      if (Object.keys(FOOD_CATEGORIES).includes(suggestedCategory)) {
        return suggestedCategory as Category;
      } else {
        console.warn('⚠️ AI returned invalid category:', suggestedCategory);
        return 'Other';
      }
      
    } catch (error) {
      console.error(`❌ Error categorizing item (attempt ${retries+1}/${MAX_RETRIES}):`, error);
      retries++;
      
      // If we've exhausted retries, return Other
      if (retries >= MAX_RETRIES) {
        return 'Other';
      }
    }
  }
  
  // This should not be reached but TypeScript requires a return
  return 'Other';
};

const categorizeByRules = (item: string): Category => {
  // Redirect to our new exact matching function
  const exactMatch = exactMatchCategory(item);
  if (exactMatch) {
    return exactMatch;
  }
  
  // If no match found, just return Other
  return 'Other';
};

interface Ingredient {
  name: string;
  quantity: string;
  unit: string;
}

interface Recipe {
  name: string;
  ingredients: Ingredient[];
  instructions: string[];
}

// Add this function to clean preparation instructions from ingredient names
const cleanPreparationTerms = (name: string): string => {
  // List of common preparation terms to remove
  const prepTerms = [
    'chopped', 'diced', 'minced', 'sliced', 'cubed', 'julienned', 'shredded', 
    'grated', 'peeled', 'trimmed', 'finely', 'coarsely', 'thinly', 'roughly',
    'freshly', 'crushed', 'crumbled', 'ground', 'powdered', 'sifted', 
    'melted', 'softened', 'room temperature', 'chilled', 'frozen', 'thawed',
    'drained', 'rinsed', 'washed', 'cleaned', 'stemmed', 'pitted', 'seeded',
    'cored', 'blanched', 'boiled', 'steamed', 'roasted', 'toasted', 'sautéed',
    'fried', 'grilled', 'baked', 'zested', 'juiced'
  ];
  
  // Convert to lowercase for case-insensitive matching
  let cleanName = name.toLowerCase();
  
  // Remove preparation terms enclosed in parentheses
  cleanName = cleanName.replace(/\([^)]*\)/g, '').trim();
  
  // Remove each preparation term
  for (const term of prepTerms) {
    // Remove the term if it's surrounded by spaces or at the beginning/end
    // Use word boundaries to avoid removing parts of words
    cleanName = cleanName.replace(new RegExp(`\\b${term}\\b`, 'gi'), '');
  }
  
  // Clean up any double spaces and trim
  cleanName = cleanName.replace(/\s+/g, ' ').trim();
  
  // If the first character is a comma or other punctuation, remove it
  cleanName = cleanName.replace(/^[,;:\s]+/, '');
  
  // If there's a comma followed by preparation terms, remove everything after the comma
  if (cleanName.includes(',')) {
    cleanName = cleanName.split(',')[0].trim();
  }
  
  // Capitalize first letter
  if (cleanName.length > 0) {
    cleanName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
  }
  
  return cleanName || name; // Return original if we've removed everything
};

// Add this function to clean up ingredient names for shopping lists
const normalizeIngredientForShopping = (ingredient: Ingredient): { text: string, quantity: number } => {
  // Clean the name first to remove preparation instructions
  const cleanedName = cleanPreparationTerms(ingredient.name.trim());
  const quantity = ingredient.quantity.trim();
  const unit = ingredient.unit.trim().toLowerCase();
  
  // Small measurement units that don't make sense for shopping
  const smallUnits = ['tsp', 'teaspoon', 'teaspoons', 'tbsp', 'tablespoon', 'tablespoons', 
    'pinch', 'dash', 'to taste', 'cup', 'cups', 'ounce', 'ounces', 'oz', 'fluid ounce', 'fl oz'];
  
  // Common grocery items that are typically bought in standard packaging
  const commonItems = [
    { term: 'milk', unit: 'gallon', defaultQuantity: 1 },
    { term: 'egg', unit: 'dozen', defaultQuantity: 1 },
    { term: 'butter', unit: 'stick', defaultQuantity: 1 },
    { term: 'sugar', unit: 'bag', defaultQuantity: 1 },
    { term: 'flour', unit: 'bag', defaultQuantity: 1 },
    { term: 'salt', unit: 'container', defaultQuantity: 1 },
    { term: 'pepper', unit: 'container', defaultQuantity: 1 },
    { term: 'oil', unit: 'bottle', defaultQuantity: 1 },
    { term: 'vanilla extract', unit: 'bottle', defaultQuantity: 1 },
    { term: 'cream', unit: 'carton', defaultQuantity: 1 },
    { term: 'yogurt', unit: 'container', defaultQuantity: 1 },
    { term: 'pie crust', unit: 'package', defaultQuantity: 1 },
    { term: 'pasta', unit: 'box', defaultQuantity: 1 },
    { term: 'rice', unit: 'bag', defaultQuantity: 1 },
    { term: 'red pepper flakes', unit: 'container', defaultQuantity: 1 },
  ];
  
  // Check if the ingredient is a common grocery item
  for (const item of commonItems) {
    if (cleanedName.toLowerCase().includes(item.term)) {
      // For common items, just return the name without measurements
      return { text: cleanedName, quantity: item.defaultQuantity };
    }
  }
  
  // Check if the unit is one we want to remove from shopping list
  if (smallUnits.includes(unit)) {
    // Remove the small measurement unit and quantity
    return { text: cleanedName, quantity: 1 };
  }
  
  try {
    // Handle fractions like 1/4, 1/2, etc.
    let parsedQuantity = 0;
    
    if (quantity.includes('/')) {
      // Handle fractions like "1/4" or "1/2"
      const fractionParts = quantity.split('/');
      if (fractionParts.length === 2) {
        const numerator = parseFloat(fractionParts[0].replace(/[^\d.-]/g, ''));
        const denominator = parseFloat(fractionParts[1].replace(/[^\d.-]/g, ''));
        
        if (!isNaN(numerator) && !isNaN(denominator) && denominator !== 0) {
          parsedQuantity = numerator / denominator;
        }
      }
    } else if (quantity.includes('½')) {
      // Handle special fraction characters
      parsedQuantity = quantity.includes('1') ? 1.5 : 0.5;
    } else if (quantity.includes('¼')) {
      parsedQuantity = quantity.includes('3') ? 0.75 : 0.25;
    } else if (quantity.includes('¾')) {
      parsedQuantity = 0.75;
    } else if (quantity.includes('⅓')) {
      parsedQuantity = quantity.includes('2') ? 0.67 : 0.33;
    } else if (quantity.includes('⅔')) {
      parsedQuantity = 0.67;
    } else {
      // Try to parse the quantity as a number
      parsedQuantity = parseFloat(quantity.replace(/[^\d.-]/g, ''));
    }
    
    // Ensure we have a valid quantity
    if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
      parsedQuantity = 1;
    }
    
    // For quantities less than 1 (like 1/4, 1/2, etc.) round up to 1 for shopping list
    if (parsedQuantity < 1) {
      parsedQuantity = 1;
    } else {
      // Round to nearest whole number for shopping list
      parsedQuantity = Math.round(parsedQuantity);
    }
    
    if (['lb', 'pound', 'pounds'].includes(unit)) {
      // For meat and items typically sold by weight
      return { 
        text: `${cleanedName} (${quantity} ${unit})`, 
        quantity: 1 
      };
    } else if (['whole', 'medium', 'large', 'small', ''].includes(unit) && parsedQuantity >= 1) {
      // For count-based items (apples, onions, etc.)
      return { 
        text: cleanedName, 
        quantity: parsedQuantity 
      };
    }
  } catch (e) {
    console.log('Error parsing quantity:', e);
  }
  
  // Default fallback: just the cleaned name, quantity of 1
  return { text: cleanedName, quantity: 1 };
};

// Simple helper to check if two food items match, handling singular/plural forms
const ingredientMatches = (ingredient: string, pantryItem: string): boolean => {
  // Convert both to lowercase for case-insensitive matching
  const ing = ingredient.toLowerCase();
  const pantry = pantryItem.toLowerCase();
  
  // Direct includes check (handles partial matches)
  if (ing.includes(pantry) || pantry.includes(ing)) {
    return true;
  }
  
  // Handle common plurals (ending with 's' or 'ies')
  const singularIng = ing.endsWith('ies') 
    ? ing.slice(0, -3) + 'y'  // berries -> berry
    : ing.endsWith('s') 
      ? ing.slice(0, -1)      // apples -> apple
      : ing;
  
  const singularPantry = pantry.endsWith('ies')
    ? pantry.slice(0, -3) + 'y'
    : pantry.endsWith('s')
      ? pantry.slice(0, -1)
      : pantry;
  
  // Check with singular forms
  return singularIng.includes(singularPantry) || singularPantry.includes(singularIng);
};

// Define ingredient components that come from the same source
const INGREDIENT_COMPONENTS: Record<string, string[]> = {
  'egg': ['egg white', 'egg whites', 'egg yolk', 'egg yolks', 'whole egg', 'whole eggs'],
  'lemon': ['lemon zest', 'lemon juice', 'lemon peel'],
  'lime': ['lime zest', 'lime juice', 'lime peel'],
  'orange': ['orange zest', 'orange juice', 'orange peel'],
  'onion': ['onion top', 'onion tops', 'green onion', 'green onions'],
  'milk': ['milk foam', 'milk froth'],
  'tomato': ['tomato paste', 'tomato puree', 'tomato sauce', 'tomato juice']
};

// Check if two ingredients are components of the same source product
const areRelatedComponents = (item1: string, item2: string): boolean => {
  const item1Lower = item1.toLowerCase();
  const item2Lower = item2.toLowerCase();
  
  // Check if these items are components of the same source
  for (const [source, components] of Object.entries(INGREDIENT_COMPONENTS)) {
    const isComponent1 = components.some(comp => item1Lower.includes(comp)) || item1Lower.includes(source);
    const isComponent2 = components.some(comp => item2Lower.includes(comp)) || item2Lower.includes(source);
    
    if (isComponent1 && isComponent2) {
      return true;
    }
  }
  
  return false;
};

// Add the duplicate checking function
const checkAndMergeDuplicates = async () => {
  try {
    console.log("Running duplicate check...");
    const snapshot = await getDocs(collection(db, 'groceryItems'));
    
    // Create a map of items grouped by their lowercase text
    const itemMap: Record<string, {id: string, quantity: number, text: string, doc: any}[]> = {};
    
    snapshot.forEach(doc => {
      const data = doc.data();
      if (!data.text) return;
      
      const textLower = data.text.toLowerCase();
      
      if (!itemMap[textLower]) {
        itemMap[textLower] = [];
      }
      
      itemMap[textLower].push({
        id: doc.id,
        text: data.text,
        quantity: data.quantity || 1,
        doc: data
      });
    });
    
    // Find and merge any duplicates
    const mergePromises: Promise<void>[] = [];
    
    // First pass: merge exact duplicates (same text)
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
    
    // Second pass: look for component ingredients (like egg whites and egg yolks)
    const processedGroups = new Set<string>();
    
    // Flatten all items into a single array
    const allItems = Object.values(itemMap).flat();
    
    // Group related components
    for (let i = 0; i < allItems.length; i++) {
      const item = allItems[i];
      
      // Skip already processed items
      if (processedGroups.has(item.id)) continue;
      
      const relatedItems = [item];
      
      // Find all related components
      for (let j = i + 1; j < allItems.length; j++) {
        const otherItem = allItems[j];
        
        // Skip already processed items
        if (processedGroups.has(otherItem.id)) continue;
        
        if (areRelatedComponents(item.text, otherItem.text)) {
          relatedItems.push(otherItem);
          processedGroups.add(otherItem.id);
        }
      }
      
      // If we found related components, merge them
      if (relatedItems.length > 1) {
        processedGroups.add(item.id);
        
        console.log(`Found ${relatedItems.length} related components:`, relatedItems.map(i => i.text).join(', '));
        
        // Find the most generic name (usually the shortest and most basic)
        // Sort by length to find the most basic term
        relatedItems.sort((a, b) => a.text.length - b.text.length);
        
        let genericName = relatedItems[0].text;
        let totalQuantity = 0;
        
        // Look for the base ingredient name
        for (const component of relatedItems) {
          for (const [source, _] of Object.entries(INGREDIENT_COMPONENTS)) {
            if (component.text.toLowerCase().includes(source)) {
              // If it's a pure base ingredient, prefer using that name
              if (component.text.toLowerCase() === source) {
                genericName = component.text;
                break;
              }
              // Otherwise consider it as a candidate
              else if (genericName.length > source.length) {
                genericName = source.charAt(0).toUpperCase() + source.slice(1);
              }
            }
          }
          
          totalQuantity += component.quantity;
        }
        
        // If it's more than 1, append (for components) to indicate this represents multiple components
        if (relatedItems.length > 1) {
          genericName = `${genericName} (for recipe components)`;
        }
        
        // Create a new item with the merged quantities and generic name
        const docRef = await addDoc(collection(db, 'groceryItems'), {
          text: genericName,
          textLowercase: genericName.toLowerCase(),
          completed: false,
          category: relatedItems[0].doc.category || 'Other', // Keep the category from the first item
          quantity: totalQuantity,
          timestamp: new Date().getTime()
        });
        
        console.log(`Created merged item: ${genericName} with quantity ${totalQuantity}`);
        
        // Delete all the component items
        for (const component of relatedItems) {
          mergePromises.push(
            deleteDoc(doc(db, 'groceryItems', component.id))
          );
        }
      }
    }
    
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

export default function RecipeScreen() {
  const { isAccessibleMode, primaryColor } = useTheme();
  const [query, setQuery] = useState('');
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(false);
  const [pantryItems, setPantryItems] = useState<string[]>([]);
  const [pantryItem, setPantryItem] = useState('');
  const [showInstructions, setShowInstructions] = useState(false);
  const [speechAvailable, setSpeechAvailable] = useState(false);
  const [speechQueue, setSpeechQueue] = useState<string[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Helper function to speak with debug feedback
  const speakWithFeedback = useCallback((text: string, options = {}) => {
    // Remove visual debug feedback
    
    // Stop any existing speech
    Speech.stop();
    
    // Add a small delay before speaking
    setTimeout(() => {
      Speech.speak(text, {
        language: 'en',
        rate: 0.8,
        pitch: 1,
        ...options
      });
    }, 100);
  }, []);

  // Process the speech queue
  useEffect(() => {
    const processQueue = async () => {
      // If already speaking or queue is empty, do nothing
      if (isSpeaking || speechQueue.length === 0) return;
      
      try {
        setIsSpeaking(true);
        const textToSpeak = speechQueue[0];
        
        // Use a direct speech call with a promise
        await new Promise<void>((resolve, reject) => {
          // First stop any ongoing speech
          Speech.stop();
          
          // Wait a small amount of time to ensure speech has stopped
          setTimeout(() => {
            // Then speak the new text
            Speech.speak(textToSpeak, {
              language: 'en',
              pitch: 1,
              rate: 0.8,
              onDone: () => {
                resolve();
              },
              onError: (error) => {
                console.error('Speech error:', error);
                reject(error);
              }
            });
          }, 100);
        });
      } catch (error) {
        console.error('Error in speech queue:', error);
      } finally {
        // Remove the spoken item from the queue and mark as not speaking
        setSpeechQueue(prev => prev.slice(1));
        setIsSpeaking(false);
      }
    };
    
    processQueue();
  }, [speechQueue, isSpeaking]);

  // Helper function to add speech to the queue
  const queueSpeech = useCallback((text: string) => {
    setSpeechQueue(prev => [...prev, text]);
  }, []);

  // Initialize speech module on component mount with a direct test
  useEffect(() => {
    // Clean up any speech when component unmounts
    return () => {
      Speech.stop();
    };
  }, []);

  const getRecipe = useCallback(async () => {
    if (!query.trim()) {
      speakWithFeedback('Please enter a recipe to search for');
      Alert.alert('Empty Query', 'Please enter a recipe to search for');
      return;
    }

    setLoading(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    // Give a short delay before speaking to ensure UI has updated
    setTimeout(() => {
      speakWithFeedback(`Searching for ${query} recipe`);
    }, 300);

    let retries = 0;
    
    while (retries < MAX_RETRIES) {
      try {
        // Add delay based on retry count (exponential backoff)
        if (retries > 0) {
          const delayMs = Math.pow(2, retries) * 1000; // 2s, 4s, 8s...
          console.log(`Retry attempt ${retries}. Waiting ${delayMs/1000}s before retry...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
        
        const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash-lite:generateContent?key=${config.geminiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `Create a recipe for "${query}". 
                
Return ONLY a valid JSON object with the EXACT following structure without any markdown formatting, explanation or additional text:
{
  "name": "Recipe Name",
  "ingredients": [
    {"name": "ingredient1", "quantity": "amount1", "unit": "unit1"},
    {"name": "ingredient2", "quantity": "amount2", "unit": "unit2"}
  ],
  "instructions": ["Step 1", "Step 2", "Step 3"]
}

Keep the recipe simple, with common ingredients, and make it suitable for 1-2 people. 
Make sure the JSON is valid and can be parsed directly with JSON.parse() in JavaScript.
Do not include any text, markdown formatting, or code blocks outside the JSON.`
              }]
            }],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 2048,
              topP: 0.8,
              topK: 40
            }
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error('❌ Gemini API error:', errorData);
          
          // Check if it's a quota error
          if (response.status === 429) {
            console.log('Quota exceeded error. Will retry with backoff...');
            retries++;
            continue; // Retry with backoff
          }
          
          throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        
        if (!data?.candidates?.[0]?.content?.parts?.[0]?.text) {
          console.error('Invalid API response structure:', data);
          throw new Error('Received an invalid response format from the recipe service');
        }
        
        const recipeText = data.candidates[0].content.parts[0].text;
        
        console.log('Raw Gemini response:', recipeText);
        
        // More robust JSON extraction
        try {
          let jsonStr = recipeText;
          
          // If the response has markdown code blocks, extract just the JSON
          const codeBlockMatch = recipeText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
          if (codeBlockMatch) {
            jsonStr = codeBlockMatch[1];
          } else {
            // Otherwise try to find JSON object anywhere in the text
            const jsonMatch = recipeText.match(/(\{[\s\S]*\})/);
            if (jsonMatch) {
              jsonStr = jsonMatch[1];
            }
          }
          
          // Clean the string - remove any non-JSON content
          jsonStr = jsonStr.replace(/^[^{]*/, '').replace(/[^}]*$/, '');
          
          console.log('Extracted JSON string:', jsonStr);
          
          // Parse the JSON
          const recipeData = JSON.parse(jsonStr);
          
          // Validate the required fields
          if (!recipeData.name || !Array.isArray(recipeData.ingredients) || !Array.isArray(recipeData.instructions)) {
            throw new Error('Invalid recipe format: missing required fields');
          }
          
          // Normalize the data structure
          const normalizedRecipe = {
            name: recipeData.name,
            ingredients: recipeData.ingredients.map((ing: any) => ({
              name: ing.name || "",
              quantity: ing.quantity || "1",
              unit: ing.unit || ""
            })),
            instructions: recipeData.instructions
          };
          
          setRecipe(normalizedRecipe);
          setShowInstructions(false);
          
          // Delay the announcement slightly to ensure state has updated
          setTimeout(() => {
            speakWithFeedback(`Found recipe for ${normalizedRecipe.name}.`);
          }, 500);
          
          // Success - exit the loop
          break;
          
        } catch (parseError: unknown) {
          console.error('JSON parsing error:', parseError, 'Raw text:', recipeText);
          const errorMessage = parseError instanceof Error ? parseError.message : 'Unknown parsing error';
          throw new Error(`Failed to parse recipe data: ${errorMessage}`);
        }
      } catch (error) {
        console.error(`Error fetching recipe (attempt ${retries+1}/${MAX_RETRIES}):`, error);
        retries++;
        
        if (retries >= MAX_RETRIES) {
          console.error('Max retries reached. Notifying user of failure.');
          Alert.alert('Error', 'Failed to get recipe. Please try again.');
          speakWithFeedback('Failed to get recipe. Please try again.');
          break;
        }
      }
    }
    
    setLoading(false);
  }, [query]);

  const addToPantry = useCallback(async () => {
    if (!pantryItem.trim()) return;
    
    const trimmedPantryItem = pantryItem.trim();
    
    // Check for duplicates (case-insensitive)
    const isDuplicate = pantryItems.some(
      item => item.toLowerCase() === trimmedPantryItem.toLowerCase()
    );
    
    if (isDuplicate) {
      // Alert the user that the item already exists
      Alert.alert('Duplicate Item', `"${trimmedPantryItem}" is already in your pantry.`);
      
      setPantryItem('');
      return;
    }
    
    // Add the item if it's not a duplicate
    setPantryItems(prev => [...prev, trimmedPantryItem]);
    setPantryItem('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    speakWithFeedback(`Added ${trimmedPantryItem} to pantry`);
  }, [pantryItem, pantryItems, speakWithFeedback]);

  const removePantryItem = useCallback(async (item: string) => {
    setPantryItems(prev => prev.filter(i => i !== item));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    speakWithFeedback(`Removed ${item} from pantry`);
  }, [speakWithFeedback]);

  const addToShoppingList = useCallback(async () => {
    if (!recipe) return;
    
    try {
      // Filter out ingredients that are in pantry
      const neededIngredients = recipe.ingredients.filter(
        ing => !pantryItems.some(item => 
          ingredientMatches(ing.name, item)
        )
      );
      
      if (neededIngredients.length === 0) {
        Alert.alert('Good news!', 'You already have all the ingredients you need!');
        speakWithFeedback('You already have all the ingredients you need!');
        return;
      }
      
      setLoading(true);
      
      // Get all current grocery items first
      const grocerySnapshot = await getDocs(collection(db, 'groceryItems'));
      const existingItems: Record<string, { id: string; quantity: number }> = {};
      
      // Create a map of lowercase item text to item details
      grocerySnapshot.forEach(doc => {
        const data = doc.data();
        if (data.text) {
          const textLower = data.text.toLowerCase();
          existingItems[textLower] = { 
            id: doc.id, 
            quantity: data.quantity || 1 
          };
        }
      });
      
      let addedCount = 0;
      let updatedCount = 0;
      
      // Process each ingredient
      for (const ingredient of neededIngredients) {
        // Normalize the ingredient for shopping list
        const { text, quantity } = normalizeIngredientForShopping(ingredient);
        const textLower = text.toLowerCase();
        
        // Check if the item already exists in our map
        if (existingItems[textLower]) {
          // Update existing item
          const itemToUpdate = existingItems[textLower];
          await updateDoc(doc(db, 'groceryItems', itemToUpdate.id), {
            quantity: itemToUpdate.quantity + quantity,
            textLowercase: textLower // Ensure this field exists
          });
          updatedCount++;
        } else {
          // Add as a new item
          let category = categorizeByRules(ingredient.name);
          
          if (category === 'Other') {
            category = await askAIForCategory(ingredient.name);
          }
          
          console.log(`Adding to shopping list: ${text} (${quantity}) → ${category}`);
          
          // Add to Firestore with proper category
          const docRef = await addDoc(collection(db, 'groceryItems'), {
            text: text,
            textLowercase: textLower,
            completed: false,
            category: category,
            quantity: quantity,
            timestamp: new Date().getTime()
          });
          
          // Add to our map in case another ingredient matches this one
          existingItems[textLower] = { id: docRef.id, quantity };
          addedCount++;
        }
      }
      
      // Force a check for duplicates after adding all ingredients
      setTimeout(() => {
        checkAndMergeDuplicates();
      }, 1000);
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      let message = '';
      if (addedCount > 0 && updatedCount > 0) {
        message = `Added ${addedCount} new items and updated quantities for ${updatedCount} existing items`;
      } else if (addedCount > 0) {
        message = `Added ${addedCount} items to your shopping list`;
      } else {
        message = `Updated quantities for ${updatedCount} items in your shopping list`;
      }
      
      Alert.alert('Success', message);
      
      speakWithFeedback(message);
    } catch (error) {
      console.error('Error adding to shopping list:', error);
      Alert.alert('Error', 'Failed to add items to shopping list');
    } finally {
      setLoading(false);
    }
  }, [recipe, pantryItems, speakWithFeedback]);

  const toggleInstructions = useCallback(() => {
    setShowInstructions(prev => !prev);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const speakRecipe = useCallback(async () => {
    if (!recipe) return;
    
    if (showInstructions) {
      const instructionsText = recipe.instructions.join('. ');
      speakWithFeedback(`Instructions for ${recipe.name}. ${instructionsText}`);
    } else {
      const ingredientsText = recipe.ingredients
        .map(ing => `${ing.quantity} ${ing.unit} ${ing.name}`)
        .join(', ');
      speakWithFeedback(`Ingredients for ${recipe.name}. ${ingredientsText}`);
    }
  }, [recipe, showInstructions, speakWithFeedback]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isAccessibleMode ? '#111' : '#fff' }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.container, { paddingTop: Platform.OS === 'ios' ? 60 : 40 }]}
      >
        <ScrollView 
          style={[
            styles.scrollView,
            { backgroundColor: isAccessibleMode ? '#111' : '#fff' }
          ]}
          contentContainerStyle={[
            styles.contentContainer,
            { backgroundColor: isAccessibleMode ? '#111' : '#fff' }
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.sectionContainer, { marginTop: 10 }]}>
            <Text style={[
              styles.sectionMainTitle,
              isAccessibleMode && { color: '#00E0E0' }
            ]}>
              Find a Recipe
            </Text>
            <View style={styles.searchContainer}>
              <TextInput
                style={[
                  styles.input,
                  isAccessibleMode && { 
                    backgroundColor: '#333',
                    color: '#00E0E0',
                    borderColor: '#00E0E0'
                  }
                ]}
                placeholder="What would you like to cook?"
                placeholderTextColor={isAccessibleMode ? '#999' : '#999'}
                value={query}
                onChangeText={setQuery}
              />
              <TouchableOpacity 
                style={[
                  styles.searchButton,
                  { backgroundColor: isAccessibleMode ? '#00E0E0' : primaryColor }
                ]} 
                onPress={getRecipe}
                disabled={loading}
                accessibilityLabel="Search for recipe"
                accessibilityHint="Searches for a recipe based on your query"
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="large" />
                ) : (
                  <FontAwesome name="search" size={32} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Pantry Items Section */}
          <View style={styles.sectionContainer}>
            <Text style={[
              styles.sectionMainTitle,
              isAccessibleMode && { color: '#00E0E0' }
            ]}>
              My Pantry Items
            </Text>
            <Text style={[
              styles.sectionSubtitle,
              isAccessibleMode && { color: '#00E0E0' }
            ]}>
              Add ingredients you already have
            </Text>
            
            <View style={styles.pantryInputContainer}>
              <TextInput
                style={[
                  styles.pantryInput,
                  isAccessibleMode && { 
                    backgroundColor: '#333',
                    color: '#fff',
                    borderColor: '#00E0E0'
                  }
                ]}
                placeholder="Add ingredient (e.g., salt, olive oil)"
                placeholderTextColor={isAccessibleMode ? '#999' : '#999'}
                value={pantryItem}
                onChangeText={setPantryItem}
                onSubmitEditing={addToPantry}
              />
              <TouchableOpacity 
                style={[
                  styles.addButton,
                  { backgroundColor: isAccessibleMode ? '#00E0E0' : primaryColor }
                ]} 
                onPress={addToPantry}
                accessibilityLabel="Add pantry item"
              >
                <FontAwesome name="plus" size={32} color="#fff" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.pantryItemsContainer}>
              {pantryItems.map((item, index) => (
                <View key={index} style={[
                  styles.pantryItemChip,
                  isAccessibleMode && { backgroundColor: '#333', borderColor: '#00E0E0', borderWidth: 1 }
                ]}>
                  <Text style={[
                    styles.pantryItemText,
                    isAccessibleMode && { color: '#00E0E0' }
                  ]}>{item}</Text>
                  <TouchableOpacity
                    onPress={() => removePantryItem(item)}
                    style={styles.removeButton}
                    accessibilityLabel={`Remove ${item}`}
                  >
                    <FontAwesome name="times" size={18} color={isAccessibleMode ? '#FF00FF' : '#888'} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>

          {/* Recipe Result Section */}
          {recipe && (
            <View style={[
              styles.recipeContainer,
              isAccessibleMode && { 
                borderColor: '#00E0E0',
                borderWidth: 2
              }
            ]}>
              <View style={styles.recipeHeader}>
                <Text style={[
                  styles.recipeName,
                  isAccessibleMode && { color: '#00E0E0' }
                ]}>
                  {recipe.name}
                </Text>
                <TouchableOpacity 
                  onPress={speakRecipe}
                  style={styles.speakButton}
                  accessibilityLabel="Speak recipe details"
                >
                  <FontAwesome name="volume-up" size={32} color={isAccessibleMode ? '#FF00FF' : primaryColor} />
                </TouchableOpacity>
              </View>

              <View style={styles.tabContainer}>
                <TouchableOpacity
                  style={[
                    styles.tab,
                    !showInstructions && { 
                      backgroundColor: isAccessibleMode ? '#00E0E0' : primaryColor,
                      borderColor: isAccessibleMode ? '#00E0E0' : primaryColor
                    },
                    isAccessibleMode && showInstructions && { 
                      backgroundColor: '#333',
                      borderColor: '#444'
                    }
                  ]}
                  onPress={() => setShowInstructions(false)}
                  accessibilityLabel="Show ingredients"
                >
                  <Text style={[
                    styles.tabText,
                    !showInstructions && { color: '#fff' },
                    isAccessibleMode && showInstructions && { color: '#00E0E0' }
                  ]}>
                    Ingredients
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.tab,
                    showInstructions && { 
                      backgroundColor: isAccessibleMode ? '#00E0E0' : primaryColor,
                      borderColor: isAccessibleMode ? '#00E0E0' : primaryColor 
                    },
                    isAccessibleMode && !showInstructions && { 
                      backgroundColor: '#333',
                      borderColor: '#444'
                    }
                  ]}
                  onPress={() => setShowInstructions(true)}
                  accessibilityLabel="Show instructions"
                >
                  <Text style={[
                    styles.tabText,
                    showInstructions && { color: '#fff' },
                    isAccessibleMode && !showInstructions && { color: '#00E0E0' }
                  ]}>
                    Instructions
                  </Text>
                </TouchableOpacity>
              </View>

              {!showInstructions ? (
                <View style={styles.ingredientsList}>
                  {recipe.ingredients.map((ingredient, index) => {
                    const isInPantry = pantryItems.some(item => 
                      ingredientMatches(ingredient.name, item)
                    );
                    
                    return (
                      <View 
                        key={index} 
                        style={[
                          styles.ingredientItem,
                          isAccessibleMode && { 
                            backgroundColor: '#222',
                            borderBottomColor: '#444'
                          },
                          isInPantry && (isAccessibleMode ? 
                            { backgroundColor: 'rgba(0, 224, 224, 0.15)' } : 
                            styles.ingredientInPantry)
                        ]}
                      >
                        <Text style={[
                          styles.ingredientText,
                          isAccessibleMode && { color: '#00E0E0' }
                        ]}>
                          {`${ingredient.quantity} ${ingredient.unit} ${ingredient.name}`}
                          {isInPantry && ' (in pantry)'}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.instructionsList}>
                  {recipe.instructions.map((instruction, index) => (
                    <View key={index} style={[
                      styles.instructionItem,
                      isAccessibleMode && { backgroundColor: '#222' }
                    ]}>
                      <Text style={[
                        styles.instructionNumber,
                        isAccessibleMode && { 
                          color: '#00E0E0',
                          backgroundColor: '#333'
                        }
                      ]}>
                        {index + 1}
                      </Text>
                      <Text style={[
                        styles.instructionText,
                        isAccessibleMode && { color: '#00E0E0' }
                      ]}>
                        {instruction}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              <TouchableOpacity
                style={[
                  styles.addToListButton,
                  { backgroundColor: isAccessibleMode ? '#00E0E0' : primaryColor },
                  loading && { opacity: 0.7 }
                ]}
                onPress={addToShoppingList}
                disabled={loading}
                accessibilityLabel={loading ? "Adding ingredients to list..." : "Add missing ingredients to shopping list"}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" style={styles.buttonIcon} />
                ) : (
                  <FontAwesome name="shopping-cart" size={32} color="#fff" style={styles.buttonIcon} />
                )}
                <Text style={styles.buttonText}>
                  {loading ? "Adding to List..." : "Add Missing Ingredients to List"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 8,
    paddingTop: -8,
    paddingBottom: 120,
  },
  sectionContainer: {
    marginBottom: 16,
  },
  sectionMainTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  searchContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: 60,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 20,
    backgroundColor: '#f9f9f9',
  },
  searchButton: {
    width: 60,
    height: 60,
    borderRadius: 12,
    marginLeft: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pantryContainer: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  sectionSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 12,
  },
  pantryInputContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'center',
  },
  pantryInput: {
    flex: 1,
    height: 60,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 20,
    backgroundColor: '#f9f9f9',
  },
  addButton: {
    width: 60,
    height: 60,
    borderRadius: 12,
    marginLeft: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pantryItemsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  pantryItemChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 16,
    margin: 5,
  },
  pantryItemText: {
    fontSize: 18,
    color: '#333',
    marginRight: 8,
  },
  removeButton: {
    padding: 4,
  },
  recipeContainer: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
    padding: 16,
    marginBottom: 16,
  },
  recipeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  recipeName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  speakButton: {
    padding: 15,
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    borderRadius: 8,
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    paddingVertical: 18,
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  tabText: {
    fontSize: 22,
    fontWeight: '600',
    color: '#666',
  },
  ingredientsList: {
    marginBottom: 16,
  },
  ingredientItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  ingredientInPantry: {
    backgroundColor: 'rgba(0, 200, 0, 0.1)',
  },
  ingredientText: {
    fontSize: 22,
    color: '#333',
  },
  instructionsList: {
    marginBottom: 16,
  },
  instructionItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  instructionNumber: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#f0f0f0',
    textAlign: 'center',
    lineHeight: 34,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginRight: 12,
  },
  instructionText: {
    flex: 1,
    fontSize: 22,
    color: '#333',
    lineHeight: 32,
  },
  addToListButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    borderRadius: 14,
    marginTop: 18,
  },
  buttonIcon: {
    marginRight: 12,
  },
  buttonText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '600',
  },
}); 