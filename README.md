# NaviCart

A smart shopping & recipe app that helps manage your pantry and shopping list with AI-powered categorization.

## Features

- 🔍 Search for recipes and see what ingredients you need
- 📋 Maintain a pantry inventory of ingredients you already have
- 🤖 AI-powered ingredient categorization using Google's Gemini Pro
- 📱 Real-time shopping list syncing with Firebase
- 🗂️ Automatic categorization into:
  - Produce
  - Dairy
  - Meat
  - Seafood
  - Pantry
  - Snacks
  - Beverages
  - Frozen
  - Other
- ✅ Mark items as complete
- 🗑️ Long press to delete items
- 🔊 Text-to-speech for accessibility
- 🎨 High contrast mode for better visibility
- 📱 Cross-platform (iOS & Android) support

## Tech Stack

- React Native with Expo
- TypeScript
- Firebase Firestore
- Google Gemini Pro API
- React Native Navigation (Expo Router)
- Expo Speech API for accessibility

## Setup

1. Clone the repository:
```bash
git clone https://github.com/alanxue1/navicart.git
cd navicart
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

- `GEMINI_API_KEY`: Google Gemini Pro API key for item categorization

## Development

- Built with Expo and TypeScript
- Uses Firebase for real-time data sync
- Implements AI categorization with error fallbacks
- Follows React Native best practices

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Thanks to Google Gemini Pro API for the AI categorization capabilities
- Other inspirations

## 📞 Contact

Alan Xue - [@alanxue_](https://x.com/alanxue_) - xuealan101@gmail.com

Project Link: [https://github.com/alanxue1/NaviCart](https://github.com/alanxue1/NaviCart)
