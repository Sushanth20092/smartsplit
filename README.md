# SmartSplit - AI-Powered Bill Splitting App

SmartSplit is a React Native application that makes splitting bills with friends, roommates, and colleagues effortless. Using advanced OCR technology, users can simply scan receipts to automatically extract items and amounts, then split costs fairly among group members.

## 🚀 Features

### Core Functionality
- **OCR Receipt Scanning**: Take photos of receipts and automatically extract items, prices, and totals
- **Smart Bill Splitting**: Multiple splitting methods (equal, by item, custom amounts)
- **Group Management**: Create and manage groups for different contexts (roommates, trips, etc.)
- **Real-time Notifications**: Stay updated on new bills, payments, and group activities
- **Multi-platform Payments**: Support for Stripe, PayPal, Venmo, and cash payments

### User Experience
- **Intuitive Interface**: Clean, modern design with smooth animations
- **Offline Support**: Core functionality works without internet connection
- **Dark Mode**: Full dark mode support for better user experience
- **Accessibility**: Built with accessibility best practices

### Advanced Features
- **Expense Tracking**: Detailed analytics and spending insights
- **Group Chat**: Built-in messaging for each group
- **Payment History**: Complete transaction history with search and filters
- **Export Data**: Export expenses to CSV or PDF formats

## 📱 Screenshots

[Screenshots would be added here in a real project]

## 🛠 Tech Stack

### Frontend
- **React Native** with Expo
- **TypeScript** for type safety
- **React Navigation** for navigation
- **Expo Camera** for receipt scanning
- **React Native Reanimated** for animations

### Backend
- **Supabase** for database and authentication
- **PostgreSQL** for data storage
- **Row Level Security** for data protection
- **Real-time subscriptions** for live updates

### Services
- **Google Vision API** for OCR processing
- **Stripe API** for payment processing
- **Expo Notifications** for push notifications

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Expo CLI
- iOS Simulator or Android Emulator (for development)

### Installation

1. **Clone the repository**
   \`\`\`bash
   git clone https://github.com/yourusername/smartsplit.git
   cd smartsplit
   \`\`\`

2. **Install dependencies**
   \`\`\`bash
   npm install
   \`\`\`

3. **Set up environment variables**
   \`\`\`bash
   cp .env.example .env
   \`\`\`
   
   Fill in your API keys and configuration:
   \`\`\`env
   SUPABASE_URL=your_supabase_url_here
   SUPABASE_ANON_KEY=your_supabase_anon_key_here
   GOOGLE_VISION_API_KEY=your_google_vision_api_key_here
   STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key_here
   \`\`\`

4. **Set up Supabase**
   - Create a new Supabase project
   - Run the SQL schema from `backend/supabase/schema.sql`
   - Configure authentication providers if needed

5. **Start the development server**
   \`\`\`bash
   npm start
   \`\`\`

6. **Run on device/simulator**
   - Press `i` for iOS simulator
   - Press `a` for Android emulator
   - Scan QR code with Expo Go app for physical device

## 📁 Project Structure

\`\`\`
smartsplit/
├── frontend/                    # React Native app
│   ├── components/             # Reusable UI components
│   ├── contexts/              # React contexts (Auth, Notifications)
│   ├── navigation/            # Navigation configuration
│   ├── screens/               # App screens
│   ├── services/              # API services and utilities
│   ├── types/                 # TypeScript type definitions
│   └── utils/                 # Utility functions
├── backend/                    # Backend configuration
│   └── supabase/              # Supabase schema and config
├── assets/                     # Images, icons, fonts
├── .env.example               # Environment variables template
├── app.json                   # Expo configuration
├── package.json               # Dependencies and scripts
└── README.md                  # Project documentation
\`\`\`

## 🔧 Configuration

### Supabase Setup
1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Settings > API to get your URL and anon key
3. Run the SQL schema from `backend/supabase/schema.sql` in the SQL editor
4. Configure authentication providers in Authentication > Settings

### Google Vision API
1. Create a project in [Google Cloud Console](https://console.cloud.google.com)
2. Enable the Vision API
3. Create credentials and get your API key
4. Add the key to your `.env` file

### Stripe Setup
1. Create an account at [stripe.com](https://stripe.com)
2. Get your publishable key from the dashboard
3. Add it to your `.env` file

## 🧪 Testing

\`\`\`bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e
\`\`\`

## 📦 Building for Production

### iOS
\`\`\`bash
# Build for iOS
expo build:ios

# Or with EAS Build
eas build --platform ios
\`\`\`

### Android
\`\`\`bash
# Build for Android
expo build:android

# Or with EAS Build
eas build --platform android
\`\`\`

## 🚀 Deployment

### Using EAS Build & Submit
\`\`\`bash
# Configure EAS
eas build:configure

# Build for both platforms
eas build --platform all

# Submit to app stores
eas submit --platform ios
eas submit --platform android
\`\`\`

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- 📧 Email: support@smartsplit.app
- 💬 Discord: [Join our community](https://discord.gg/smartsplit)
- 📖 Documentation: [docs.smartsplit.app](https://docs.smartsplit.app)
- 🐛 Issues: [GitHub Issues](https://github.com/yourusername/smartsplit/issues)

## 🙏 Acknowledgments

- [Expo](https://expo.dev) for the amazing development platform
- [Supabase](https://supabase.com) for the backend infrastructure
- [Google Vision API](https://cloud.google.com/vision) for OCR capabilities
- [Stripe](https://stripe.com) for payment processing
- All our contributors and beta testers

## 🗺 Roadmap

- [ ] Web app version
- [ ] Apple Pay / Google Pay integration
- [ ] Recurring bill splitting
- [ ] Budget tracking and limits
- [ ] Multi-currency support
- [ ] Integration with banking APIs
- [ ] Advanced analytics dashboard
- [ ] Social features (friend recommendations)

---

Made with ❤️ by the SmartSplit team
