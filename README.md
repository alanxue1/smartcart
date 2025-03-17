# SmartCart

A smart shopping & recipe app that helps manage your grocery shopping and meal planning with AI-powered categorization.

## Features

- 🔍 Search for recipes and see what ingredients you need
- 📋 Maintain a pantry inventory of ingredients you already have
- 🤖 AI-powered ingredient categorization using Google's Gemini 2.0 Flash
- 📱 Real-time shopping list syncing with Firebase
- 🗂️ Automatic categorization
- ✅ Mark items as complete
- 🔢 Adjust quantities with intuitive controls
- 🧠 Smart ingredient handling (removes preparation instructions like "finely chopped")
- 🧮 Proper handling of fractions in recipe ingredients
- 🗑️ Long press to delete items
- 🔊 Text-to-speech for accessibility
- 🎨 High contrast mode for better visibility
- 📱 Cross-platform (iOS & Android) support

## Recent Improvements

- 🚀 Switched to Gemini 2.0 Flash for better API quota limits and performance
- 🔍 Implemented exact matching for ingredient categorization, improving accuracy
- 🛠️ Fixed issues with compound terms like "fish sauce" being incorrectly categorized
- 🧮 Improved handling of fractions in recipe ingredients (1/4, 1/2, etc.)
- 🧹 Automatic removal of preparation instructions from shopping list items
- 📊 More efficient categorization system with less AI dependency
- 💬 Simplified notification system for list management

## Tech Stack

- React Native with Expo
- TypeScript
- Firebase Firestore
- Google Gemini API (upgraded to 2.0 Flash)
- React Native Navigation (Expo Router)
- Expo Speech API for accessibility

## Setup

1. Clone the repository:
```bash
git clone https://github.com/alanxue1/smartcart.git
cd smartcart
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with:
```
GEMINI_API_KEY=your_gemini_api_key
```

4. Start the development server:
```bash
npm start
```

5. Run on your device:
- iOS: Press 'i' in the terminal
- Android: Press 'a' in the terminal
- Scan the QR code with Expo Go app

## Environment Variables

- `GEMINI_API_KEY`: Google Gemini API key for item categorization

## Development

- Built with Expo and TypeScript
- Uses Firebase for real-time data sync
- Implements AI categorization with smart fallbacks
- Follows React Native best practices
- Improved error handling with retry mechanisms

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## 📞 Contact

Alan Xue - [@alanxue_](https://x.com/alanxue_) - xuealan101@gmail.com

Project Link: [https://github.com/alanxue1/SmartCart](https://github.com/alanxue1/SmartCart)
