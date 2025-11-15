# Tax Calculator Mobile App

React Native Expo mobile app for iOS and Android UK tax calculations.

## Features

- ✅ Real-time tax calculations
- ✅ Support for multiple UK regions (England, Scotland, Wales, Northern Ireland)
- ✅ Student loan repayment planning
- ✅ Pension contribution comparison
- ✅ Bonus and pay rise scenarios
- ✅ Taxable benefits tracking

## Shared Code

This app uses the **@tax-calc/shared** package for all tax calculations. This ensures that:
- Mobile and web apps use identical calculation logic
- Tax rule changes only need to be updated once
- Both platforms are always in sync

## Getting Started

### Prerequisites

- Node.js >= 18
- Expo CLI: `npm install -g expo-cli`

### Installation

```bash
yarn install
```

### Development

```bash
# Start the development server
yarn start

# Run on iOS simulator
yarn ios

# Run on Android emulator
yarn android

# Run on web
yarn web
```

### Building

```bash
# Build for all platforms
yarn build

# Build for iOS
yarn build:ios

# Build for Android
yarn build:android
```

## Project Structure

```
apps/mobile/
├── src/
│   ├── screens/          # Screen components
│   ├── components/       # Reusable components
│   ├── navigation/       # Navigation configuration
│   └── utils/            # Utility functions
├── assets/               # Images, icons, etc.
├── App.tsx              # App entry point
├── app.json             # Expo configuration
└── package.json         # Dependencies
```

## Navigation

The app uses React Navigation with:
- **Stack Navigator**: For tax calculator form
- **Tab Navigator**: For different calculation scenarios

## State Management

Uses React Hook Form for form state management and local React state for calculation results.

## Contributing

When updating tax logic:
1. Update the shared package in `packages/shared-tax-logic/`
2. Run `yarn workspace @tax-calc/shared build`
3. Changes automatically apply to mobile and web apps

## Environment Variables

Create a `.env.local` file (not committed to repo):

```
EXPO_PUBLIC_API_URL=your_api_url
```

## Learn More

- [Expo Documentation](https://docs.expo.dev/)
- [React Native Documentation](https://reactnative.dev/)
- [React Navigation](https://reactnavigation.org/)
