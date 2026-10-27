# Target Practice

A mobile app for logging recreational target-practice sessions, built with React Native, Expo
(SDK 58) and TypeScript. The app lives in [`apps/mobile`](apps/mobile).

> **Status:** Early development. The domain validation (step 2) and local SQLite persistence
> (step 3) are implemented and unit tested, but no screens use them yet. Running the app today
> shows only a placeholder screen titled "Target Practice". See [PLAN.md](PLAN.md) for the
> implementation plan and progress. Nothing has been verified on a physical device yet.

## Prerequisites

- **Node.js 26** (pinned in [`apps/mobile/.nvmrc`](apps/mobile/.nvmrc)) and npm.
- **Expo Go** for Expo SDK 58 on the phone you test with, from Google Play (Android) or the
  App Store (iOS). The app currently runs in Expo Go, so no development build is needed.
- The phone and the development computer on the same network, or a USB connection (Android).

Optional, only for emulators and simulators:

- **Android emulator:** Android Studio with an Android Virtual Device.
- **iOS Simulator:** macOS with Xcode.

## Install

```bash
cd apps/mobile
npm ci
```

## Start the development server

```bash
cd apps/mobile
npx expo start
```

The terminal shows a QR code and a menu of keyboard shortcuts.

## Run on Android

**Physical device (primary test device: Samsung Galaxy S20):**

1. Install Expo Go from Google Play.
2. Run `npx expo start` in `apps/mobile`.
3. Open Expo Go and scan the QR code from the terminal.

If the phone cannot reach the computer over the network, connect it with USB (USB debugging
enabled) and forward the Metro port:

```bash
adb reverse tcp:8081 tcp:8081
npx expo start --localhost
```

Then open the app from Expo Go, or press `a` in the terminal.

**Emulator:** start an Android Virtual Device, then run `npm run android` in `apps/mobile`
(or press `a` in a running `npx expo start`).

## Run on iOS

iOS compatibility is kept in the code, but iOS has not been tested yet.

**Physical device:**

1. Install Expo Go from the App Store.
2. Run `npx expo start` in `apps/mobile`.
3. Scan the QR code with the Camera app and open the link in Expo Go.

**Simulator (macOS with Xcode):** run `npm run ios` in `apps/mobile` (or press `i` in a running
`npx expo start`).

## Checks

Run from `apps/mobile`:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test -- --runInBand
```

## Data and privacy

Sessions are stored locally on the device in SQLite (`target-practice.db`). Nothing is sent to a
server.

## License

No license has been chosen yet.
