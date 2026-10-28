# Target Practice

A mobile app for logging recreational target-practice sessions, built with React Native, Expo
(SDK 58) and TypeScript. The app lives in [`apps/mobile`](apps/mobile).

> **Status: partial MVP with a working manual flow.** You can create a session, open it, run
> rounds with before and after photos, calibrate the after photo, mark and correct hits, confirm
> rounds, finish the session and see the results in the list. Two things are **not** real yet:
>
> - **Scores use a synthetic demo target.** The real target's dimensions and scoring rules are
>   not verified, so scores are only for trying the workflow (see *Target and scoring*).
> - **No automatic analysis is connected.** The analysis boundary is built, but no service has
>   been chosen, so hits are marked by hand. Development builds can add fixed demo suggestions,
>   clearly labelled as not real analysis.
>
> Automated checks pass (format, lint, types, 611 Jest tests; CI on GitHub). The new MVP screens
> have **not yet been tested on a phone**; see the
> [S20 checklist](docs/device-tests/mvp.md). iOS is untested. See [PLAN.md](PLAN.md) and
> [implementation/mvp-plan.md](implementation/mvp-plan.md).

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

**CI:** [`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs `npm ci` and the same four checks on every pull request to `main` and every push to `main`, using the Node version in `apps/mobile/.nvmrc`. It has no builds, deployment or device tests, so a green run does not mean the app has been checked on a phone. It passed in GitHub Actions for pull request #2 and the push to `main` (`d802586`).

**Run manually when dependencies change** (not part of CI, because they depend on Expo's online services and can fail when Expo publishes a new patch):

```bash
npx expo install --check
npx expo-doctor
```

## Using the app

1. **New session** on the Sessions list: firearm, calibre, distance and planned shots/rounds.
2. Open the session and tap **Start round**. Shots fired defaults to the planned number; change it
   if the round was interrupted.
3. **Before photo (optional):** after covering old holes with matching stickers. **After photo:**
   after the round, from the same spot. Fill the frame with the whole target, hold the phone
   straight in front of it, and avoid glare and shadows.
4. **Calibrate and mark hits:** tap where the outer ring crosses the line of numbers at the top,
   right, bottom and left. The rings are drawn back onto the photo so you can check the fit.
   Then tap each hole. Tap a mark to select it, drag to move it, set several shots for one hole,
   delete or undo. Pinch or use +/− to zoom.
5. Declare known **misses** and **unresolved** shots on the round screen. Missing marks are never
   counted as misses, and unresolved shots make the result a subtotal.
6. **Confirm round** when the shots add up. Confirmed rounds cannot be changed.
7. Start the next round, or **Finish session**. The list shows status, rounds and points.

Hole diameter is an assumed value per round (default 9.0 mm). A hole touching a ring line gets
the higher score.

## Target and scoring

The owner's target is an X-Targets precision target (ten rings, 1–10). Its physical dimensions,
line treatment and scoring rules are **not verified**, so the app ships only
`demo-synthetic-v1`: the same ten-ring structure with invented radii (10 mm per ring). Every
score in the app is labelled as demo. To enable real scoring the app needs, from a reliable
source: the outer radius of each scoring zone in millimetres, how printed lines count, whether
the inner ring matters, the target's size, and where nominal hole diameters come from.

## Analysis service (not connected)

The contract is [`contracts/analysis.openapi.yaml`](contracts/analysis.openapi.yaml). The app
sends photos only after the user taps **Analyze photos**, and only when an address is
configured:

```bash
# apps/mobile/.env.local (ignored by Git); see apps/mobile/.env.example
EXPO_PUBLIC_ANALYSIS_URL=https://analysis.example
```

HTTPS is required; plain HTTP is accepted only for `localhost`/`127.0.0.1` in development (with
`adb reverse tcp:8000 tcp:8000` on a USB-connected Android phone). The address is not a secret.
Provider keys must stay on the server. No service or provider has been chosen, so nothing is
configured and no server code exists yet.

## Data and privacy

- Sessions, rounds, marks and results are stored locally in SQLite (`target-practice.db`).
- Photos are **copied** into the app's own document folder under generated names; the
  originals in the phone's library are never changed or deleted. Discarding a round or
  replacing a photo deletes only the app's copy.
- Nothing is sent to a server unless an analysis address is configured **and** you tap
  **Analyze photos**.

## License

No license has been chosen yet.
