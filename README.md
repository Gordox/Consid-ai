# Target Practice

A mobile app for logging recreational target-practice sessions, built with React Native, Expo
(SDK 58) and TypeScript. The app lives in [`apps/mobile`](apps/mobile).

> **Status:** Early development. Domain validation (step 2), local SQLite persistence (step 3),
> the new-session form (step 5) and the session list (step 6) are implemented and unit tested.
> The app opens to the **Sessions** list, newest first, with a **New session** button.
>
> On a Galaxy S20 in Expo Go, creating sessions, the list, and sessions kept after a full app
> restart have been checked manually. Date and time display across languages and time zones is
> only partly checked. Error cases (read failures, unreadable records, startup errors) still need
> fault-injection tests. iOS is untested. See [PLAN.md](PLAN.md) for the plan and progress.
>
> **Known issue, fixed for the tested case:** the keyboard used to hide the lowest fields of the
> new-session form on Android. The fix is verified for *Planned rounds* in Expo Go on a Galaxy
> S20; other fields, accessibility with the keyboard open, other keyboards, a custom Android
> build and iOS are not yet verified. See
> [docs/bugs/keyboard-covers-lower-form-fields.md](docs/bugs/keyboard-covers-lower-form-fields.md).

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

**CI:** [`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs `npm ci` and the same four checks on every pull request to `main` and every push to `main`, using the Node version in `apps/mobile/.nvmrc`. It has no builds, deployment or device tests, so a green run does not mean the app has been checked on a phone. The workflow has been checked locally in a clean clone but **not yet in GitHub Actions**.

**Run manually when dependencies change** (not part of CI, because they depend on Expo's online services and can fail when Expo publishes a new patch):

```bash
npx expo install --check
npx expo-doctor
```

## Data and privacy

Sessions are stored locally on the device in SQLite (`target-practice.db`). Nothing is sent to a
server.

## License

No license has been chosen yet.
