import React, { useState, useCallback } from 'react';
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
import { collection, addDoc } from 'firebase/firestore';
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
    console.error('❌ Error categorizing item:', error);
    return 'Other';
  }
};

const categorizeByRules = (item: string): Category => {
  item = item.toLowerCase();
  
  for (const [category, keywords] of Object.entries(FOOD_CATEGORIES)) {
    if (category === 'Other') continue;
    
    for (const keyword of keywords) {
      if (item.includes(keyword.toLowerCase())) {
        return category as Category;
      }
    }
  }
  
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

// Add this function to clean up ingredient names for shopping lists
const normalizeIngredientForShopping = (ingredient: Ingredient): { text: string, quantity: number } => {
  const name = ingredient.name.trim();
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
  ];
  
  // Check if the ingredient is a common grocery item
  for (const item of commonItems) {
    if (name.toLowerCase().includes(item.term)) {
      // For common items, just return the name without measurements
      return { text: name.split('(')[0].trim(), quantity: item.defaultQuantity };
    }
  }
  
  // Check if the unit is one we want to remove from shopping list
  if (smallUnits.includes(unit)) {
    // Remove the small measurement unit and quantity
    return { text: name, quantity: 1 };
  }
  
  try {
    // Try to parse the quantity as a number
    const parsedQuantity = parseFloat(quantity.replace(/[^\d.-]/g, ''));
    
    if (!isNaN(parsedQuantity) && parsedQuantity > 0) {
      if (['lb', 'pound', 'pounds'].includes(unit)) {
        // For meat and items typically sold by weight
        return { 
          text: `${name} (${quantity} ${unit})`, 
          quantity: 1 
        };
      } else if (['whole', 'medium', 'large', 'small', ''].includes(unit) && parsedQuantity >= 1) {
        // For count-based items (apples, onions, etc.)
        // Remove any text in parentheses and clean up the name
        const cleanName = name.split('(')[0].trim();
        return { 
          text: cleanName, 
          quantity: Math.round(parsedQuantity) 
        };
      }
    }
  } catch (e) {
    console.log('Error parsing quantity:', e);
  }
  
  // Clean up any name that contains parentheses
  const cleanName = name.split('(')[0].trim();
  
  // Default fallback: just the clean name, quantity of 1
  return { text: cleanName, quantity: 1 };
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

export default function RecipeScreen() {
  const { isAccessibleMode, primaryColor } = useTheme();
  const [query, setQuery] = useState('');
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(false);
  const [pantryItems, setPantryItems] = useState<string[]>([]);
  const [pantryItem, setPantryItem] = useState('');
  const [showInstructions, setShowInstructions] = useState(false);

  const getRecipe = useCallback(async () => {
    if (!query.trim()) {
      if (isAccessibleMode) {
        Speech.speak('Please enter a recipe to search for');
      }
      Alert.alert('Empty Query', 'Please enter a recipe to search for');
      return;
    }

    setLoading(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (isAccessibleMode) {
      Speech.speak(`Searching for ${query} recipe`);
    }

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent?key=${config.geminiKey}`, {
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
      } catch (parseError: unknown) {
        console.error('JSON parsing error:', parseError, 'Raw text:', recipeText);
        const errorMessage = parseError instanceof Error ? parseError.message : 'Unknown parsing error';
        throw new Error(`Failed to parse recipe data: ${errorMessage}`);
      }
    } catch (error) {
      console.error('Error fetching recipe:', error);
      Alert.alert('Error', 'Failed to get recipe. Please try again.');
      if (isAccessibleMode) {
        Speech.speak('Failed to get recipe. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [query, isAccessibleMode]);

  const addToPantry = useCallback(() => {
    if (!pantryItem.trim()) return;
    
    setPantryItems(prev => [...prev, pantryItem.trim()]);
    setPantryItem('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (isAccessibleMode) {
      Speech.speak(`Added ${pantryItem} to pantry`);
    }
  }, [pantryItem, isAccessibleMode]);

  const removePantryItem = useCallback((item: string) => {
    setPantryItems(prev => prev.filter(i => i !== item));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    if (isAccessibleMode) {
      Speech.speak(`Removed ${item} from pantry`);
    }
  }, [isAccessibleMode]);

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
        if (isAccessibleMode) {
          Speech.speak('You already have all the ingredients you need!');
        }
        return;
      }
      
      setLoading(true);
      
      // Process each ingredient
      for (const ingredient of neededIngredients) {
        // Normalize the ingredient for shopping list
        const { text, quantity } = normalizeIngredientForShopping(ingredient);
        
        // First try rule-based categorization as it's faster
        let category = categorizeByRules(ingredient.name);
        
        // If rule-based categorization returns 'Other', try with AI
        if (category === 'Other') {
          category = await askAIForCategory(ingredient.name);
        }
        
        console.log(`Adding to shopping list: ${text} (${quantity}) → ${category}`);
        
        // Add to Firestore with proper category
        await addDoc(collection(db, 'groceryItems'), {
          text: text,
          completed: false,
          category: category,
          quantity: quantity,
          timestamp: new Date().getTime()
        });
      }
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', `Added ${neededIngredients.length} items to your shopping list`);
      
      if (isAccessibleMode) {
        Speech.speak(`Added ${neededIngredients.length} items to your shopping list`);
      }
    } catch (error) {
      console.error('Error adding to shopping list:', error);
      Alert.alert('Error', 'Failed to add items to shopping list');
    } finally {
      setLoading(false);
    }
  }, [recipe, pantryItems, isAccessibleMode]);

  const toggleInstructions = useCallback(() => {
    setShowInstructions(prev => !prev);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const speakRecipe = useCallback(() => {
    if (!recipe) return;
    
    Speech.stop();
    
    if (showInstructions) {
      const instructionsText = recipe.instructions.join('. ');
      Speech.speak(`Instructions for ${recipe.name}. ${instructionsText}`);
    } else {
      const ingredientsText = recipe.ingredients
        .map(ing => `${ing.quantity} ${ing.unit} ${ing.name}`)
        .join(', ');
      Speech.speak(`Ingredients for ${recipe.name}. ${ingredientsText}`);
    }
  }, [recipe, showInstructions]);

  return (
    <SafeAreaView style={[
      styles.container, 
      isAccessibleMode && { backgroundColor: '#000' }
    ]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView 
          style={[
            styles.scrollView,
            isAccessibleMode && { backgroundColor: '#000' }
          ]}
          contentContainerStyle={[
            styles.contentContainer,
            isAccessibleMode && { backgroundColor: '#000' }
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.sectionContainer}>
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
                backgroundColor: '#222', 
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
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 120,
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionMainTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  searchContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: 70,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 20,
    backgroundColor: '#f9f9f9',
  },
  searchButton: {
    width: 70,
    height: 70,
    borderRadius: 12,
    marginLeft: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pantryContainer: {
    marginBottom: 24,
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
    marginBottom: 16,
  },
  pantryInputContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'center',
  },
  pantryInput: {
    flex: 1,
    height: 70,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 20,
    backgroundColor: '#f9f9f9',
  },
  addButton: {
    width: 70,
    height: 70,
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
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
    padding: 20,
    marginBottom: 24,
  },
  recipeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
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
    marginBottom: 20,
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
  }
}); 