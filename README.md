# Target Practice

A mobile app for logging recreational target-practice sessions, built with React Native, Expo
(SDK 58) and TypeScript. The app lives in [`apps/mobile`](apps/mobile).

> **Status: partial MVP with a working manual flow and a local, heuristic analysis service.**
> You can create a session, run rounds with before and after photos, calibrate, get hit
> suggestions from the local analysis service (or mark hits yourself), accept or correct them,
> confirm rounds, finish the session and see the results in the list. What is **not** real yet:
>
> - **Scores use a synthetic demo target** and are labelled as demo everywhere, including the
>   summaries. The real target looks like an ISSF 25/50 m pistol target, but its dimensions are
>   not verified (see [docs/target-calibration.md](docs/target-calibration.md)).
> - **Hit suggestions are tested on synthetic images only.** No real photo has been analysed
>   ([docs/evaluation.md](docs/evaluation.md)). Every suggestion must be accepted by you before it
>   counts.
>
> Automated checks pass (app: format, lint, types, Jest; service: ruff, mypy, pytest). The basic
> flow has been tried on the Galaxy S20; the newer parts have not
> ([S20 checklist](docs/device-tests/mvp.md)). iOS is untested. See
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

Some persistence tests run the app's SQL on Node's built-in SQLite (`node:sqlite`): a different
SQLite build from the phone's, so they do not replace device checks.

Run from `services/analysis` (see its [README](services/analysis/README.md) for setup):

```bash
ruff format --check app tests
ruff check app tests
mypy
python -m pytest -q
```

**CI:** [`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs both sets of checks on every pull request to `main` and every push to `main`. It has no builds, deployment or device tests, so a green run does not mean the app has been checked on a phone. The app job passed in GitHub Actions for pull request #2 and the push to `main` (`d802586`). The analysis job was added later and has not run on GitHub yet; its steps pass locally in a clean environment.

**Run manually when dependencies change** (not part of CI, because they depend on Expo's online services and can fail when Expo publishes a new patch):

```bash
npx expo install --check
npx expo-doctor
```

## Using the app

1. **New session** on the Sessions list: firearm, calibre, distance and planned shots/rounds.
2. Open the session and tap **Start round**. Shots fired defaults to the planned number; change it
   if the round was interrupted.
3. **Hole diameter:** a new session starts from an *assumed* 9.0 mm, shown as an assumption
   next to your calibre. Set the diameter your bullets make, or tap **Use 9.0 mm** to confirm
   it. Your choice carries over to the next round in the session. A hole touching a ring line
   gets the higher score, so the diameter matters near lines.
4. **Before photo (optional):** after covering old holes with matching stickers. **After photo:**
   after the round, from the same spot. Fill the frame with the whole target, hold the phone
   straight in front of it, and avoid glare and shadows. The app keeps an unchanged copy and an
   upright copy without location data; marks and analysis use the upright copy.
5. **Calibrate:** in the editor, tap where the outer ring crosses the line of numbers at the
   top, right, bottom and left. The rings are drawn back onto the photo so you can check the fit.
6. **Analyze photos** (when the service is set up, below). With a before photo the two are
   compared; without one only the after photo is used, which is less reliable. Suggestions are
   **dashed and not counted** until you accept them. Uncertain ones are marked **?**.
7. **Edit hits:** accept or delete suggestions (or accept all certain ones at once), tap to add
   your own marks, drag to move, set several shots for one hole, undo. Moving a suggestion
   accepts it.
8. Declare known **misses** and **unresolved** shots on the round screen. Missing marks are never
   counted as misses, and unresolved shots make the result a subtotal that names them.
9. **Confirm round** when the shots add up and no suggestion is left to review. Confirmed rounds
   cannot be changed.
10. Start the next round, or **Finish session**. The list and the session show demo scores
    separately from any verified ones.

If Android closes the app while the camera or photo picker is open, the app tries to save the
photo on the next start and otherwise tells you the pick was interrupted. Which cases actually
work, and that none is verified on a phone yet, is in
[docs/photo-recovery.md](docs/photo-recovery.md).

## Target and scoring

The owner's target is an X-Targets precision target whose layout matches the ISSF 25 m precision
and 50 m pistol target (rule 6.3.4.5: ring 10 is 50 mm, ring 1 is 500 mm, black area 200 mm).
The manufacturer does not state its dimensions, so the match is **not verified**; the app ships
only `demo-synthetic-v1`, the same ten-ring structure with invented radii (10 mm per ring). Every
score is labelled as demo and kept apart from verified scores. A hole touching the boundary
between two zones scores the higher value (the printed line counts as the boundary), and the
inner ten gives no extra points ([decision](docs/decisions/2026-10-28-scoring-and-hole-diameter.md)). What is needed to enable the real
target, and a measuring template, are in
[docs/target-calibration.md](docs/target-calibration.md).

## Analysis service

[`services/analysis`](services/analysis) is a local Python service (FastAPI, OpenCV) that
implements [`contracts/analysis.openapi.yaml`](contracts/analysis.openapi.yaml). It runs on your
computer, stores nothing and sends photos nowhere else. Its suggestions are heuristic image
processing, tested on synthetic images only. Setup, how to reach it from the S20 over Wi-Fi or
USB, and its limits are in its [README](services/analysis/README.md).

The app sends photos only after you tap **Analyze photos**, and only when an address is set:

```bash
# apps/mobile/.env.local (ignored by Git); see apps/mobile/.env.example
EXPO_PUBLIC_ANALYSIS_URL=http://192.168.1.23:8000
```

HTTPS is required in release builds. Development builds also accept plain HTTP to `localhost`,
`127.0.0.1` and private network addresses (10.x, 172.16–31.x, 192.168.x). Restart
`npx expo start` after changing the file. Without an address, analysis is off and you mark hits
yourself.

## Data and privacy

- Sessions, rounds, marks and results are stored locally in SQLite (`target-practice.db`).
- Photos are **copied** into the app's own document folder under generated names: an unchanged
  copy and an upright JPEG without metadata. The originals in the phone's library are never
  changed or deleted. Discarding a round or replacing a photo deletes only the app's copies.
- The unchanged copy keeps the photo's metadata, which can include the location. It never
  leaves the phone.
- Every copy is recorded in the database before it is written. At start, the app deletes only
  recorded copies that no round refers to and that are more than ten minutes old (left behind
  if the app stopped mid-save), checking each one just before deleting it. Files it did not
  record are never touched. Each database (normal, and the development UI-check database) has
  its own folder.
- Nothing is sent anywhere unless an analysis address is configured **and** you tap
  **Analyze photos**. Only the upright copies are sent, and only after the app has checked that
  they carry no location data.

## License

No license has been chosen yet.
