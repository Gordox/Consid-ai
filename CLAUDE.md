# Target Practice Log — Project Instructions

## Project Scope

Build a mobile app for recording recreational target-practice sessions. Users photograph a paper target or import photos from their phone, receive suggested hit locations and scores, correct the suggestions, and save confirmed rounds in a practice log.

The app reduces manual scorekeeping while making uncertainty visible. Image analysis is an assistant; the user confirms the result. Never represent automatically detected scores as official competition results.

The first release is a personal alpha, with potential commercialization later. Prioritize reliable scoring, a usable correction editor, and durable local records over accounts, monetization, or broad target support.

### Confirmed Requirements

- Support one specific target design initially.
- Reference image: https://m.media-amazon.com/images/I/71IV53NCzgL._AC_SL1500_.jpg
- Reuse the same target between rounds. Users cover previous holes with stickers matching the background: white on white and black on black.
- Support a reference photo taken after covering old holes and before shooting, followed by a photo after the round.
- Also support single-photo analysis so both approaches can be evaluated against the same rounds.
- Support both camera capture and phone-library import.
- Internet access is acceptable for alpha/beta analysis. Fully offline analysis is a later goal.
- Session setup includes firearm profile/name, firearm type, calibre, distance, planned shots per round, and an optional planned number of rounds.
- Users can continue rounds until they finish the session.
- A hit touching the boundary between two scores receives the higher score: touching the boundary between 6 and 7 scores 7.
- Users must be able to inspect and correct detection results before confirmation.
- Support misses, overlapping hits, and unresolved shots without fabricating detections.
- Save confirmed results, photos, settings, and notes in a practice log. Notes are deferred until after the personal alpha (owner decision, `docs/decisions/2026-10-29-notes-deferred.md`); they remain a planned feature.
- Primary physical test device: Samsung Galaxy S20. Keep the mobile architecture compatible with iOS, but prioritize Android validation.

### Product Boundaries

The initial product provides scoring, logging, and factual summaries such as round totals and comparable session history. The original idea includes optional feedback, but automated firearm-handling or technique diagnosis is outside the alpha.

Do not infer grip, trigger use, equipment faults, or corrective weapon-handling instructions from hit patterns. A target image does not establish those causes. Personal notes and instructor review can be supported without automated diagnosis.

Out of scope until explicitly requested:

- Multiple target families or automatic target-type discovery.
- On-device inference, real-time video scoring, or live tracking.
- Social features, leaderboards, subscriptions, payments, and public profiles.
- Competition certification or claims of guaranteed scoring accuracy.
- Custom model training or use of user photos for training without explicit consent.

## Technology Stack

These are implementation defaults selected for this project, not claims that infrastructure already exists.

| Area | Choice | Rationale |
| --- | --- | --- |
| Mobile | React Native, Expo, TypeScript in strict mode | Shared Android/iOS codebase and a practical native camera/editor workflow |
| Navigation | Expo Router | Conventional navigation within the Expo application |
| Capture/import | expo-camera and expo-image-picker | Guided capture plus system photo-library selection |
| Local persistence | expo-sqlite and app-private file storage | Durable drafts, records, and photo copies across restarts |
| Image analysis | Python, OpenCV, FastAPI | Image preprocessing, registration, detection, and a small typed HTTP interface |
| Backend when needed | ASP.NET Core | Familiar, typed application API for future accounts and synchronization |
| Server database when needed | PostgreSQL | Relational session/round records and transactional updates |
| Remote photos when needed | Private S3-compatible object storage | Image bytes remain separate from relational records |
| Local services | Docker Compose | Reproducible local development without orchestration overhead |

Start with the mobile app and a small Python analysis service. Local SQLite is the authority for the personal alpha's saved sessions. Do not scaffold ASP.NET Core, PostgreSQL, remote photo persistence, or account flows until a milestone requires them. When cloud persistence is introduced, define ownership and conflict resolution before implementing synchronization.

Model/provider selection remains open. Evaluate a hosted vision API alongside the OpenCV baseline using the same photos before committing to custom training or self-hosted inference. Do not integrate or send photos to a provider until the owner selects it. A general-purpose vision language model must not be the authority for numeric scores.

Verify compatible supported package versions in official documentation when scaffolding; pin dependencies and commit lockfiles. Use Expo development builds when native integration requires them. Do not assume everything will work inside Expo Go.

## Architecture Principles

- Keep the app simple: one mobile application and one analysis service initially.
- Separate UI, application workflows, domain rules, persistence, and external service calls.
- Keep screens and HTTP endpoints thin. Put deterministic scoring and validation in focused functions or classes.
- Use typed DTOs at boundaries and validate external input at runtime. TypeScript types alone are not validation.
- Avoid hidden globals, magic behavior, broad utility classes, unnecessary interfaces, and speculative abstractions.
- Make scoring independent of camera APIs, HTTP, databases, and AI providers.
- Treat detector output as untrusted suggestions. Validate coordinates, geometry, counts, and confidence values.
- Preserve original analysis separately from user-confirmed annotations. Reanalysis must never silently overwrite manual work.
- Version target definitions, scoring rules, and analysis algorithms. Keep the versions used for each saved result.
- Do not silently rescore historical rounds after configuration or algorithm changes.
- Store timestamps in UTC and display them in the user's local timezone. Preserve session date context.
- Use explicit units: target geometry in millimetres and distance in metres internally.
- Prefer small, reviewable changes and clear naming over frameworks layered on frameworks.

## CLI Contract and Validation

This product is a mobile app with an analysis API, not an end-user CLI. Do not copy endpoint-check flags, Go packages, or CLI exit codes from the reference project. The applicable contracts are session input, image upload, analysis responses, and developer commands.

- Validate session input before starting a round or requesting analysis. Trim human-entered labels, reject blank required values, and enforce documented Unicode-aware length limits.
- Require a finite positive distance, a positive integer planned shot count, a non-negative integer actual shot count, and either no planned round count or a positive integer count.
- Reject unsupported enum values, unknown target versions, malformed IDs, non-finite coordinates, non-positive scoring diameters, and invalid geometry. Define bounds in the contract rather than scattering magic numbers throughout the code.
- Paired analysis requires distinct baseline and post-round photo references. Single-photo analysis requires the post-round photo. Do not guess missing roles or silently switch modes.
- Validate images before expensive analysis, including decoded dimensions, file size, and actual format. Keep supported formats and limits aligned between the app, service, and OpenAPI document.
- Return structured errors containing a stable code, safe message, optional field errors, and a request ID. Never return raw stack traces or provider credentials.
- Distinguish invalid input, unusable images, authentication failure, rate limiting, provider failure, timeout, and unexpected server errors. The app must offer an appropriate correction, retake, or retry path.
- Define HTTP statuses, units, coordinate conventions, nullable fields, and version fields explicitly in OpenAPI. An empty successful detection result must not conceal an analysis failure.
- If evaluation scripts gain a CLI, validate arguments before I/O, provide help, write machine-readable results to stdout and diagnostics to stderr, and return a non-zero exit code on failure. No evaluation CLI is required merely by this heading.

## Code Conventions and Error Handling

- TypeScript: strict mode, explicit boundary DTOs, descriptive names, and runtime validation of unknown input. Avoid unsafe casts, non-null assertions, and `any` as substitutes for validation.
- Python: type function parameters and return values; use explicit request/response models and focused modules. Keep OpenCV array manipulation inside imaging/detection code rather than HTTP handlers.
- C#, when introduced: enable nullable reference types, use typed DTOs, propagate cancellation tokens for I/O, and keep endpoints thin.
- Keep formatting and lint rules consistent per language. Select and pin minimal tooling at scaffold time; do not add competing formatters or test runners.
- Return expected domain failures explicitly or use specific exceptions consistently. Catch errors at boundaries where they can be translated or handled; preserve useful causes in sanitized internal logs.
- Never use a blanket catch to report success, zero points, or no hits. Treat cancellation separately from unexpected failures.
- Use bounded timeouts and resource cleanup. Close files and release temporary images even when processing fails.
- Keep scoring deterministic. Pass dependencies explicitly and inject time/ID generation where tests need control.
- Comments explain constraints or non-obvious decisions. Do not narrate obvious code or leave placeholders in completed features.

## Planned Folder Structure

Create directories only when implementation needs them. The API directory is reserved for the later backend.

```text
CLAUDE.md
README.md
apps/
  mobile/
    app/                       # Expo Router routes; thin screens
    src/
      features/
        sessions/
        rounds/
        target-review/
        practice-log/
      domain/                  # Scoring, target geometry, invariants
      services/                # Capture/import and analysis client
      persistence/             # SQLite migrations and repositories
      components/              # Shared accessible UI
      config/
    tests/
    package.json               # Run, lint, typecheck, and test scripts
    package-lock.json
services/
  analysis/
    app/
      api/                     # Validated HTTP requests/responses
      imaging/                 # Orientation, quality, registration
      detection/               # Hit candidates and uncertainty
      schemas/
      config/
    tests/
    pyproject.toml             # Runtime, dependencies, and tool configuration
  api/                         # Later: ASP.NET Core application API
contracts/
  analysis.openapi.yaml
  target-definition.schema.json
  scoring-fixtures/            # Shared expected results if scoring spans runtimes
assets/
  targets/                     # Verified geometry; authorized reference assets
docs/
  decisions/
  evaluation.md
  target-calibration.md
infra/
  compose.yaml
.github/
  workflows/
    ci.yml                     # Static checks, tests, and documented build checks
```

## Session and Round Workflow

1. Create a session and select the target and firearm settings.
2. Set planned shots per round and optionally the number of rounds.
3. Start a round. Default actual shots fired to planned shots, but allow correction for interrupted rounds.
4. Capture/import a baseline after covering old holes, or explicitly choose single-photo mode.
5. Capture/import the post-round photo.
6. Save the draft and photo copies locally before requesting analysis.
7. Analyze the images and open the review editor.
8. Let the user correct hit positions, hole sizes, shot accounting, and notes (notes deferred until after the alpha).
9. Confirm and save the round atomically.
10. Repeat or finish the session and show the practice log entry.

Suggested round states: draft, analyzing, review, confirmed. Track analysis attempts and their failures separately so a failed request never destroys a draft. Permit resuming unfinished sessions after restart.

Network loss must preserve photos and edits. Allow explicit retry without duplicate rounds or duplicate confirmation. Offline capture, local review, and log access remain usable even though new automatic analysis requires internet.

## Image Analysis Contract

The pipeline should:

1. Decode and validate the images, apply orientation, and retain enough resolution to inspect holes.
2. Assess blur, glare, shadows, clipping, and whether sufficient target geometry is visible.
3. Locate the known target and rectify perspective into a canonical target plane.
4. In paired mode, register both photos to that same plane before comparing them.
5. Detect candidate new holes and return geometry, quality warnings, and confidence where meaningful.
6. Map candidates into target coordinates for deterministic scoring and review.

Do not subtract unaligned photos or assume matching image dimensions mean matching geometry. Do not assume background-matching stickers are invisible. Sticker edges, tears, lighting changes, and holes through stickers must be evaluated explicitly.

The analysis request identifies the round, attempt, mode, and target-definition version. The result identifies its algorithm/model version, image dimensions and transforms, target-registration status, candidate IDs and geometry, and warnings. Define this contract in OpenAPI before connecting the client.

Return a clear unusable-image or registration-failed result when appropriate. Offer retake or manual review instead of a confident-looking score. Reject stale results if the user replaces a photo or starts a newer attempt.

Use bounded request timeouts and cancellation. Do not add a queue or broker until measured processing times require asynchronous jobs. Configure and document upload and processing limits.

## Target Geometry and Scoring

The product photo is a visual reference, not a trustworthy physical calibration source. Do not invent target dimensions, ring radii, maximum score, or printed line widths.

Before real scoring is enabled, obtain a verified target specification: physical size, scoring regions, boundary convention, and sufficient landmarks for calibration. If unavailable, implement the workflow with clearly labeled synthetic fixtures and keep real scoring unavailable.

Store hit centres and nominal scoring radii in the canonical target plane, not display pixels. The review overlay must preserve mappings among source-image pixels, rectified coordinates, and screen coordinates through zoom and pan.

Use the highest-valued scoring region touched by the scoring footprint. For a verified concentric circular target, contact with a region of radius R occurs when centre distance d minus scoring radius r is less than or equal to R. Apply this only when that circular geometry and boundary definition are verified.

Calibre labels and ragged tears do not automatically establish a scoring diameter. Define the nominal diameter source explicitly; let the user adjust an uncertain estimate. Do not treat the outer extent of torn paper as the bullet's scoring footprint. Printed-line treatment and acceptable measurement tolerance remain calibration decisions.

Uncertainty near a boundary requires review. A numerical epsilon may address floating-point noise, but must not become an undocumented scoring allowance.

- Missing detections are not automatically misses.
- Never generate extra hits just to match the expected shot count.
- Actual shots fired must equal confirmed hits plus declared misses plus unresolved shots before confirmation.
- Multiple confirmed shots may share an overlapping location, but multiplicity requires explicit user input.
- A round with unresolved shots may be saved as confirmed by the user but incomplete; show a known subtotal, not an exact final total.
- Misses score zero. Unresolved shots have unknown scores, not zero.
- Keep provisional suggestions distinct from confirmed results in both storage and UI.

## Review Editor

Support zoom/pan, selection, add/move/delete hit markers, hole-size adjustment, undo, and immediate score recalculation. Make selection distinct from dragging and keep controls usable on the Galaxy S20.

Show actual shot count, confirmed hits, declared misses, unresolved shots, and score completeness. Highlight uncertain candidates without relying on colour alone. Allow switching between baseline and post-round views in paired mode.

Persist edits locally. Changing photos or rerunning analysis must prompt before replacing the current review. Store manual additions and edits with their provenance. Confirming a round is an explicit action.

## Minimal Domain Records

| Record | Essential information |
| --- | --- |
| Firearm profile | ID, display name, type, calibre label; optional verified scoring diameter |
| Target definition | ID/version, verified dimensions, geometry, scoring rules, calibration provenance |
| Session | ID, timestamps, status, firearm/settings snapshot, target version, planned shots/rounds, notes (deferred until after the alpha) |
| Round | ID, session ID, sequence, actual shots, analysis mode, state, confirmed revision, completeness |
| Photo | ID, role, private local path, dimensions, orientation normalization, capture/import timestamp |
| Analysis attempt | ID, input photo IDs, algorithm version, status, warnings, immutable candidates |
| Confirmed shot | ID, round ID, hit/miss/unresolved, optional target geometry, score, source/correction provenance |

Use stable IDs, foreign keys, unique round sequences per session, and transactions. Snapshot settings so editing a firearm profile does not change historical sessions. Store photo files outside SQLite and retain references. Do not delete originals when creating resized or rectified derivatives.

## Security and Privacy

- Validate file signatures and decoded content, dimensions, byte limits, and supported formats; do not trust extensions or MIME headers alone.
- Use generated filenames and app-private paths. Do not accept arbitrary remote image URLs or client-controlled server paths.
- Copy gallery selections into durable app storage; temporary picker URIs are not permanent records.
- Normalize orientation before removing unnecessary metadata. Remove location metadata from uploaded derivatives by default.
- Use HTTPS outside local development. Keep credentials and provider keys on the server, never in the app bundle.
- Protect externally reachable analysis with appropriate authentication and request limits before deployment; personal use is not a reason to expose an unrestricted endpoint.
- Default to temporary server-side image processing with cleanup on success and failure. Persistent remote photos require an explicit product decision.
- Never log image bytes, credentials, or sensitive photo metadata. Log request IDs and actionable errors.
- No training uploads, third-party AI processing, analytics, or public photo access without explicit approval.
- Request camera/library permissions only when needed and handle denial gracefully.

## Implementation Order

1. Scaffold mobile and analysis projects with documented local setup and minimal tooling.
2. Define versioned target and analysis contracts; create synthetic fixtures while real calibration is pending.
3. Implement deterministic scoring and meaningful boundary tests.
4. Build capture/import, durable draft persistence, and the manual editor with fixture detections.
5. Implement an OpenCV baseline; evaluate an owner-selected hosted vision provider if approved. Compare single-photo versus paired-photo performance on the same fixtures.
6. Connect real analysis, uncertainty handling, retries, and confirmation.
7. Complete session flow and the local practice log.
8. Evaluate on real Galaxy S20 photos before considering custom models, cloud sync, or offline inference.

Proceed on work that does not depend on missing measurements. Do not block the editor, logging, or synthetic scoring tests on access to real target photos. Clearly distinguish fixtures from validated real-world behavior.

## Setup, Run, and Build

The following is the intended developer contract, not evidence that a repository or runnable implementation already exists. Implement and verify these commands when scaffolding, then keep README aligned with the actual project. Do not create fake scripts that exit successfully without doing their stated work.

Record supported Node.js, Python, Expo SDK, Java, and Android SDK versions in the repository. Default to npm for the mobile app and an isolated Python virtual environment for analysis unless existing repository tooling dictates otherwise. Pin dependencies and document reproducible installation. Choose the license with the owner.

Mobile setup and development, from `apps/mobile` after the lockfile exists:

```bash
npm ci
npx expo start
```

For a local native Android development build with the documented Android toolchain installed:

```bash
npx expo run:android --device
```

Analysis setup, from `services/analysis` after `pyproject.toml` and `app/main.py` exist:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e '.[dev]'
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Define the `dev` extra for the selected verification tools. `app.main:app` is the planned FastAPI entry point. Document Windows equivalents if Windows becomes a supported development environment.

On a USB-connected Android test device, `adb reverse tcp:8000 tcp:8000` can provide a development connection to the local service. Document the corresponding app API URL and development-only networking configuration. Device localhost otherwise refers to the device, not the development computer. Do not weaken production HTTPS settings for local testing.

The app may contain a non-secret API base URL. Provider credentials remain in server environment variables. Add `.env.example` only when its settings are implemented, with placeholders and descriptions; exclude real environment files from Git.

The command above builds a development app, not a release. Before v1.0, document and verify the chosen Android release build/signing procedure and produce an installable artifact for personal testing. Do not choose a paid build service, publish to a store, or commit signing keys without authorization. Add Docker Compose commands only when the service configuration exists.

## Verification

Define meaningful `lint`, `typecheck`, and `test` scripts in the mobile package. Run from `apps/mobile` once implemented:

```bash
npm run lint
npm run typecheck
npm test -- --runInBand
```

The test invocation assumes a Jest-compatible runner; if another runner is selected, document its actual non-watch command instead. Python checks must use the pinned formatter/linter/type checker and test runner recorded in `pyproject.toml`; add their exact commands to README when selected. Do not claim unconfigured tooling exists.

CI must install reproducibly, check formatting without rewriting files, run lint/type checks and automated tests, and perform the documented build checks. Keep automated tests independent of live AI services; use validated fixtures and controlled responses. Run paid/provider evaluations explicitly, outside routine CI. Physical device testing is a separate required check, not implied by CI success.

Test scoring with synthetic cases: region interiors, exact boundary contact, just inside/outside contact, outer-ring misses, varying nominal diameters, invalid geometry, and unresolved shots. If scoring exists in more than one runtime, run the same versioned fixtures against each implementation.

Test the complete workflow: start session, import/capture, analyze, edit, confirm, next round, finish, reopen log. Cover interruption/restart, denied permissions, upload failure, timeout, duplicate retry, stale responses, invalid service output, and photo replacement after edits.

Test overlay coordinate transforms under rotation, perspective rectification, zoom, and pan. Test persistence migrations and transactional confirmation.

Evaluate real labeled photos covering black/white backgrounds, matching stickers, new holes through stickers, overlapping hits, tears, boundary hits, shadows, glare, blur, and angled capture. Separate evaluation photos from development/tuning photos, preferably by physical session.

Compare both analysis modes on the same post-round photos. Record detection precision/recall, scoring disagreement with manually adjudicated results, rejection rate, correction time, processing latency, and device memory behavior. No accuracy or latency threshold has been agreed yet; propose evidence-based acceptance thresholds after the baseline evaluation.

An alpha is ready for personal testing when the end-to-end flow works on the Galaxy S20, corrections survive restart, uncertainty is visible, network failures do not lose work, and results can be independently inspected. Do not claim production readiness or validated detection accuracy from synthetic tests alone.

## Definition of Done: v1.0

Here, v1.0 means a usable personal release with the agreed single-target scope, not a commercial launch or certified scoring system. Alpha milestones can be completed before these release criteria are met.

- Camera capture and gallery import work on the Samsung Galaxy S20 with permission denial handled.
- Both single-photo and paired-photo workflows work with an implemented, identified analysis method; no production path relies on fixture detections.
- The target's dimensions and scoring rules are verified and versioned. Boundary contact receives the higher score and has automated tests.
- Users can start sessions, adjust actual shot counts, review/edit detections, mark misses/unresolved shots, confirm rounds, continue, finish, and reopen the practice log.
- Editor actions, coordinate transforms, undo, size adjustment, and score updates work on the physical device.
- Incomplete results display an explicit subtotal and unresolved count; no missing shot is silently scored zero or invented.
- Drafts, photo references, and confirmed records survive app restart. Failed requests, cancellation, and retries do not lose or duplicate records.
- Real-photo evaluation compares both analysis modes, reports limitations, and meets owner-approved accuracy/correction-effort and latency thresholds. Set those thresholds from baseline evidence before declaring v1.0 complete.
- Relevant static checks, tests, and documented builds pass. Manual Galaxy S20 checks and remaining platform gaps are recorded.
- README covers setup, configuration, local device connectivity, build/install steps, supported target, scoring conventions, privacy, data storage, limitations, and recovery from failed analysis.
- An installable Android build has been used to record at least one complete real practice session and reopen its saved results.
- No secrets, placeholder implementations, hidden failures, or unapproved uploads remain in the released feature set.
- Accounts, cloud sync, offline inference, iOS release, and store publication are not required for this personal v1.0.

## Agent Working Rules

- Read this file and relevant existing code before changing implementation.
- Keep code, identifiers, documentation, and initial UI text in English unless requested otherwise.
- Prefer clear typed code, small functions, early returns, explicit errors, and comments only where they explain non-obvious reasoning.
- Do not use TypeScript `any` to bypass validation. Validate and narrow unknown external values.
- Do not swallow exceptions or turn failed analysis into an empty successful result.
- Use existing dependencies first. The stack above is the baseline; ask before adding dependencies outside it, paid services, or a new AI provider.
- Do not replace the mobile framework, backend language, database choices, or persistence strategy without approval.
- Do not introduce microservices beyond the analysis boundary, CQRS, event sourcing, brokers, Kubernetes, generic repository frameworks, or speculative plugin systems.
- Do not build later milestones merely because their folders appear in this document.
- Do not invent calibration values, provider capabilities, benchmarks, credentials, or completed test results.
- Do not delete user photos/records, rewrite confirmed results, run destructive migrations, publish the app, or deploy externally without explicit authorization.
- Preserve unrelated changes and do not commit secrets or real private photo datasets.
- Work in feature branches. Do not force-push, rewrite shared history, or push directly to the default branch.
- Do not weaken or delete tests to make verification pass. Do not change documented contracts or scoring semantics without approval.
- Run relevant lint, type checks, and tests; document actual commands in README once tooling exists. Report what was tested and what remains unverified.
- Update README and contracts when behavior changes. Record material architectural decisions briefly in docs/decisions.

## Open Inputs

These are unresolved, not permission to invent requirements:

1. Verified physical dimensions and scoring-region geometry of the chosen target, including printed-line treatment.
2. Real Galaxy S20 before/after photo pairs with manually confirmed hits and scores.
3. Exact calibre choices and the source of nominal scoring diameters.
4. App name, branding, minimum OS versions, and later iOS test device.
5. Analysis deployment/provider choice and measured quality/performance acceptance thresholds.

Ask only when an unresolved input blocks the next concrete step. Continue independent work using clearly labeled fixtures and documented assumptions.
