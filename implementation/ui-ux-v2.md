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

## 4. Resultat (2026-10-28)

### Brancher och commits (alla sammanslagna i lokal `main` med fast-forward)

| Branch | Commits |
| --- | --- |
| `docs/ui-ux-v2-plan` | `4dbfa00` plan |
| `refactor/remove-developer-checks` | `c4b8061` |
| `feature/ui-foundation-v2` | `4dc4b14` |
| `feature/ui-sessions-v2` | `be01749`, `5d26b05` |
| `feature/ui-round-flow-v2` | `1c17065` |
| `feature/ui-editor-v2` | `752715a`, `7710ce8`, `791e1f7` |
| `docs/ui-ux-v2` | denna dokumentation |

### Användarflödet

- **Designgrund:** `src/components/tokens.ts` har exakt värdena i `tokens.json`. Knappar har tryckt, fokus, inaktiv och upptagen form utan opacitet. Fälten är 56 höga och har låst läge. Nya små kontroller: `IconButton`, `StatusBadge`, `SegmentedControl`, `SelectSheet` och `ScoreSummary`. `Banner` har tonerna error, warning, success och info. Dialoger och sheets följer systemets inställning för reducerad rörelse.
- **Sessions:** filtren All, In progress och Finished bygger på sessionens faktiska status. Oläsbara poster visas i alla filter, efter träffarna och med en förklaring. "No matching sessions" skiljs från det tomma läget. Korten har statusbadge, rundor och poäng märkt `demo pts`.
- **New session:** vapentypen väljs i en select-sheet, och Cancel behåller tidigare val. Fältparet staplas vid stor text. Validering, fryst kopia, Retry, konflikt, avvisning och dialoger är oförändrade.
- **Session detail:** delsumma medan sessionen pågår, separata summeringar för demo och verifierad poäng, rundkort och ett utkast med Continue och Discard. Ett utkast som blockerar avslut visar dialogen "Finish the draft first". En avslutad session visar "Session complete" med statistik.
- **Runda:**
  - Stegen är inställning (faktiska skott och diameterantagande), foton (före valfri, efter krävs, Camera och Library, nekad behörighet med Settings och Library) och analysval (destinationen förklaras, ingen procentsiffra, manuell väg).
  - Den nya routen `confirm` granskar skottredovisningen genom domänen och visar sedan "Round confirmed".
  - En bekräftad runda är skrivskyddad.
- **Editor:**
  - Verktygen Align, Add och Select and pan är uttryckliga. Panorering lägger aldrig till en träff.
  - En förstorare på cirka 120 pt visar bilden ungefär 2× förstorad, placerad bort från fingret och inom bildytan. Den tar inga tryck.
  - Accepterade träffar är numrerade, förslag streckade med `?`, och den valda markören har en fokusring.
  - Överlappande markörer stegas igenom med upprepade tryck och finns i en markörlista.
  - Inspectorn visar status, antal skott och rundans diameter.
  - Accept all är borttaget.
- **Developer checks:** route, skärm, testbanner, lägesbyte, testdatabasradering, `databaseModeContext`, `contentOffsetContext` och demoförslag är borttagna. `/dev/checks` och andra okända länkar visar appens "Not found". `DatabaseGate`, migrationerna, versionsskyddet, `trackedConnection` och sparkoordinatorn finns kvar.

### Kontroller som har körts

- Från `apps/mobile` på integrerad `main`: `format:check`, `lint` och `typecheck` gav inga fel. Jest: 51 sviter och 688 tester godkända. Antalet sjönk först från 688 till 666 när testerna för testdatabaser, lägesbyte, demoförslag och Accept all togs bort. Därefter tillkom tester för filter, kortsammanfattning, rundsteg, felrubriker, editorinteraktion, förstorare och transformer.
- `npx expo export` för Android och iOS fungerar. Bundlarna innehåller inte strängarna "Developer checks", "UI check database", "Test mode", "target-practice-ui-check" eller "Add demo suggestions".
- Inga beroenden ändrades, så `expo install --check` behövdes inte. Servern och kontraktet är oförändrade.

### Avvikelser från designen

- **Maxpoäng** som "/ 200" visas inte, eftersom tavlans maxpoäng inte är verifierad.
- **Diametern** gäller hela rundan i domänen. Inspectorn visar därför rundans diameter, och den ändras i rundans inställningssteg, inte per träff.
- **Rundkorten** visar ingen klocktid, eftersom rundsammanfattningen inte läser tiden. Det skulle kräva en ändring i persistensen.
- **Vikt 650** finns inte i React Native, så 600 används (tillåtet enligt §4).
- **Fotokällan** väljs med två knappar direkt på fotokortet i stället för ett separat blad. Kamera och bibliotek är plattformens egna skärmar.
- **Ikonerna** `trash-2` och `history` finns som typer men inte som moduler i Lucide 1.56.0, så `trash` och `chevron-left` används.

### Efter granskningen (2026-10-28)

- **Designpaketet** är committat separat (`4e35370`). Inga PNG-filer har metadata, inga SVG-filer har skript, och katalogens enda skript byter förhandsvisning lokalt.
- **Jest-varningen** fanns redan i `282177b`. Den kom från tre formulärtester som startade en sparning som aldrig avgjordes, så koordinatorns timer på 10 sekunder levde kvar. En `afterEach` avgör nu sparningarna. Appens kod är oförändrad och `--forceExit` används inte (`13566bd`).
- **Analysen kan avbrytas** med `Cancel analysis` (`7eba53c`). Klienten avbryter anropet via samma `AbortController` som tidsgränsen. Ett svar som kommer efter avbrottet ignoreras, och försöket sparas som `cancelled`. Texten säger att servern kan ha hunnit ta emot bilderna och fortsätta arbeta.
- **Round confirmed och Start next round** (`fbcc2f6`):
  - Ett synkront skydd stoppar dubbeltryck.
  - En upprepad begäran öppnar det befintliga utkastet i stället för att skapa ett nytt.
  - En avslutad session får ingen ny runda.
  - Alla vägar tillbaka leder till sessionen, och spärren stängs av så snart en utgång har börjat.

### Inte verifierat

- Ingen skärm har körts på en telefon, emulator, simulator eller webb: miljön saknar Android SDK, Xcode-simulator och `react-native-web`. Layout vid 320, 360 och 390 dp, stor text, tangentbordet, safe area, gester, förstoraren, TalkBack och VoiceOver är bara granskade i koden.
- `router.dismissTo` följt av `push` (Start next round) och spärren mot bakåt på "Round confirmed" behöver kontrolleras på enhet.
- Steg 7 är fortfarande pausat. Den riktiga tavlan, riktiga foton och serverns precision är oförändrat overifierade.
