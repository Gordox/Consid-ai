# Target Practice — UI/UX specification 2.1

Date: 2026-10-28  
UI language: English  
Document language: English for direct implementation handoff  
Status: implementation target authorised by the owner; this document does not certify implementation or device verification.

## 1. Purpose and authority

A calm, precise mobile interface for recording recreational target-practice sessions: create a session, photograph a round, align the target, review detections, confirm a result, and retain a practice log. The interface must make uncertainty visible and manual correction easy.

This document governs UI behaviour; tokens.json defines exact visual values. Both replace the old docs/design/ui-ux.md and five legacy boards. Existing domain and persistence contracts remain authoritative for data integrity. If a PNG contradicts this text, follow this text; reconcile token discrepancies explicitly in the implementation report. PNGs are rendered references, not measurements to reverse engineer. The HTML catalogue uses the same tokens. Do not treat it as a working scoring application or proof of React Native behaviour.

The user supplied five reference boards. Foundations, Components, Current MVP and Prototype Flows were visually inspected. The Future Features attachment is only 191 × 2047 pixels and its fine text is not reliably readable. No unreadable detail is treated as a requirement.

TargetScan informed the emphasis on quick review and precise editing, not the visual identity or detection algorithm. Do not copy its text, artwork or implementation.

## 2. Scope and changes from the old boards

Included: sessions, rounds, photo source, before/after photos, calibration, analysis states, editor, shot accounting, confirmation, completed history and recovery states.

Excluded: login, account creation, cloud sync, activity-type management, firearm profiles, subscriptions, technique coaching and general developer tools. These exclusions follow the current MVP scope, not the older future-feature boards.

Changes:
- Keep charcoal and orange; reduce decorative glow and technical noise. No camouflage or weapon illustrations.
- Use native system typography instead of an added Inter dependency.
- Persistent labels above inputs; input borders are visible independently of the label.
- Session cards now open details, unlike the old create/list-only MVP.
- One Sessions hub with All / In progress / Finished filters; no redundant bottom tabs.
- New session stays available during loading and read errors after database startup succeeds.
- No default firearm type in a new form.
- Explicit Demo score and Incomplete labels; never silently mix demo and real points.
- Numbered accepted markers and dashed '?' suggestions; orange alone never means accepted.
- A precision magnifier is part of this implementation target; its existing implementation status must be checked.
- Replace oversized all-in-one images with per-component and per-screen exports.

## 3. Colour tokens

All UI colours are sRGB. Except scrim, tokens are opaque. Do not use global opacity on a whole control to create disabled states. Semantic colour is always paired with text, icon or border.

| Token | HEX | Purpose |
|---|---|---|
| `background` | `#111315` | App canvas |
| `surface` | `#1C2024` | Cards and inputs |
| `elevated` | `#272D33` | Sheets, pressed secondary controls |
| `text` | `#F4F2EF` | Primary content |
| `secondary` | `#B5BDC5` | Secondary descriptions |
| `muted` | `#929DA8` | Metadata and placeholders |
| `accent` | `#FF782D` | Primary actions and selected controls |
| `accentPressed` | `#E96820` | Primary pressed |
| `onAccent` | `#17130F` | Text/icons on orange |
| `accentSurface` | `#33241C` | Selected background |
| `border` | `#3A424B` | Decorative separators only |
| `inputBorder` | `#68727C` | Interactive input outline |
| `focus` | `#FFAC7B` | Focus ring |
| `success` | `#8ED9AB` | Confirmed/saved text |
| `successSurface` | `#1D3027` | Success background |
| `warning` | `#F3C77B` | Pending/demo/unresolved text |
| `warningSurface` | `#332C20` | Warning background |
| `error` | `#FFABA7` | Error and destructive text |
| `errorSurface` | `#352426` | Error background |
| `info` | `#A5C9EB` | Information text |
| `infoSurface` | `#202D39` | Information background |
| `disabledSurface` | `#272D33` | Disabled control surface |
| `disabledText` | `#929DA8` | Disabled control text |
| `photoPaper` | `#E7E2D5` | Illustrative target only |
| `photoInk` | `#262724` | Illustrative target only |
| `scrim` | `#000000B8` | Modal overlay, 72% black |

### Contrast calculations

Ratios use the sRGB relative luminance formula. These are token-pair calculations, not certification of the complete app. Normal text target: 4.5:1. Meaningful control boundaries and focus indicators target: 3:1 against adjacent colours. The decorative `border` token is not sufficient as the only input boundary.

| Foreground / background | Ratio | Use |
|---|---:|---|
| `text` / `background` | 16.66:1 | Main text |
| `secondary` / `surface` | 8.62:1 | Descriptions |
| `muted` / `surface` | 5.94:1 | Metadata |
| `onAccent` / `accent` | 7.02:1 | Primary label |
| `onAccent` / `accentPressed` | 5.69:1 | Pressed label |
| `inputBorder` / `surface` | 3.35:1 | Input boundary |
| `inputBorder` / `background` | 3.80:1 | Control boundary |
| `focus` / `surface` | 8.93:1 | Focus ring |
| `error` / `errorSurface` | 8.13:1 | Error text |
| `success` / `successSurface` | 8.42:1 | Saved text |
| `warning` / `warningSurface` | 8.72:1 | Pending text |
| `info` / `infoSurface` | 8.13:1 | Information text |
| `text` / `accent` | 2.36:1 | Forbidden normal text pairing |

Never use off-white text on the orange primary button. Use onAccent. On arbitrary photos, put labels and controls on opaque background/surface plates. Markers use two-tone outlines and a number or '?' symbol; contrast against every photograph cannot be guaranteed by one colour.

## 4. Typography

Native: iOS System (SF Pro), Android System (Roboto). No font download is required. Web reference: system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif. Exported PNGs use the renderer's installed system fallback; they do not reproduce SF Pro. Font metrics must be checked on both platforms.

| Token | Size | Line height | Weight |
|---|---:|---:|---:|
| `display` | 40 | 48 | 600 |
| `title` | 28 | 34 | 650 |
| `section` | 20 | 26 | 600 |
| `body` | 16 | 24 | 400 |
| `button` | 16 | 22 | 600 |
| `label` | 14 | 20 | 600 |
| `caption` | 13 | 18 | 400 |
| `micro` | 12 | 16 | 600 |

Sizes are dp/sp-style logical units on Android and points on iOS. Native text scaling stays enabled. Weight 650 is a design target; use 600 where the platform font does not support it. Numeric scores use tabular numerals when supported. Display scores use 40/48; the large summary recipe uses 48/58 as an explicit local exception.

Page titles: -0.6 logical unit letter spacing. Eyebrow labels: 12/16, weight 600, 1.5 spacing, uppercase. Body and inputs use sentence case. Avoid uppercase paragraphs. Scores must include their units and status in accessible text.

Never clamp essential labels, error messages, names or scores to one line. At large text sizes, place paired fields and statistics vertically. Micro text is for nonessential metadata only, not instructions needed to complete a task.

## 5. Layout, spacing and motion

- Spacing scale: 4, 8, 12, 16, 20, 24, 32, 40, 48.
- Screen horizontal inset: 20. Group gap: 24. Field gap: 16. Label-to-input gap: 8. Icon-to-label gap: 8.
- Cards: 16 padding; 16 corner radius; 1 decorative border.
- Input and button radius: 12. Small badge radius: 8. Sheets/dialogs: 24. Circular shapes: 999.
- Main button minimum height: 52. Input minimum height: 56. All actionable hit areas: at least 48 × 48 on both platforms.
- Icon visual size: 24 normally, 20 in compact rows, 16 for inline cues; all use 1.75 stroke. Small icons do not imply small touch targets.
- Selected outlines: 2. Focus outline: 2 with 3 offset in web reference; translate to a clearly visible native focus treatment.
- One primary action per decision area. Two secondary actions may share a row only while labels fit.
- Screen exports: Android 360 logical width; iPhone 390 logical width. All PNGs are exported at 2×.
- The artboards show full scrollable content, not a fixed device viewport. Some are taller than a physical screen.
- Mock safe bands: Android 24 top/24 bottom; iPhone 54 top/34 bottom. These are presentation values, NEVER runtime constants. Use actual safe-area insets once per edge.
- Forms scroll with keyboard avoidance. Primary actions remain reachable, not necessarily simultaneously visible with every field.
- Editor controls sit outside the gesture canvas. A bottom action may be sticky only if content includes equivalent clearance plus safe inset.
- iPhone: respect back swipe and home indicator. Android: respect system Back and edge-to-edge insets. Both must preserve drafts.
- If a banner moves content down, keyboard layout must account for the real content position. Do not hardcode the test banner's height.
- Motion: press 100 ms, transition 180 ms, sheet 220 ms. No decorative glow, parallax, looping shimmer or mandatory motion. Reduced-motion mode removes nonessential movement.

## 6. Component catalogue and implementation contracts

PNG paths are images/components/<ID>.png and images/screens/<android|ios>/<ID>.png. Every catalogue item has its own PNG; some images show several states of the same component family. Icons also have individual SVG and PNG files.

| ID | Component | Contract |
|---|---|---|
| 01-colors | Colour tokens | Semantic tokens only; do not infer values from screenshots. |
| 02-typography | Typography | Native scaling and system fonts; no bundled Inter. |
| 03-buttons | Buttons | Default, pressed, focus, disabled, busy; busy action preserves label and rejects double submit. |
| 04-icon-buttons | Icon buttons | Accessible action name, 48 hit area; destructive actions cannot be ambiguous. |
| 05-text-fields | Text fields | Persistent label; empty, filled, focus, invalid, locked; label and error associated with field. |
| 06-choice-list | Choice list | Radio semantics, exactly one value; selected check plus border. New form starts unselected. |
| 07-select-sheet | Select & bottom sheet | Trigger exposes value and expanded state; modal choice list; safe Cancel/Back restores previous value until Done. |
| 08-segments | Segmented control | Selection is text + background; filters are local view state, not navigation stacks. |
| 09-checkbox-switch | Checkbox & switch | Checkbox for explicit acknowledgement; switch only for reversible on/off display behaviour. |
| 10-status-badges | Status badges | Text describes state. Badge alone is not a button or a substitute for help text. |
| 11-banners | Banners & feedback | Inline status with icon and explicit recovery. Do not promise data integrity after unknown failures. |
| 12-session-card | Session card | Entire card opens details; accessible name includes date, state, round count and score basis. |
| 13-round-card | Round card | Draft opens editor; confirmed opens read-only result. No silent editing of confirmed history. |
| 14-score-summary | Score summary | Demo vs verified score basis, total vs subtotal, accounted vs unresolved are distinct dimensions. |
| 15-photo-card | Photo input | Before optional, After required for image review. Source cancellation preserves existing photo. |
| 16-progress | Progress & steps | Indeterminate unless measurable progress exists; cancelling keeps draft. Skeleton hidden from screen reader. |
| 17-editor-markers | Hit markers | Accepted: numbered solid; suggestion: dashed question mark; selected: focus halo. Touch geometry is separate from hole diameter. |
| 18-editor-toolbar | Editor tools & magnifier | Explicit add vs pan mode. Undo is local editor history. Fit and zoom have accessible buttons. |
| 19-hit-inspector | Hit inspector | Shows selected hit status, diameter assumption and multiplicity. Removing proposal never silently records a miss. |
| 20-shot-accounting | Shot accounting | Actual shots = confirmed marker multiplicities + explicit misses + unresolved. Suggestions are excluded. |
| 21-dialogs | Confirmation dialog | Modal focus, safe choice first, Android Back cancels; restore triggering focus if staying. |
| 22-empty-error | Empty & error states | Empty only after successful zero-row read. Read error preserves older cards when available. |
| 23-navigation | Navigation & safe areas | Single stack. Return to same draft after cancel; current step is not automatically complete. |
| 24-icons | Icon inventory | Original reference SVGs included; production can map names to installed Lucide equivalents. |

### Detailed control states

Buttons: orange primary; pressed accentPressed; focus ring; disabled explicit colours and disabled semantics. Loading button reads “Saving…” and exposes busy state. Never signal progress with a spinner alone. Danger uses errorSurface/error, not orange. A disabled primary should have nearby text explaining the missing prerequisite when unclear.

Inputs: labels remain visible above entered values. On first submit validate all fields and focus the first error. Before first submit show no field errors. After first submit use the domain validator on change and update only that field's displayed error. Do not add independent UI validation rules. Error text precedes neither the label nor input in reading order; announce an error summary once.

Selection: use radio rows for up to four short choices; for the Firearm type form field, use the select sheet with the four radio choices and Done/Cancel. Do not render two independent selectors for the same field. Checkmark means selected, not successful save. Unselected rows have an empty radio indicator.

Dialogs: initial accessible focus goes to the title, with safe action first in reading order. Staying restores focus to the opener if mounted. Leaving navigates and focuses the destination heading. Backdrop dismissal only where equivalent to Cancel; destructive action always requires an explicit labelled button.

Banners: error is not automatically fatal. Keep existing photos, fields and previous list contents unless a documented domain transition requires removal. Announce a new status once; rerenders must not repeat it continuously.

## 7. Screens and navigation

All screens have both Android and iPhone PNG exports.

| ID | Screen | Primary purpose |
|---|---|---|
| 01-sessions | Sessions | See screen-specific behaviour below |
| 02-new-session | New session | See screen-specific behaviour below |
| 03-session-detail | Session detail | See screen-specific behaviour below |
| 04-round-setup | New round | See screen-specific behaviour below |
| 05-round-photos | Round photos | See screen-specific behaviour below |
| 06-photo-source | Photo source | See screen-specific behaviour below |
| 07-calibration | Align target | See screen-specific behaviour below |
| 08-analysis-choice | Analyse or mark manually | See screen-specific behaviour below |
| 09-analysing | Analysis in progress | See screen-specific behaviour below |
| 10-hit-review | Review hits | See screen-specific behaviour below |
| 11-manual-editor | Manual editor | See screen-specific behaviour below |
| 12-round-confirm | Confirm round | See screen-specific behaviour below |
| 13-round-complete | Round confirmed | See screen-specific behaviour below |
| 14-session-summary | Session summary | See screen-specific behaviour below |
| 15-analysis-error | Analysis unavailable | See screen-specific behaviour below |
| 16-permission | Camera permission | See screen-specific behaviour below |
| 17-resume-draft | Resume draft | See screen-specific behaviour below |
| 18-list-error | List refresh error | See screen-specific behaviour below |
| 19-form-error | Form validation | See screen-specific behaviour below |
| 20-save-error | Uncertain save result | See screen-specific behaviour below |

Main route: Sessions → Session detail → New round → Photos → Align target → Analyse or mark manually → Review hits → Review round → Confirmed → Session detail → Session complete → Sessions.

- Sessions filters do not move records between storage locations. Finished sessions are history in the same hub.
- New session uses no default firearm type. Name and calibre remain session snapshots; no profile feature is introduced.
- Session detail shows only a subtotal while the session is active. A draft must be continued or discarded before finishing.
- New round prefills planned shot count as an editable starting value. Diameter starts as an explicitly labelled assumption, never a silent fact derived from a calibre string.
- Before photo is recommended for patched/reused targets. After-only analysis remains possible with a visible limitation.
- Photo source delegates camera/library to platform UI. No custom fake camera screen is specified. Permission is requested after user action. Denied access offers settings and the alternative source.
- Alignment uses four named ring intersections in order: top, right, bottom, left. Show the overlay for verification and allow undo/reset. Sample target art is synthetic, not a verified scoring definition.
- Analyse action explains the image destination. No image is sent just by opening the screen. Endpoint URL and implementation details belong in settings/development configuration, not everyday workflow copy.
- Analysing locks conflicting image edits. Cancellation must not delete the round. Failure offers Try again and Mark hits manually. Late responses never overwrite later edits.
- Review shows the number of accepted markers and pending proposals. Pending proposals must be individually accepted or removed before confirmation. Do not add a one-tap Accept all in v2.
- A tap selects a marker; moving it explicitly accepts the revised location according to the existing domain contract. Pan/zoom must not accidentally add a marker.
- Review round explains every count and offers a clearly labelled incomplete confirmation when unresolved shots remain. Confirmed results are read-only. Incomplete confirmation is allowed only by the domain contract; never present it as a full score.
- Round confirmed is a recovery-safe result screen, not an animation-dependent toast. Next round and Back to session are explicit choices.
- Session complete shows only commensurate scores together. Demo and verified scores must be separate sections if both ever exist.
- Resume draft preserves photos, alignment and edits. Discard requires a confirmation and must never delete confirmed rounds.

### Screen sample data

The screenshots illustrate multiple independent states, not one continuous test fixture. Complete session sample: 85 + 89 + 87 = 261 demo points across three 10-shot rounds. The separate incomplete round sample has 5 actual shots: 3 hits (10 + 9 + 9 = 28), 1 miss, 1 unresolved, for a 28-point demo subtotal. These sample values are illustrative and are not calculated from the target drawing.

## 8. Error, recovery and edge-state copy

Use the additional contracts in sections 14–17 for save semantics and validation. They take precedence over abbreviated mockup copy.

| Trigger | Title / body | Actions and state |
|---|---|---|
| Startup DB failure | Couldn't open saved sessions / We couldn't open your saved sessions. Try again. If the problem continues, restart the app. | Retry only; no new session before DB ready. Never reset DB automatically. |
| Newer DB version | Update required / Your saved sessions were created by a newer version of Target Practice. Update the app to open them. | Nothing has been changed only if implementation guarantees no writes. |
| Initial list read failure | Sessions couldn't be loaded / Try reading your saved sessions again. | Try again and New session; not an empty state. |
| Refresh failure | Sessions couldn't be refreshed / Showing the sessions loaded earlier. Try again. | Preserve cards; Try again. |
| Invalid row | Unreadable session record / The original record is kept. | Validated short ID or ID unavailable; readable reasons only; retry read. |
| Before photo missing | No before photo / Existing holes may appear as suggestions. Review every result. | Continue or add Before. |
| Missing photo file | Photo unavailable / Choose this photo again to continue. Your round is still a draft. | Choose photo; no automatic deletion of the round. |
| Image quality concern | This photo may be hard to review / Check blur, glare and visible rings. | Retake or continue manually; do not invent a quality score. |
| Excluded image area | Some areas were not analysed / Check the highlighted areas manually. | Outline excluded region; unobserved shots remain unresolved. |
| Registration failure | Photos couldn't be aligned / Retake a similar view or continue with the after photo. | Retry / After photo only / Manual; never fabricate detections. |
| Analysis failure | Couldn't reach analysis service / Your photos and edits are still here. | Try again or Mark hits manually. |
| Pending proposals | Review required / Review or remove every suggestion before confirming. | Confirmation disabled, editor available. |
| Unsure diameter | Hole diameter is assumed / Check this value before using boundary scores. | Edit or explicitly confirm diameter. |
| Unverified target | Demo score / This target's dimensions have not been verified. | Never remove label just because calibration succeeded. |
| Session save failure | Couldn't confirm saving / Your details are kept and locked. Retry uses the same session details to avoid creating a duplicate. | Retry identical snapshot; no editing. |
| Slow save | Still saving / This is taking longer than usual. The session may still be saved. You can keep waiting or go back. | No parallel Retry while request is in flight. |
| Leave uncertain save | Leave this screen? / We couldn't confirm that this session was saved. If it was, it will appear in Sessions. | Stay / Leave; Leave reloads list. |
| Final validation rejection | Session not saved / These details didn't pass the final check. This save attempt did not write anything. | Back to sessions; no retry of same invalid snapshot. |
| ID conflict | Session not saved / This session couldn't be saved because its reference is already in use. | Back to sessions; no overwrite or silent new ID. |
| Draft on finish | Finish the draft first / Continue or discard the unfinished round before ending this session. | Continue draft / Cancel. |
| Replace after photo | Replace after photo? / Alignment and hit markers for this photo will be cleared. | Keep photo / Replace photo. |

Copy must match real outcomes. A design sentence never authorises weakening domain checks or making unsupported data guarantees.

## 9. Editor interaction details

Canvas geometry remains image/tavle geometry, not device pixels. A visible hole ring is scaled with the image. Its accessible/touch hit area stays at least 48 logical units; when hit areas overlap, offer a marker list or cycle selection rather than silently selecting the wrong hit.

Recommended magnifier: 120 logical diameter, 3 focus outline, displays approximately 2× local crop, positioned away from the finger and safe area. Hide when no editing gesture is active. Clamp it to the available editor region. Implement this as an editor improvement and verify it; reuse installed rendering and gesture facilities. Do not create a new image-analysis dependency for a magnifier.

Pinch zoom and panning preserve marker positions in image coordinates. Zoom buttons and Fit are alternatives, not proof of screen-reader accessibility. Confirmed markers show unique numbers; proposals show '?'. Selected marker's inspector is outside the photo and identifies status, multiplicity and diameter. Removing a suggestion does not create a miss or change an existing unresolved counter automatically. Recalculate the unaccounted difference using the existing accounting contract and require the user to resolve it explicitly.

Do not prescribe a physical diameter from these visual markers. The SVG illustration is decorative demo geometry. All scoring uses the application’s versioned target definition and explicit diameter. The current definition is synthetic, so its scores must remain labelled Demo score. Only a separately verified definition may produce real scores.

## 10. Accessibility and platform verification

Design intent, not a claim of tested compliance:
- English visible labels and accessible names agree.
- Session cards use a single descriptive accessible group/button; no duplicate child announcements.
- Editor actions are labelled; suggestions can be reviewed in a list. Full nonvisual coordinate placement is not solved by this design; provide an honest limitation rather than claiming full editor accessibility.
- Announce loading once; decorative icons/skeleton blocks are hidden from assistive technology.
- All error states pair colour with icon/title/text.
- At large text size, stack two-column fields and statistics; allow full-height scrollable sheets instead of clipping.
- Test Android TalkBack, iOS VoiceOver, keyboard focus where applicable, device rotation, largest text and long names.
- Test keyboard open, focus-first-error, repeated show/hide, Back and draft recovery on physical devices.
- No status-bar notch, OS keyboard or camera hardware is drawn as a product asset.
- No platform has been device-verified as part of this deliverable.

## 11. Icons and ownership

The icons/ directory contains original simple geometric reference SVGs and matching PNG exports created for this package. They are not extracted from the attached boards or redistributed Lucide files. In production, prefer the project's installed Lucide set and retain its actual licenses.

Suggested mappings: back→ChevronLeft, next→ChevronRight, down→ChevronDown, plus→Plus, minus→Minus, check→Check, close→X, camera→Camera, image→Image, target→Target, history→History, clock→Clock, alert→TriangleAlert, info→Info, lock→Lock, refresh→RefreshCw, trash→Trash2, undo→Undo2, zoom-in→ZoomIn, zoom-out→ZoomOut, fit→Maximize, move→Move, save→Save, layers→Layers, more→Ellipsis, flag→Flag, eye→Eye, wifi-off→WifiOff. Confirm available exports against the installed package before coding; this design does not install a dependency.

## 12. Handoff and acceptance

Use tokens.json as the value source, component-overview.html as the inspectable catalogue, and ui-ux.md for behaviour. PNGs can be placed in Figma as references but are not editable Figma components. Rebuild native Figma components using these tokens if needed. SVG icons remain editable vectors.

The catalogue's screen navigator and segmented states are interactive examples. Other buttons are visual specimens; no data is saved, uploaded or analysed. The HTML is self-contained, needs no network, and is not intended to replace the React Native application.

Implementation order: map tokens → shared controls → session navigation → round/photo flow → editor/review → error/recovery states → device verification. Preserve existing migrations, scoring and persistence contracts. The owner has authorised this UI implementation and removal of Developer checks. This does not authorise changing scoring rules, historical records or analysis providers. Resolve ordinary implementation choices autonomously and record substantive deviations.

Acceptance: no missing labels, no essential truncation at supported sizes, consistent token use, clear demo/uncertainty labels, no false empty state after read failure, all drafts recoverable according to actual implementation, and all user actions reachable with the keyboard open.

## 13. Sources and unresolved questions

Supplied boards: 01-foundations.png, 02-components.png, 03-current-mvp.png, 04-future-features.png, 05-prototype-flows.png. Prior decisions and app status supplied in this conversation are authoritative for existing behaviour.

Product reference reviewed previously:
- https://apps.apple.com/se/app/targetscan-pistol-rifle/id448045769
- https://targetshootingapp.com/wiki/Scanning_targets/
- https://targetshootingapp.com/wiki/Editing_shot_location/

Open implementation questions: verified physical target dimensions; live analysis accuracy on real photos; complete native accessibility of the editor; native image orientation and permission behaviour; safe-area/keyboard behaviour in standalone Android and iOS builds. No visual mockup resolves those questions.


## 14. Existing contracts to preserve

This revision replaces a create/list-only design with the whole implemented MVP. It does not replace the domain model. Do not infer new persistent fields, limits or defaults from mock data.

### Session input

| Field | Existing contract | English validation copy |
|---|---|---|
| Firearm name | Required, trimmed and NFC-normalised; 1–100 Unicode code points | Enter a firearm name. / Use 100 characters or fewer. |
| Firearm type | Pistol, Revolver, Rifle, Other; initially unselected | Choose a firearm type. |
| Calibre | Required, trimmed and NFC-normalised; 1–50 Unicode code points | Enter a calibre. / Use 50 characters or fewer. |
| Distance (m) | 0.1–1000; at most one decimal; accept decimal comma or point | Enter 0.1 to 1000 m, with at most one decimal. |
| Shots per round | Integer 1–100 | Enter a whole number from 1 to 100. |
| Planned rounds (optional) | Empty means null; otherwise integer 1–100 | Leave empty or enter 1 to 100. |

Confirm these against the actual domain code before wiring components. Read numeric limits from its existing constants; never copy validation logic into components. Do not use permissive parseInt parsing or coerce an empty string into zero. Preserve text input until validation. New visual field components are adapters, not a second validator.

Errors are absent before the first submit. On submit show all errors and focus/scroll to the first. After that, validate through the same domain function and update the edited field’s error. This is the v2 interaction rule, superseding the old design’s clear-error-until-next-submit rule.

No session-name field is being added: illustrative headings such as “Precision practice” are not new data. Use actual firearmName and existing session metadata. Calibre and name remain session snapshots; no profiles in this change.

### Saving and navigation

- Freeze one ID, created timestamp, time zone and validated input snapshot for the first save. Every Retry uses that same snapshot. Preserve the existing coordinator and its cross-form exclusion.
- Before saving, fields are editable. During saving and after an uncertain failure, fields stay locked. A slow-save message is informational, not proof of cancellation. No parallel save or Retry while an earlier attempt is running.
- Keep the existing slow-operation threshold (currently 10 seconds), late-result guards and recovery navigation. A stale save must never navigate away from a newer form.
- Validation/preparation errors before a write do not imply any record was saved. An uncertain persistence error must never say “nothing was saved”. Known conflict and final validation rejection have no Retry of the same invalid snapshot.
- Leaving an uncertain save reloads Sessions. Never silently generate another ID to bypass a conflict. Never promise an uncertain operation was cancelled.
- Unsaved edits dialog: “Discard unsaved changes?” / “This draft will be removed. Saved sessions won't change.” / “Keep editing” / “Discard changes”.
- Uncertain save dialog: “Leave this screen?” / “We couldn't confirm whether this session was saved. If it was saved, it will appear in Sessions. If it wasn't, leaving will discard these details.” / “Stay” / “Leave”. Stay does not trigger Retry.
- Platform Back and iOS back gestures follow the same protections as the visible Back button. Do not permanently trap a user behind a slow operation.

### Lists and unreadable records

Load on focus and reload after saves using the existing controller; preserve serialisation, disposal and stale-result guards. Filtering All / In progress / Finished is local presentation of actual session status. Preserve unreadable-record notices in every filter because their status is unknown; label them as records outside the filtered valid results. A filter with zero matches says “No matching sessions”, not “Start your practice log”. Do not introduce polling.

Show date and time with device locale and time zone. Keep null rounds as “Not planned”, and singular forms “1 planned round” and “1 shot / round”. Runtime setting changes are not assumed to work without restart; record both observations in tests. Do not rewrite stored UTC timestamps when the display zone changes.

Unreadable records follow valid records. Use only the error result’s ID and error codes, never unvalidated row values. Show the first eight ID characters or “ID unavailable”; use the full ID internally when present and preserve collision-safe fallback keys. Deduplicate reasons in a stable order:

| Existing error code | User-facing reason |
|---|---|
| missingColumn, invalidType | Some saved details are missing or damaged. |
| invalidId | The record ID is not valid. |
| invalidTimestamp | The saved date and time are not valid. |
| invalidTimeZone | The saved time zone is not valid. |
| required, tooLong, notNormalized | A saved text detail is not valid. |
| invalidNumber, tooManyDecimals, outOfRange | A saved number is not valid. |
| unsupportedValue | The saved firearm type is not recognised. |

Keep “The original record is kept.” and “Try reading again” only where the implementation truly retains that record. Never show raw codes, SQL columns, stack traces or an invalid saved date.

## 15. Round, photo and analysis integrity

- One draft round per session. Resume it after restart; discard requires confirmation. Confirmed rounds remain immutable. Session completion remains blocked by a draft.
- All current target scores are demo, including completed sessions. Calibration does not verify target dimensions. Display subtotal and unresolved count for incomplete results. Never add demo and real results into one total.
- Actual shots must equal accepted marker multiplicities + explicit misses + unresolved shots before confirmation, and no proposals may remain. Missing markers never automatically become misses. Use the existing domain’s confirmation eligibility, not independently computed UI rules.
- Hole diameter begins as the explicit existing assumption (currently 9.0 mm). Show the assumption until the user confirms/changes it. Do not derive it from the calibre string or marker touch area.
- Keep original and normalised photo copies, existing per-database storage separation, orphan cleanup and Android picker recovery. Use the same normalised image pixels for display, calibration, editing and analysis. Do not log images, local paths, image metadata or session values.
- Cancelling image selection keeps the current photo. Replacing the after photo requires acknowledgement that its calibration and markers will be cleared. Handle absent files without deleting the draft.
- Keep the current analysis server and API contract. Do not choose a new hosted provider, add analytics or transmit a photo merely because a screen opened. Send only what the configured analysis contract requires after the user selects Analyse.
- Before/after registration failure offers recovery; no invented detections. After-only analysis explains limitations and marks excluded regions where the API supplies them. Do not invent masked-region coordinates or confidence numbers.
- Proposals are visually and semantically separate from accepted hits. Accept, move or change them through the existing domain actions; remove does not record a miss. No Accept all action.
- Keep cancellation, timeout, saved attempt status, replaced-image guards and late-response guards. During analysis lock incompatible edits. A failed analysis leaves the manual path usable.
- Existing original photos can contain metadata; do not make a blanket promise that every stored photo is metadata-free. The normalised analysis copy is the metadata-stripped one.

## 16. Remove Developer checks now

Owner decision: remove the in-app development-check feature, rather than merely hiding its link. This includes the Developer checks route/screen, navigation entries, mode-switch controls, Test mode banner, test-database deletion controls, runtime scenario selectors and demo-analysis buttons. Remove reachable app wiring and feature-specific dead code after inspecting dependencies.

The normal database is the app’s only runtime mode after this change. There is no new reset, delete-all or migration-on-removal operation. Do not open, move, merge, export or delete the two old test databases or their photo folders automatically. Do not copy testsessions into the normal database. Keep their names isolated in any still-useful test fixtures.

Retain DatabaseGate’s production responsibilities: migrations, version guard, error screen, connection ownership, safe closure and waiting for operations. Retain operation tracking, save coordination and error safeguards where production uses them. Removing a screen is not justification to rewrite persistence.

Inspect contentOffsetContext and the dynamic keyboardVerticalOffset added for the test banner. Remove them only if they become unused and the remaining layout really starts at the expected origin. Preserve behavior="padding" and the normal-mode keyboard correction; never restore Android’s old undefined behaviour simply to remove test code. If a real header now offsets the screen, measure/account for its actual position. Apply safe-area insets once per edge.

Remove obsolete tests that exclusively assert the deleted UI. Keep domain, lifecycle, persistence and regression tests, along with synthetic fixtures used by tests. Do not delete every __DEV__ branch or test file indiscriminately. No replacement developer menu in this task.

Update current documentation and test instructions that tell the owner to use test mode. Historical bug reports and measured evidence remain historical; annotate superseded instructions rather than falsifying their observations. Future device checks that create records must say they use the normal database and create real local sessions. Do not automatically seed records for screenshots or test failures on the owner’s device.

## 17. Implementation and acceptance matrix

Component PNGs are specifications of reusable families, not a requirement to build an unused component framework. Build a family where a real screen needs it; record unused specimens rather than add fake product settings. A screen mockup may be a modal/state of an existing route. No twenty-route requirement.

| Area | Required result | Evidence |
|---|---|---|
| Visual tokens | Exact colours/type/spacing in shared native tokens; no screenshot sampling | Code review; token comparison |
| Sessions | Loading, empty, filtered, populated, read failure, refresh failure, invalid rows; clickable cards | Existing tests plus relevant new behaviour tests; native check |
| Session form | Sheet selection, domain validation, locked/slow/uncertain saves and navigation guards | Controller tests; native keyboard and Back check |
| Rounds/photos | Draft recovery, actual counts, photo source/permissions, immutable confirmed result | Contract tests; physical camera/library check |
| Editor | Correct image coordinates through zoom/pan; proposal review; multiplicity; magnifier; explicit modes | Geometry tests and native gesture check |
| Results | Demo/incomplete labels; domain accounting; no mixed totals | Unit tests and flow check |
| Removal | No Developer checks link, route, banner or runtime mode switching | Source audit; bundle/native check where available |
| Data | No database replacement/reset, no destructive file cleanup added; history preserved | Migration/lifecycle checks; real-device restart |
| Accessibility | 48 touch targets, large-text reflow, labels and readable status | Native TalkBack/VoiceOver when available |
| Platforms | Android and iPhone safe areas, keyboard and photo layout | Separate actual results; unavailable platform marked unverified |

Run the repository’s actual format, lint, typecheck and test commands; do not assume a historic test count. Run available platform export checks. Server tests are relevant if shared API code or server code changes; avoid modifying the detector as part of the redesign.

A passing export or unit suite is not a device test. Do not claim iOS, physical camera, real-photo detection or native gestures verified without running them. Missing access to a phone is not a reason to stop all implementation; complete everything independently verifiable and leave one concise manual checklist.

The earlier comprehensive verification step remains partly completed/paused. This change does not finish it, verify target dimensions or prove analysis accuracy on real photos.

## 18. Repository assets and replacement map

Canonical files after copying the package:

- [ui-ux.md](ui-ux.md): this behavioural and visual specification.
- [tokens.json](tokens.json): exact machine-readable design values.
- [component-overview.html](component-overview.html): self-contained reference catalogue; not app code.
- [images/README.md](images/README.md): image naming and index.
- images/components/: 24 component-family PNGs.
- images/screens/android/ and images/screens/ios/: 20 screen references each.
- icons/: original reference SVG/PNG icons; production prefers installed Lucide.

The old five boards are superseded: foundations → components 01–02; components → component catalogue; current MVP → screen catalogue; future features → excluded scope, not a backlog mandate; prototype flows → sections 7, 14 and 15. Update active links to those boards. Preserve unrelated documents and historical evidence.

The source package’s HTML is a reference only. Do not port its CSS or synthetic image data into React Native wholesale. Do not infer real scoring geometry from any image in this directory.

## 19. Improvement round 2 decisions (2026-10-28)

Owner-approved changes to this specification. Where they differ from sections 1–18 or the PNGs, these apply.

| Area | Decision |
|---|---|
| Alignment | Placed points can be selected and dragged again; the point follows the finger under the magnifier and the ring overlay is redrawn live. Undo and Reset stay. Points out of order (not top, right, bottom, left round the target) or on top of each other are explained and cannot be used; no rings are drawn for them. Each drag is one undo step and one save when the finger lifts. |
| Recalibration | Hits keep their photo positions; their target coordinates and demo scores are recalculated by the domain. An analysis answer for an earlier calibration is discarded as stale; marks already on the round are kept. |
| Editor layout | The page scrolls; the photo is a separate gesture area (no page scroll while a finger is on it). Instruction and current point above the photo, tools directly below it, Undo/Reset and the primary action in a footer outside the scroll area, above the real bottom inset. Alignment's primary action is "Use alignment". Alignment points are numbered 1–4. |
| Inspection | The round's photo is tappable and "Inspect hits" opens a full-screen, read-only view: pinch, pan, zoom buttons, Fit, Show hits (on when opened through Inspect hits), numbered markers, a list and the selected hit's details. A confirmed round shows its stored values; a draft offers a separate "Edit hits". |
| Field pairs | Labels, inputs and messages are separate rows so inputs align when a label wraps; pairs stack below 340 pt width or above 1.3 text scale. Optional fields show "· Optional" after the label. |
| Photos | The after photo is the main photo action. The before photo is optional under "Improve detection" and shown open whenever one exists. After a registration failure the user can choose "Analyse after photo only". |
| Profiles and templates | Firearm profiles (name, type, calibre) and training templates (name, distance, shots per round, optional rounds) are created, listed, edited, archived and restored under "Profiles and templates". They only fill the session form; the session keeps its own snapshot. The form starts from the last used active profile and template without counting as an edit, notes values changed for this session, and can save current values as a new profile or template. No deletion in this round. |
| Calibre | A searchable sheet of named calibres checked against SAAMI's equivalent-names list, plus Custom. Values stay text; existing free text is shown as Custom and never converted. The calibre never sets the hole diameter. |
| Camera | An in-app camera (expo-camera) with a guide: circle, centre mark and frame corners. The guide is not in the photo, is not detection, alignment or a quality check, and says so. Controls: cancel, shutter, light, library. |
