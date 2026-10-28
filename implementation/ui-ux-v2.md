# UI/UX v2.1: genomförande

Underlag: `docs/design/ui-ux.md` (beteende), `docs/design/tokens.json` (exakta värden) och bilderna i `docs/design/images/`. Ägaren har godkänt designen och gett mandat att genomföra hela omdesignen och ta bort Developer checks.

Designpaketet ligger ocommittat i arbetskatalogen (ägarens filer). Det här arbetet läser det men committar det inte.

## 1. Inventering (2026-10-28, `main` på `282177b`)

| Område | Finns i koden | Avstånd till v2.1 |
| --- | --- | --- |
| Tokens | `src/components/tokens.ts`, mörkt tema från de gamla tavlorna | Saknar `muted`, `accentPressed`, `accentSurface`, ytor för status, `disabledSurface/Text`; typografin har andra storlekar och vikter; scrim 60 % i stället för 72 % |
| Kontroller | `Button`, `TextField`, `ChoiceRow`, `ConfirmDialog`, `Banner`, `Stepper`, `ScreenHeader`, `Icon` (Lucide) | Saknar statusbadge, segmentfilter, select-sheet, varnings- och lyckad-banner; fält 48 i stället för 56; tryckt knapp med opacitet |
| Sessions | Lista med laddning, tomt läge, läsfel, omladdningsfel, oläsbara poster, klickbara kort | Saknar All / In progress / Finished, statusbadge och poäng på kortet |
| Ny session | Validering via domänen, fryst kopia, Retry, konflikt, avvisning, dialoger | Typen väljs med fyra radiorader; v2 kräver select-sheet |
| Sessionsdetalj | Resultat, rundor, start/fortsätt, avsluta | Saknar poängsammanfattning, rundkort med badge, dialog när ett utkast blockerar avslut |
| Runda | En lång skärm: skott, diameter, foton, analys, träffar, resultat | v2 delar upp i steg: inställning, foton, justering, analys, granskning, bekräftelse, bekräftad |
| Editor | Kalibrering, markering, flytt, ta bort, ångra, zoom, Fit, förslag streckade | Saknar explicit Lägg till/Panorera, numrerade träffar, förstorare, inspector, markeringslista; har en förbjuden "Accept N suggestions" |
| Developer checks | Route `app/dev/checks.tsx`, `features/dev-tools/`, lägesbyte i `databaseLifecycle`, `databaseModeContext`, Test mode-banner, `contentOffsetContext`, demoförslag i analyspanelen | Ska bort helt |

## 2. Brancher och ordning

1. `refactor/remove-developer-checks`: ta bort route, skärm, banner, lägesbyte, testdatabasradering och demoförslag. Appen öppnar alltid den vanliga databasen och mappen `photos`. Gamla testdatabaser och bildmappar rörs inte.
2. `feature/ui-foundation-v2`: tokens enligt `tokens.json`, uppdaterade kontroller och nya små kontroller (badge, segment, select-sheet, banner-toner).
3. `feature/ui-sessions-v2`: Sessions-hubben med filter, kort, ny session med select-sheet, sessionsdetalj.
4. `feature/ui-round-flow-v2`: rundans steg, foton med källval, analysval, granskning och bekräftelse, bekräftad runda.
5. `feature/ui-editor-v2`: lägen, numrerade markörer, förstorare, inspector, markeringslista, ingen Accept all.
6. `docs/ui-ux-v2`: README, PLAN, checklistor och notiser om borttagna Developer checks.

Varje branch kör formatkontroll, lint, typkontroll och tester innan den slås ihop med `main` utan force.

## 3. Avgränsningar

- Domän, migrationer, sparkoordinator, analyskontrakt och poängregler ändras inte.
- Inga nya paket. Lucide, react-native-svg och PanResponder räcker.
- En skärm i designen blir en route bara där det behövs; övriga blir tillstånd i befintliga routes.
- Designens maxpoäng ("/ 200") visas inte: tavlans maxpoäng är inte verifierad.

## 4. Resultat

Fylls i när arbetet är klart, se avsnitt 5.
