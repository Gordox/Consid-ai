# Implementationsplan: skapa och lista träningssessioner

## Kontext

Det här är den första avgränsade implementationen av Target Practice Log: en Expo-app (**Target Practice**, tekniskt namn `target-practice`) där man kan skapa en träningssession med validerade inställningar, spara den i SQLite och se sparade sessioner i en lista. Besluten B1–B10 och de övriga justeringarna från ägaren gäller.

Kamera, bildanalys, poängberäkning, mål, backend, autentisering, synk, redigering, borttagning, anteckningar och sessionsstatus ingår inte.

## Status

| Steg | Innehåll | Status |
| --- | --- | --- |
| 0 | Förberedelser | Klart |
| 1 | Scaffold och verktyg | Klart, enhetstest på S20 återstår |
| 2 | Domän: inställningar och validering | Klart |
| 3 | Persistens: migration och repository | Implementerat och enhetstestat, ej verifierat på S20 |
| 4 | UI/UX-design: sessionslista och formulär | Klart som dokumentation (godkänt). Ingen UI är implementerad. |
| 5 | Skapa session | Ej påbörjat |
| 6 | Lista sessioner | Ej påbörjat |
| 7 | Dokumentation och integrationstester på enhet | Ej påbörjat |
| 8 | CI | Ej påbörjat |

## Verifierade versioner (npm-registret och Expo-dokumentationen för SDK 58, 2026-10-27)

| Område | Version | Källa |
| --- | --- | --- |
| Expo SDK | 58 (`expo` ~58.0.19) | npm `latest`, mall `expo-template-blank-typescript@58.0.28` |
| React / React Native | 19.3.0 / 0.88.0 | `expo/bundledNativeModules.json` |
| react-dom | 19.3.0 | `expo/bundledNativeModules.json` |
| TypeScript | ~6.0.3 (inte 7.x, som är `latest` på npm) | SDK 58-mallen |
| expo-router / expo-sqlite / expo-crypto | ~58.0.26 / ~58.0.14 / ~58.0.7 | bundledNativeModules |
| react-native-screens / safe-area-context | ~4.30.0 / ~5.10.1 | bundledNativeModules |
| jest-expo / jest | ~58.0.12 / ~30.5.2 | bundledNativeModules, jest-expo peers |
| eslint-config-expo / eslint | ~58.0.4 / **^9.39.5** | `eslint-plugin-react` har peer `eslint ^9.7`, så ESLint 10 fungerar inte |
| prettier / eslint-config-prettier | ~3.9.10 / ~10.1.8 | npm `latest` |
| Node | **26** (`.nvmrc` och `engines ^26.0.0`) | Expo 58 kräver `^22.13 \|\| ^24.3 \|\| ^26 \|\| >=27` |

## Beroenden

Alla Expo-moduler installeras med `npx expo install` så att versionerna följer SDK 58. Utvecklingsverktyg som inte finns i Expos versionslista installeras med `npm install --save-dev` och uttryckliga versioner.

**Runtime:**
- `expo`, `react`, `react-native`, `expo-status-bar` (från mallen).
- `expo-router`, `react-native-safe-area-context`, `react-native-screens`, `expo-linking`, `expo-constants` (Expo Routers manuella installation).
- `react-dom@19.3.0`. Det krävs som peer av Expo Router via Radix. Utan en uttrycklig version installerar npm 19.3.1, som krockar med `react@19.3.0`. Det finns inget webbmål.
- `expo-sqlite` (steg 3).
- `expo-crypto` för `randomUUID()` (steg 5). Det är ett Expo-paket men står inte uttryckligen i stacken, så det godkänns genom den här planen.
- `lucide-react-native` **1.56.0** och `react-native-svg` **15.16.0** för ikoner (steg 5). Ägaren godkände båda 2026-10-27 (Q1). Inget av dem är installerat än.
  - `react-native-svg` 15.16.0 är den version som Expo SDK 58 anger i `bundledNativeModules.json`. Den installeras med `npx expo install react-native-svg`.
  - `lucide-react-native` 1.56.0 är publicerad 2026-10-13. Den pinnas exakt, eftersom paketet släpps nästan dagligen (senaste är 1.62.0 från 2026-10-27).
  - `lucide-react-native` har peer-kraven `react-native-svg ^12 || ^13 || ^14 || ^15` och `react ^16.5.1 || … || ^19`. Båda uppfylls av SDK 58 med react 19.3.0. Det är kontrollerat i npm-registret, men inte installerat eller testat.
  - Licensen är ISC, och en del ikoner kommer från Feather med MIT-licens. Licenstexterna bevaras i en fil med tredjepartsnotiser (steg 5).

**Dev:**
- `typescript`, `@types/react` (från mallen).
- `jest-expo`, `jest`, `@types/jest`.
- `eslint` (9.x), `eslint-config-expo`.
- `prettier`, `eslint-config-prettier`.

**Medvetet utelämnade:**
- `eslint-plugin-prettier`. Expos guide föreslår det, men det låter ESLint köra formatering. Här formaterar bara Prettier, och `eslint-config-prettier` stänger av ESLints stilregler, så verktygen konkurrerar inte.
- `react-native-web`, eftersom det inte finns något webbmål.
- `@testing-library/react-native` och `expo-localization`.
- `better-sqlite3` och `zod`, enligt B6 och B7.
- `@expo/vector-icons` och `expo-font`. De är inte installerade, och Expo SDK 58-dokumentationen avråder från `@expo/vector-icons`. Ikonerna kommer i stället från Lucide (Q1).
- `expo-system-ui` och `expo-navigation-bar`. De läggs bara till om plattformsverifieringen i `docs/design/ui-ux.md`, avsnitt 11, visar ett behov. Problemet redovisas då före installation (Q2).

**Versionspolicy:** Intervallen i `package.json` behålls, `package-lock.json` commitas, installation sker med `npm ci` och kontroll med `npx expo install --check`.

---

## Steg 0 – Förberedelser (klart)

1. **Filer:** inga projektfiler.
2. **Beteende:** Branchen `feature/session-foundation` skapas från `main`. Node 26 används, enligt `.nvmrc`.
3. **Beroenden:** inga.
4. **Kontroller:** `node --version` visar v26.x, `git status` visar rätt branch.
5. **Klart när:** Arbetet sker på en feature-branch med en Node-version som stöds.

## Steg 1 – Scaffold och verktyg (klart, enhetstest på S20 återstår)

1. **Filer:**
   - `apps/mobile/` från `npx create-expo-app@5.0.0 apps/mobile --template blank-typescript@sdk-58`.
   - Borttaget ur mallen:
     - `App.tsx`, `index.ts` och `assets/favicon.png`
     - `LICENSE`, eftersom den innehåller MIT med Expos copyright och ingen licens ska väljas (B9)
     - `AGENTS.md`, eftersom den säger att routes ska ligga i `src/app/`, vilket strider mot `CLAUDE.md`
     - `.claude/settings.json`, som aktiverade ett plugin.
   - Nya filer: `app/_layout.tsx` (Stack), `app/index.tsx` (rubriken "Target Practice", ersätts i steg 6), `eslint.config.js`, `.prettierrc.json`, `.prettierignore`, `jest.config.js`, `.nvmrc`.
   - Ändrade filer: `package.json`, `app.json`, `tsconfig.json`.
2. **Ansvar och beteende:**
   - `package.json`:
     - `"name": "target-practice"`, `"private": true` och inget licensfält (B9).
     - `"main": "expo-router/entry"` och `"engines": { "node": "^26.0.0" }`.
     - Skript: `start`, `android`, `ios`, `lint` (`expo lint`), `format` (`prettier --write .`), `format:check` (`prettier --check .`), `typecheck` (`tsc --noEmit`), `test` (`jest`).
   - `app.json`: `name` "Target Practice", `slug` och `scheme` "target-practice", ingen webbkonfiguration. Inget Android-paket-ID eller EAS-konfiguration än.
   - `tsconfig.json`: ärver `expo/tsconfig.base` och har `strict: true` och `noUncheckedIndexedAccess: true`. I steg 2 tillkom `types: ["jest"]`. Utan den hittade TypeScript 6.0.3 inte typerna från `@types/jest`, och `tsc` gav fel för `describe`, `it` och `expect` i testfilerna. Det var inte synligt i steg 1, eftersom det då inte fanns några tester.
   - `eslint.config.js`:
     - `eslint-config-expo/flat` följt av `eslint-config-prettier/flat` sist.
     - `@typescript-eslint/no-explicit-any: error` och `@typescript-eslint/no-non-null-assertion: error`.
   - `jest.config.js`: `preset: 'jest-expo'`, `testMatch: ['<rootDir>/tests/**/*.test.ts']` och `passWithNoTests: false`. jest-expo slår på `passWithNoTests` som standard, men testskriptet ska aldrig lyckas utan att ha kört något.
3. **Beroenden:** mallens paket, Router-paketen, `react-dom`, `eslint`, `eslint-config-expo`, `prettier`, `eslint-config-prettier`, `jest-expo`, `jest`, `@types/jest`.
4. **Kontroller:**
   - Automatiskt, alla godkända med Node 26.12.1:
     - `npm ci`, `npm run format:check`, `npm run lint`, `npm run typecheck`
     - `npx expo install --check`
     - `npx expo-doctor` (20/20)
     - `npx expo export --platform android`.
   - `npm test` ger exit 1 med "No tests found" tills det finns tester i steg 2.
   - Manuellt:
     - Kör `npx expo start`.
     - Öppna appen i Expo Go för SDK 58 på Galaxy S20, via LAN eller med `adb reverse tcp:8081 tcp:8081` och `npx expo start --localhost`.
     - Kontrollera att rubriken visas.
5. **Klart när:** Appen startar på S20, och lint, typkontroll och formatkontroll går igenom på en ren installation.

## Steg 2 – Domän: inställningar och validering (klart)

Detaljplanen, med kontrakt, förtydliganden och testmatris, finns i `implementation/step-2-domain-validation.md`.

1. **Filer** (under `apps/mobile/`):
   - `src/domain/result.ts`: `Result<T, E>`, ett typat resultat som är antingen lyckat eller ett fel.
   - `src/domain/session/firearmType.ts`: `FIREARM_TYPES = ['pistol', 'revolver', 'rifle', 'other'] as const`, `FirearmType` och `isFirearmType(value: unknown)`. Visningsetiketterna hör till UI-lagret (steg 5).
   - `src/domain/session/sessionLimits.ts`: gränserna från B1 som namngivna konstanter.
     - `FIREARM_NAME_MAX_CODE_POINTS = 100` och `CALIBRE_LABEL_MAX_CODE_POINTS = 50`.
     - `DISTANCE_TENTHS_RANGE = { min: 1, max: 10_000 }`, alltså 0,1–1 000 m.
     - `PLANNED_SHOTS_PER_ROUND_RANGE` och `PLANNED_ROUNDS_RANGE`, båda `{ min: 1, max: 100 }`.
   - `src/domain/session/parseText.ts`: `normalizeLabel` (NFC och sedan trim), `codePointLength` och `parseLabel(raw, maxCodePoints)`. Den sista ger `required` eller `tooLong`.
   - `src/domain/session/parseNumber.ts`:
     - `parseWholeNumber(raw, range)` och `parseDistanceMetres(raw)` tolkar formulärets text.
     - `checkWholeNumber(value, range)` och `checkDistanceMetres(value)` kontrollerar redan tolkade tal och returnerar en felkod eller `null`. Detaljplanen angav boolean, men ägaren beslutade felkod eller `null` så att 2d och steg 3 kan återanvända reglerna.
   - `src/domain/session/session.ts`: typerna `SessionFormInput`, `SessionField`, `SessionSettings`, `Session`, `SessionFieldError(s)` och `SettingsFieldError(s)`. De två sista har dessutom `invalidType` och `notNormalized` för data som inte kommer från formuläret.
   - `src/domain/session/validateSessionInput.ts`:
     - `validateSessionInput(input)` tolkar formuläret och samlar alla fältfel.
     - `checkSessionSettings(value: unknown)` kontrollerar redan tolkade inställningar med samma regler. Den används av `buildSession` och ska användas för databasrader i steg 3.
   - `src/domain/session/sessionMetadata.ts`: `isSessionId`, `isUtcTimestamp` och `isTimeZone`.
   - `src/domain/session/buildSession.ts`: `buildSession(settings, { id, createdAtUtc, createdTimeZone })`. Den kontrollerar metadata, kör `checkSessionSettings` och returnerar ett `Result` med alla fel samlade utan att kasta. Den läser aldrig klockan och skapar inga ID:n.
   - Tester i `tests/domain/`: `firearmType`, `parseText`, `parseNumber`, `validateSessionInput`, `checkSessionSettings`, `sessionMetadata` och `buildSession` (`*.test.ts`).
2. **Beteende:**
   - **Text:** NFC och sedan trim, och längden räknas i kodpunkter. Tom text ger `required`, och text över gränsen ger `tooLong`. Texten trunkeras aldrig.
   - **Tal:** Talfälten trimmas, och bara ASCII-siffror godtas. Siffersträngar som är längre än gränsens maxvärde ger `outOfRange` innan de görs om till tal.
   - **Distans:**
     - `25,5` och `25.5` godtas båda.
     - Två eller fler decimaler ger `tooManyDecimals`, även `1.000` och `1.10`.
     - Fel form, som `1 000`, `1,000.5`, `1e3`, `25.5m`, `-5`, `+5`, `.5` och `25.`, ger `invalidNumber`.
     - `0` och `1000.1` ger `outOfRange`.
   - **Heltal:** `1.0`, `1,5`, `10abc` och `1e2` ger `invalidNumber`. Inget värde avrundas.
   - **Planerat antal rundor:** tom sträng eller bara blanksteg blir `null`.
   - **Vapentyp:** `null` eller `''` ger `required`. Okända värden ger `unsupportedValue`, och jämförelsen är skiftlägeskänslig.
   - Alla fältfel returneras samtidigt.
   - **Metadata:**
     - ID måste vara UUID v4 med gemener.
     - Tiden måste ha exakt formatet från `toISOString()` och bli identisk när den läses in och skrivs ut igen, så att omöjliga datum inte normaliseras tyst.
     - Tidszonen måste ha IANA-lik form, vara högst 64 tecken och godtas av `Intl`.
   - **Kända begränsningar:**
     - Text som bara består av osynliga tecken, till exempel U+200B, godtas.
     - Tidszonsdata kommer från JavaScript-motorn och är bara verifierad i Node.
3. **Beroenden:** inga.
4. **Kontroller** (från `apps/mobile`, Node 26.12.1, efter commit `5822341`):
   - `npm run format:check`, `npm run lint` och `npm run typecheck` ger exit 0.
   - `npm test -- --runInBand` ger exit 0, med 7 testsviter och 238 av 238 tester godkända.
   - Domänen importerar inget från React Native, Expo eller SQLite, vilket kontrolleras med `grep`.
   - Hermes på S20 är inte verifierat. Det täcks av checklistan i steg 7.
5. **Klart när:** All validering är ren, deterministisk och testad, och den importerar inget från React Native, Expo eller SQLite. Uppfyllt.

## Steg 3 – Persistens: migration och repository (implementerat och enhetstestat, ej verifierat på S20)

Detaljplanen, med kontrakt, migrationsordning, teststrategi och testplan för S20, finns i `implementation/step-3-persistence.md`.

1. **Filer** (under `apps/mobile/`):
   - `src/persistence/database.ts`:
     - `DATABASE_NAME = 'target-practice.db'`.
     - Den smala typen `SessionDatabase`, där alla läsningar ger `unknown` och därför valideras vid körning.
     - `asSessionDatabase(db: SQLiteDatabase)`, en kontroll vid kompilering utan cast. Steg 5 ska använda den.
     - `DatabaseStateError`.
   - `src/persistence/sessionRow.ts`:
     - `SESSION_COLUMNS`.
     - `parseSessionRow(row: unknown): Result<Session, InvalidSessionRow>`. Den återanvänder `checkSessionSettings`, `isSessionId`, `isUtcTimestamp` och `isTimeZone` från steg 2 och har inga egna regler eller toleranser.
     - `sessionToRowParams`, som ger värden att binda i SQL.
   - `src/persistence/migrations.ts`: migration 1, `MIGRATIONS` (får bara utökas), `LATEST_SCHEMA_VERSION`, `migrateDatabase(db, migrations = MIGRATIONS)` och felklasserna `DatabaseVersionTooNewError`, `JournalModeError` och `MigrationFailedError`.
   - `src/persistence/sessionRepository.ts`: `saveSession`, `listSessions`, `InvalidSessionError` och `SessionIdConflictError`.
   - Tester i `tests/persistence/`: `sessionRow`, `migrations`, `migrationSchema` och `sessionRepository` (`*.test.ts`). Där finns också `fakeDatabase.ts`, som inte är en egen testsvit.
   - Persistenslagret har bara typimporter från `expo-sqlite`. Ingen native-kod laddas i Jest.
2. **Migration 1:**
   ```sql
   CREATE TABLE sessions (
     id TEXT PRIMARY KEY NOT NULL,
     created_at_utc TEXT NOT NULL,
     created_time_zone TEXT NOT NULL CHECK (length(created_time_zone) > 0),
     firearm_name TEXT NOT NULL CHECK (length(firearm_name) BETWEEN 1 AND 100),
     firearm_type TEXT NOT NULL CHECK (firearm_type IN ('pistol','revolver','rifle','other')),
     calibre_label TEXT NOT NULL CHECK (length(calibre_label) BETWEEN 1 AND 50),
     distance_m REAL NOT NULL CHECK (distance_m BETWEEN 0.1 AND 1000),
     planned_shots_per_round INTEGER NOT NULL CHECK (planned_shots_per_round BETWEEN 1 AND 100),
     planned_rounds INTEGER CHECK (planned_rounds IS NULL OR planned_rounds BETWEEN 1 AND 100)
   ) STRICT;
   CREATE INDEX sessions_created_at_idx ON sessions (created_at_utc DESC, id DESC);
   ```
   - Inställningarna sparas som en historisk kopia i sessionsraden. Det finns ingen `status` och inga mål-kolumner.
   - Indexet omfattar också `id DESC`, så att det matchar sorteringen i `listSessions`.
   - `STRICT` och `CHECK` skyddar lagringsklass, `NOT NULL`, unikt id, vapentyp, intervall och längd i tecken. NFC, trim, UUID-format, giltiga datum och tidszoner samt högst en decimal skyddas bara av domänen.
   - Migration 1 är fryst av ett test. Ett annat test kontrollerar att `CHECK`-värdena stämmer med domänens gränser.
   - **Policy för framtida regler:**
     - Vidgade gränser kräver en ny migration som bygger om tabellen.
     - Skärpta gränser får inte göra sparade rader ogiltiga, så då behövs separata regler för lagrade poster i samma ändring.
3. **Beteende:**
   - **`migrateDatabase`:**
     1. Läser `user_version` och kontrollerar svaret.
     2. Avvisar en nyare databas med `DatabaseVersionTooNewError` innan något skrivs, alltså även före WAL.
     3. Aktiverar WAL utanför transaktioner och kontrollerar svaret. Ett annat svar ger `JournalModeError`.
     4. Kör varje väntande migration i en egen `withExclusiveTransactionAsync`. Där läses versionen om via `txn`, SQL:en körs och `user_version` höjs i samma transaktion.

     Fel ger rollback och `MigrationFailedError(version, cause)`, och senare migrationer körs inte.
   - **`saveSession`:**
     - Validerar med `buildSession` och kastar `InvalidSessionError` utan att skriva.
     - Kör `INSERT … ON CONFLICT(id) DO NOTHING` med bundna parametrar.
     - En ny rad ger `saved`. En identisk rad ger `alreadySaved`, där alla nio fält jämförs med `===`.
     - Annat innehåll ger `SessionIdConflictError('differentContent')`, och en ogiltig befintlig rad ger `SessionIdConflictError('existingRowInvalid')`. Befintliga rader skrivs aldrig över.
   - **`listSessions`:**
     - `ORDER BY created_at_utc DESC, id DESC`.
     - Returnerar `{ sessions, invalidRows }`. Ogiltiga rader anges med kolumner och orsaker, utan värden från raden.
     - Ett databasfel kastas och blir aldrig en tom lista.
   - **Kontrakt för steg 5:** Ett återförsök måste skicka exakt samma `Session`, även samma `createdAtUtc` och tidszon. Om sessionen byggs om med ny tid ger det `differentContent`.
4. **Beroenden:** `expo-sqlite` ~58.0.14, som har det indirekta beroendet `await-lock`. Pluginet som `expo install` lade till i `app.json` togs bort, eftersom det inte gör något utan inställningar.
5. **Kontroller** (från `apps/mobile`, Node 26.12.1, efter commit `a216492`):
   - `npm run format:check`, `npm run lint` och `npm run typecheck` ger exit 0.
   - `npm test -- --runInBand` ger exit 0, med 11 testsviter och 322 av 322 tester godkända.
   - Fake-testerna verifierar **inte** riktig SQLite, SQL-syntax, `CHECK` och `STRICT`, rollback, WAL, låsning, samtidighet, parameterbindning i den native-koden eller att REAL-värden blir exakt lika när de läses tillbaka.
   - Integrationstesterna på S20 ingår i checklistan för steg 7 och har **inte** körts.
6. **Klart när:** Schema, migrationsrutin och repository finns, radvalidering och orkestrering är enhetstestade och det är dokumenterat vad fake-testerna inte täcker. Uppfyllt för enhetstester. Verifieringen på S20 återstår.

## Steg 4 – UI/UX-design för sessionslistan och formuläret (klart som dokumentation, ingen UI implementerad)

Steget tillkom 2026-10-27, innan några skärmar byggs. Tidigare steg 4–7 heter nu steg 5–8.

1. **Filer:**
   - `docs/design/ui-ux.md`: designdokumentet. Det innehåller:
     - underlaget och vad varje tavla täcker
     - ägarens beslut A1–A15, F1–F7 och Q1–Q7
     - avvikelserna från tavla 03
     - skärmar och tillstånd, inklusive de sju tillstånd som saknas i tavlorna, beskrivna i text
     - texterna
     - tema och den uppmätta kontrasten
     - ikoner med licenser
     - plattformsverifiering och tillgänglighet.
   - `docs/design/images/README.md`: namngivning av tavlor och utsnitt.
   - `docs/design/images/01-foundations.png`, `02-components.png`, `03-current-mvp.png`, `04-future-features.png` och `05-prototype-flows.png`: ägarens designtavlor, med ändrade namn men oförändrat innehåll.
2. **Ansvar och beteende:**
   - Omfattningen är bara sessionslistan, formuläret för ny session och felskärmen vid start.
   - Tavla `03` och `05` är normerande för MVP:n, med avvikelserna i avsnitt 4 i `ui-ux.md`. `04` och de framtida delarna av `02` och `05` är bara koncept (A13).
   - Tillstånd som saknas i tavlorna är beskrivna i text och blockerar inte implementationen (Q3).
3. **Beroenden:** inga i steget. Ikonpaketen installeras i steg 5.
4. **Kontroller:**
   - Alla bildlänkar i dokumentet pekar på filer som finns.
   - Inga filnamn har mellanslag eller tankstreck.
   - Kontrastvärdena är uppmätta och står tillsammans med färgparen.
   - Ingen appkod och inga paket ändras.
   - **Verifiering:** UI:t som specificeras är varken implementerat eller verifierat i körande app. Android (Galaxy S20 med Hermes) och iOS är overifierade. De 322 testerna gäller steg 2–3 och täcker inte designen, Lucide och SVG eller native-beteende. De kontroller som faktiskt har gjorts är dokumentationskontrollerna och kontrastberäkningarna.
5. **Klart när:** Ägaren har godkänt `docs/design/ui-ux.md` och de omdöpta tavlorna. Uppfyllt 2026-10-27, med texterna P1–P4 och U1–U10 beslutade.

## Steg 5 – Skapa session (formulär och arbetsflöde)

Skärmen följer det godkända designdokumentet `docs/design/ui-ux.md` från steg 4.

1. **Filer:**
   - `apps/mobile/app/_layout.tsx` (ändras): `SQLiteProvider databaseName={DATABASE_NAME}` runt Stack, där `onInit` kör `migrateDatabase(asSessionDatabase(db))`. Om initieringen eller migrationen misslyckas visas felskärmen i `ui-ux.md` 7.7, med bara Retry, utan `New session`, utan återställning och utan radering.
   - Mörkt tema (A6): `app.json` får `userInterfaceStyle: "dark"` och `backgroundColor: "#111315"`. Rotlayouten får `ThemeProvider` och en anpassad `DarkTheme` från `expo-router`. `<StatusBar style="light" />`. `TextInput` får `keyboardAppearance="dark"` på iOS, `placeholderTextColor` och `selectionColor`.
   - Designtokens (färger inklusive `inputBorder #68727C`, typografi, avstånd och ikonstorlekar) i en modul under `apps/mobile/src/components/` eller `src/config/`.
   - Ikoner: namngivna importer från `lucide-react-native`, bara de nio ikonerna i `ui-ux.md` avsnitt 10.
   - En fil med tredjepartsnotiser för Lucide (ISC) och Feather (MIT).
   - `apps/mobile/app/sessions/new.tsx`: en tunn route som renderar `SessionForm` och navigerar tillbaka till listan efter sparning.
   - `apps/mobile/src/services/deviceContext.ts`:
     - `nowUtcIso()`
     - `deviceTimeZone()`, som hämtar tidszonen från `Intl.DateTimeFormat().resolvedOptions().timeZone` och kastar ett fel om värdet saknas eller är ogiltigt
     - `newSessionId()`, som använder `randomUUID` från `expo-crypto`.
   - `apps/mobile/src/features/sessions/createSession.ts`: `createSession(input, deps: { id, now, timeZone, save })` validerar, bygger posten och sparar. Resultatet är `invalid` (med fältfel), `saved`, `alreadySaved` eller ett kastat fel.
   - `apps/mobile/src/features/sessions/firearmTypeLabels.ts`: `Record<FirearmType, string>` med Pistol, Revolver, Rifle och Other. Kompilatorn kräver en etikett per typ.
   - `apps/mobile/src/features/sessions/fieldErrorMessages.ts`: engelska feltexter byggda av felkod och gränskonstanter, utan hårdkodade tal.
   - `apps/mobile/src/features/sessions/SessionForm.tsx`: fält, radrader för vapentyp (`accessibilityRole="radio"`, ingen förvald), knappen `Create session`, fältfel, sparfel, id-konflikt och dialogerna enligt `ui-ux.md` avsnitt 6–7.
   - Tester: `apps/mobile/tests/features/createSession.test.ts` och `fieldErrorMessages.test.ts`.
2. **Beteende:**
   - **Före första försöket:** alla fält går att redigera, och ingen vapentyp är förvald (A3).
   - **Första giltiga försöket:** en stabil kopia av hela `Session`-objektet skapas, alltså id, `createdAtUtc`, tidszon och inställningar. Formuläret låses, och en `useRef`-flagga blockerar dubbla anrop. Knappen visar `Creating session…`.
   - **Sparfel:** fälten är fortfarande låsta, och låsningen förklaras i text. `Try saving again` skickar exakt samma kopia (kontraktet i steg 3). Inget försök görs automatiskt (F1, `ui-ux.md` 7.3).
   - **Id-konflikt (`SessionIdConflictError`):** ingen Retry, inget nytt id och ingen överskrivning. Bara `Back to sessions` finns (`ui-ux.md` 7.6).
   - **Bakåt:** `usePreventRemove` från `expo-router` fångar header-knappen, Androids bakåtknapp och iOS bakåtsvep.
     - Ändrat men aldrig skickat formulär ger dialogen "Discard" (7.4).
     - Efter ett sparfel visas dialogen "Leave without saving?" med `Stay` och `Leave` (7.5). `Leave` går till listan, som läses om.
     - Ett orört formulär eller en sparad session ger ingen fråga. Dialogerna är egna komponenter, inte native `Alert`.
   - **Ett nytt besök** i formuläret ger ett nytt formulär och, vid första försöket, ett nytt id.
   - **Fältfel (U7):** Inga fel visas före första sparförsöket. `Create session` validerar alltid hela formuläret. Därefter valideras ett ändrat fält på nytt med domänens `validateSessionInput`, och bara det fältets fel uppdateras. Formuläret har inga egna valideringsregler.
   - **Långvarig eller hängande sparning (U8):** Det ska **planeras i detaljplanen för steg 5 före implementation**:
     - Användaren får inte bli permanent inlåst på skärmen.
     - En UI-timeout får inte tolkas som att databasanropet har avbrutits eller att sessionen inte har sparats.
     - Inga parallella sparförsök får startas.
   - Distansfältet använder `keyboardType="decimal-pad"` och heltalsfälten `number-pad`. Tangentbordet räknas inte som validering, utan domänen avgör.
3. **Beroenden:** `expo-crypto`, `lucide-react-native` 1.56.0 och `react-native-svg` 15.16.0. Alla installeras först i steg 5.
4. **Kontroller:**
   - Automatiskt, `createSession` med en fake-`save`. Testet **verifierar bara orkestreringen**:
     - att `save` inte anropas vid ogiltig inmatning
     - att id, tid och tidszon förs vidare oförändrade
     - att `alreadySaved` förs vidare
     - att fel inte omvandlas till ett lyckat resultat.
   - Automatiskt: `fieldErrorMessages` täcker varje kombination av fält och felkod.
   - Därefter lint, typkontroll och tester.
   - Manuellt på S20:
     - spara en giltig session
     - fältfel visas och försvinner efter rättning
     - snabba dubbeltryck på Save ger en enda rad
     - både `25,5` och `25.5` godtas
     - formuläret öppnas igen och nästa session får ett nytt ID
     - ingen vapentyp är förvald
     - fälten är låsta efter ett sparfel, och Retry skickar samma session
     - båda dialogerna visas via appens bakåtknapp och Androids bakåtknapp
     - mörkt tema, statusfält och tangentbord enligt `ui-ux.md` avsnitt 11.
   - iOS är overifierat tills det testats på en riktig enhet.
5. **Klart när:** En giltig session sparas en gång, ogiltig inmatning stoppas med begripliga fel och återförsök skapar inga dubbletter.

## Steg 6 – Lista sessioner

Skärmen följer det godkända designdokumentet `docs/design/ui-ux.md` från steg 4.

1. **Filer:**
   - `apps/mobile/app/index.tsx` (ersätts): en route som läser via `listSessions` när skärmen får fokus (`useFocusEffect`) och renderar `SessionList`.
   - `apps/mobile/src/features/sessions/SessionList.tsx`: `FlatList` med tillstånden i `ui-ux.md` 5.2. Posterna är inte klickbara.
   - `apps/mobile/src/features/sessions/formatSession.ts`: ren formatering av lokalt datum och lokal tid (A4, till exempel `27 Oct 2026, 14:00`), distans (`25 m`) och planerade rundor (`5 planned rounds`, eller `Not planned` när värdet är `null`, A5).
   - Översättning av kolumnfel för ogiltiga rader till texterna i `ui-ux.md` 5.3 (A2).
   - Test: `apps/mobile/tests/features/formatSession.test.ts`.
2. **Beteende:**
   - Varje post visar vapennamn, typetikett, kaliber, distans, skott per runda, planerade rundor och skapad tid i enhetens lokala tid.
   - Ogiltiga rader visas som `Unreadable session record` med kort id (eller `ID unavailable`) och begripliga orsaker. Inga ovaliderade värden, råa felkoder eller kolumnnamn visas, och raderna försvinner inte.
   - Ett läsfel visar bannern med `Try again` och `New session` (Q7). Det visas aldrig som en tom lista, inte heller efter `Leave` från formuläret.
3. **Beroenden:** inga.
4. **Kontroller:**
   - Automatiskt: `formatSession` för distans med och utan decimal, `null` som ger `Not planned`, datum och tid med en fast tidszon i testet (`TZ` sätts i Jest-konfigurationen), och översättningen av varje felkod för ogiltiga rader.
   - Därefter lint, typkontroll och tester.
   - Manuellt på S20: listan uppdateras efter sparning, nyast visas först, det tomma läget visas på en ny installation och texten radbryts vid den största systemtexten. iOS är overifierat.
5. **Klart när:** Sparade sessioner visas korrekt, och felaktig data syns i stället för att döljas.

## Steg 7 – Dokumentation och integrationstester på enhet

1. **Filer:**
   - `README.md` i rotkatalogen.
   - `docs/decisions/0001-session-foundation.md`: B1–B10, utelämnade beroenden och versionspolicyn.
   - `docs/device-tests/sessions.md`: en checklista för riktig expo-sqlite med kolumner för datum, enhet, appversion, resultat och anteckningar.
2. **README** täcker:
   - Node 26, Expo SDK 58 och Expo Go på S20
   - `npm ci` och `npx expo start`
   - anslutning via LAN eller adb
   - de exakta kommandona `npm run lint`, `npm run typecheck`, `npm run format:check` och `npm test -- --runInBand`
   - valideringsgränserna (produktval för prototypen, inte officiella regler)
   - var data lagras
   - begränsningar: ingen kamera, analys, poäng, mål, redigering, borttagning eller anteckningar
   - att Java och Android SDK inte krävs förrän en development build behövs
   - att ingen licens är vald.
3. **Checklistan på S20** (riktig expo-sqlite):
   - första start skapar schemat
   - en sparad session finns kvar efter att appen tvångsstängts och startats om
   - dubbeltryck ger en rad
   - tidszonen sparas som ett IANA-namn (verifierar att `Intl` i Hermes ger ett värde)
   - `String.prototype.normalize('NFC')` fungerar i Hermes: ett vapennamn som skrivits med kombinerande accent (e följt av U+0301) sparas som ett enda `é`
   - `isTimeZone` godtar enhetens tidszon i Hermes, det vill säga att `Intl.DateTimeFormat` med `timeZone` inte ger `RangeError` för en giltig zon
   - lokal tid visas korrekt efter byte av enhetens tidszon
   - en andra start kör inte migrationen igen
   - flygplansläge påverkar inte appen.
   - Tema och plattform enligt `docs/design/ui-ux.md` avsnitt 11. På Android kontrolleras mörk bakgrund utan vit blinkning, statusfält, navigationsfält, systemets tangentbord, bakåtknappen och dialogerna. iOS-punkterna markeras som overifierade tills de har testats på en riktig enhet. Ett behov av `expo-system-ui` eller `expo-navigation-bar` redovisas innan något installeras.
   - Persistensen enligt testplanen i `implementation/step-3-persistence.md`, avsnitt 7. Den körs mot en separat testdatabas, `target-practice-device-check.db`, och aldrig mot riktiga sessioner. Den täcker:
     - ny databas och upprepad initiering
     - nyare version och rollback när en migration misslyckas
     - parameterbindning med citattecken
     - `CHECK` och `STRICT`
     - idempotent sparning, id-konflikt och samtidiga sparningar
     - att REAL och Unicode blir exakt lika när de läses tillbaka
     - sortering och att data finns kvar efter omstart

     Testverktyget, som bara finns i utvecklingsläge, byggs i steg 7.
4. **Beroenden:** inga.
5. **Kontroller:** Checklistan körs och resultaten fylls i. Det som inte har körts märks som overifierat.
6. **Klart när:** En ny utvecklare kan installera, köra och verifiera appen bara med hjälp av README, och resultaten från enheten är dokumenterade.

## Steg 8 – CI

1. **Filer:** `.github/workflows/ci.yml`.
2. **Beteende:**
   - Node från `apps/mobile/.nvmrc`.
   - Kör `npm ci` och sedan `format:check`, `lint`, `typecheck`, `test -- --runInBand` och `npx expo install --check` i `apps/mobile`.
   - Inga bygg-, publicerings- eller enhetsjobb.
3. **Beroenden:** inga.
4. **Kontroller:** Arbetsflödet körs först vid push eller PR, och det kräver separat godkännande. Lokalt körs samma kommandon i följd.
5. **Klart när:** CI kontrollerar samma saker som README beskriver. Ett grönt CI-resultat betyder inte att enhetstesterna på S20 har gått igenom.

---

## Antaganden som kvarstår

- Expo Go räcker för det här steget. Ingen development build, inget Android-paket-ID och ingen signering behövs.
- `Intl` i Hermes på RN 0.88 ger IANA-tidszon och lokal formatering. Det verifieras på S20 i steg 7. Om det inte fungerar stoppas sparningen med ett fel, och `expo-localization` föreslås för godkännande.
- Distans som börjar med decimaltecken (`.5`) eller slutar med det (`25.`) avvisas. Inledande nollor (`007`) godtas som 7.
- npm 11 kör inte installationsskripten för `@parcel/watcher` och `unrs-resolver` utan godkännande. Lint och bundling fungerar ändå, så de är inte godkända.
- Inga commits görs utan att ägaren ber om det. Föreslagna granskningspunkter är efter varje steg.
