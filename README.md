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
> flow was tried on the Galaxy S20 before the v2.1 redesign; the redesigned interface has not
> been run on any phone yet ([S20 checklist](docs/device-tests/mvp.md)). iOS is untested. See
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

The interface follows [docs/design/ui-ux.md](docs/design/ui-ux.md) (v2.1). The app always opens
your normal database; there is no developer or test mode in the app.

1. **Sessions** lists your sessions with **All / In progress / Finished** filters. Tap
   **New session**: firearm name, firearm type (chosen in a sheet, nothing preselected), calibre
   (searchable list or Custom), distance and planned shots/rounds. **Profiles and templates**
   saves firearm profiles (name, type, calibre) and training templates (distance, shots per
   round, optional rounds); the form starts from the last used ones, every value can be changed
   for one session, and saved sessions never change when a profile or template does.
2. Open a session and tap **Start round**. The round starts with **Actual shots** set to the
   planned number; change it if the round was interrupted.
3. **Hole diameter** starts as an *assumed* 9.0 mm, labelled **Assumed** next to your calibre.
   Change it, or tap **Use this diameter** to confirm it. Your choice carries over to the next
   round. A hole touching a ring line gets the higher score, so the diameter matters near lines.
4. **Add photos:** the **After photo** is the main one; take it with the app's **Camera**, whose
   circle and frame are only a guide (not detection, alignment or scoring), or choose it from the
   **Library**. A **Before photo** is optional, under **Improve detection**, and helps when you
   reuse a target. The app keeps an unchanged copy and an upright copy without location data;
   marks and analysis use the upright copy. Tap a photo, or **Inspect hits**, to view it full
   screen, read-only.
5. **Align target:** in the editor, place the four points where the outer ring crosses the line
   of numbers: top, right, bottom, left. Drag before lifting to fine-position a point under the
   magnifier; afterwards drag any point again and the rings follow. Points in the wrong order or
   on top of each other are explained and cannot be used. Hits keep their place on the photo
   when you adjust the points; their scores are recalculated.
6. **Analyse photos** (when the service is set up, below) or **Mark hits manually**. With a
   before photo the two are compared; without one only the after photo is used, which is less
   reliable. If the two photos cannot be aligned, you can choose **Analyse after photo only**.
   Suggestions are **dashed with ?** and **not counted** until you accept them.
7. **Review hits:** the editor has explicit tools: **Add hits** (touch to add), **Select and
   pan** (nothing is added), **Align**, plus undo, zoom and fit. Accepted hits are numbered.
   Select a marker to accept or remove it, move it, or set several shots for one hole. Every
   marker is also listed below the photo. There is no "accept all": each suggestion is reviewed.
8. **Review round:** declare known **misses** and **unresolved** shots. Missing marks are never
   counted as misses, and unresolved shots make the result a subtotal that names them.
9. **Confirm round** when the shots add up and no suggestion is left. Confirmed rounds are
   read-only. Then **Start next round** or go **Back to session**.
10. **Finish session** (a draft round must be continued or discarded first). Demo scores are
    always labelled and kept apart from any verified ones.

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

The app sends photos only after you tap **Analyse photos**, and only when an address is set:

```bash
# apps/mobile/.env.local (ignored by Git); see apps/mobile/.env.example
EXPO_PUBLIC_ANALYSIS_URL=http://192.168.1.23:8000
```

HTTPS is required in release builds. Development builds also accept plain HTTP to `localhost`,
`127.0.0.1` and private network addresses (10.x, 172.16–31.x, 192.168.x). Restart
`npx expo start` after changing the file. Without an address, analysis is off and you mark hits
yourself.

While an analysis runs you can tap **Cancel analysis**. The app stops waiting and ignores any
late answer, but the service may still finish its work on the photos it has received.

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
  record are never touched. The app uses one database and the `photos` folder. Earlier
  development builds could also create test databases (`target-practice-ui-check.db`,
  `target-practice-device-check.db`) and a `photos-ui-check` folder; this version never opens,
  moves or deletes them, so they stay on the device until the app is
  uninstalled.
- Nothing is sent anywhere unless an analysis address is configured **and** you tap
  **Analyse photos**. Only the upright copies are sent, and only after the app has checked that
  they carry no location data.

## License

No license has been chosen yet.
