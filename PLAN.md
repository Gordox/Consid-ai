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
| 5 | Skapa session | Implementerat och enhetstestat. Lyckat flöde kontrollerat på S20, och persistens efter omstart verifierad via listan (steg 6, M5). Tangentbordsbuggen är åtgärdad för det testade flödet (`840e8c7`). Felflöden återstår (steg 7). iOS overifierat. |
| 6 | Lista sessioner | Implementerat och enhetstestat. M1–M5 och M7–M10 godkända på S20, och M6 delvis kontrollerad men inte verifierad. Felinjektion återstår (steg 7). iOS overifierat. |
| 7 | Dokumentation och integrationstester på enhet | **Pausat** (2026-10-27). 7a (checklistan) och 7b (testgrunden) är klara. T1–T6 och N4 är godkända på S20. Tangentbordsfelet i testläge är åtgärdat efter E2. 7c–7f och den kvarstående verifieringen återstår (`implementation/step-7-verification.md` §11). |
| 8 | CI | Implementerat och lokalt kontrollerat i en ren klon. **Inte verifierat i GitHub Actions** (8c). |

## Verifierade versioner (npm-registret och Expo-dokumentationen för SDK 58, 2026-10-27)

| Område | Version | Källa |
| --- | --- | --- |
| Expo SDK | 58 (`expo` ~58.0.20, patch godkänd 2026-10-27) | npm `latest`, mall `expo-template-blank-typescript@58.0.28` |
| React / React Native | 19.3.0 / 0.88.0 | `expo/bundledNativeModules.json` |
| react-dom | 19.3.0 | `expo/bundledNativeModules.json` |
| TypeScript | ~6.0.3 (inte 7.x, som är `latest` på npm) | SDK 58-mallen |
| expo-router / expo-sqlite / expo-crypto | ~58.0.27 / ~58.0.14 / ~58.0.7 | bundledNativeModules |
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
- `lucide-react-native` **1.56.0** och `react-native-svg` **15.16.0** för ikoner (steg 5). Ägaren godkände båda 2026-10-27 (Q1). Båda installerades i 5a.
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

## Steg 5 – Skapa session (implementerat och enhetstestat, persistens och felflöden ej verifierade på enhet)

Detaljplanen, med livscykeln för databasen, tillståndstabellen, felklassningen, testerna och resultaten per delsteg, finns i `implementation/step-5-create-session.md`. Skärmarna följer `docs/design/ui-ux.md` från steg 4.

1. **Filer** (under `apps/mobile/`):
   - **Konfiguration:**
     - `app.json`: `userInterfaceStyle: "dark"` och `backgroundColor: "#111315"`.
     - `THIRD_PARTY_NOTICES.md`: Lucides `LICENSE` ordagrant, ISC samt Feathers MIT-text.
   - **`src/components/`:**
     - `tokens.ts`: färger inklusive `inputBorder #68727C` och `scrim`, systemtypsnitt, avstånd, radier, tryckytor och ikonstorlekar med linjen 1,7.
     - `Icon`: Lucide via import per ikon, så att bara använda ikoner kommer med i bundlen.
     - `Screen`, `Button` (primär, sekundär och destruktiv, samt `busy`), `TextField`, `ChoiceRow`, `Banner`, `ScreenHeader` (Back med `ChevronLeft`) och `ConfirmDialog` (`Modal`, där Androids bakåtknapp väljer det icke-destruktiva valet).
   - **Databasstart** (avvikelse från `SQLiteProvider`, med skälen i detaljplanen):
     - `src/persistence/openSessionDatabase.ts`: öppnar och migrerar databasen. Om migrationen misslyckas stängs anslutningen, och ursprungsfelet kastas vidare.
     - `src/features/startup/databaseLifecycle.ts`: öppning, migrering och stängning körs i en enda kö. Ett generationsnummer gör att resultat från äldre initieringar förkastas, Retry fungerar bara efter ett fel, och anslutningen stängs först när ingen sparning pågår.
     - `DatabaseGate.tsx`, `StartupErrorScreen.tsx` och `sessionStoreContext.ts`: laddning, felskärmen 7.7 med bara Retry, och delning av anslutningen och koordinatorn.
   - **`src/features/sessions/`:**
     - `saveCoordinator.ts`: högst ett sparanrop i taget i appen och flaggan för långsam sparning efter 10 s. Flaggan är bara information och avbryter aldrig anropet.
     - `prepareSession.ts`: domänvalidering och sedan ögonblicksbilden. `prepareFailed` (T3) uppstår när inget sparanrop har startats.
     - `sessionFormState.ts` (reducer) och `sessionFormController.ts` (ramverksfri logik, felklassning och beteende vid bakåt).
     - `fieldErrorMessages.ts`, `firearmTypeLabels.ts` och `SessionForm.tsx`.
   - **`src/services/deviceContext.ts`:** `nowUtcIso`, `deviceTimeZone` och `newSessionId` (via `expo-crypto`, med gemener).
   - **Routes:**
     - `app/_layout.tsx`: mörk `DarkTheme`, ljust statusfält, `DatabaseGate` och `Stack` utan header.
     - `app/sessions/new.tsx`: formuläret.
     - `app/index.tsx`: mörk platshållare med `New session`. Den ersätts av listan i steg 6.
   - **Tester:** `tests/features/sessions/*`, `tests/features/startup/databaseLifecycle.test.ts` och `tests/persistence/openSessionDatabase.test.ts`. Testhjälp finns i `tests/support/async.ts`.
2. **Beteende:**
   - **Formuläret:**
     - Alla fält är tomma från början, och ingen vapentyp är förvald (A3).
     - Inga fel visas före första försöket. Därefter uppdateras bara det ändrade fältet (U7).
     - Fokus och skrollning flyttas till det första ogiltiga fältet.
   - **Ögonblicksbild:** Första giltiga `Create session` bygger en fullständig ögonblicksbild med id, `createdAtUtc`, tidszon och inställningar. Retry skickar samma objekt (kontraktet i steg 3).
   - **Felklassning:**

     | Utfall | Tillstånd | Retry? |
     | --- | --- | --- |
     | `saved` eller `alreadySaved` | Sparat | – |
     | `InvalidSessionError` | Avvisad, säkert inget skrivet i försöket | Nej |
     | `SessionIdConflictError` | Konflikt | Nej |
     | Övriga fel | Sparfel, osäkert | Ja, med låsta fält och P1/P2 |
   - **Bakåtnavigering:** `usePreventRemove` fångar Back, Androids bakåtknapp och iOS bakåtsvep.
     - Ett ändrat formulär ger dialogen "Discard".
     - Efter ett sparfel eller vid långsam sparning visas "Leave this screen?" med `Stay` och `Leave`.
     - En normal pågående sparning spärrar bakåt utan dialog.
     - Efter Sparat stängs spärren av innan appen går tillbaka.
   - **Två formulär:** Ett nytt formulär kan inte spara medan ett äldre anrop pågår (T2). Sena resultat tillhör bara det formulär som startade försöket.
   - **Begränsningar:**
     - Ett anrop som aldrig avslutas låser sparning tills appen startas om, och en omstart bevarar inte osparade formulärvärden.
     - Ett sent fel efter Leave meddelas inte.
3. **Beroenden:** `expo-crypto` ~58.0.7, `react-native-svg` 15.16.0 och `lucide-react-native` 1.56.0, exakt pinnad. Dessutom den godkända patchuppdateringen till `expo` ~58.0.20 och `expo-router` ~58.0.27.
4. **Kontroller:**
   - `npm run format:check`, `npm run lint` och `npm run typecheck` ger exit 0.
   - `npm test -- --runInBand` ger exit 0, med 19 testsviter och 401 av 401 tester godkända.
   - `npx expo install --check` är OK, och `expo-doctor` ger 20/20 (kontrollerat i 5a).
   - Android-exporten innehåller exakt de åtta Lucide-ikoner som används.
   - **Kontrollertesterna bevisar inte att React-komponenterna är korrekt inkopplade (Ö1).**
   - **Manuellt på Galaxy S20 (Expo Go, ägaren):**
     - Appen startar mörkt och når startskärmen.
     - Formulärets UI ser rätt ut. Vilka av kontrollpunkterna som gicks igenom, till exempel TalkBack och största systemtext, är inte specificerat.
   - **Återgång efter sparning bevisar inte att raden finns kvar i databasen.**
   - **Återstår:**
     - Persistens verifieras med listan i steg 6 och testverktyget i steg 7.
     - Sparfel, Retry, långsam sparning, Avvisad, Konflikt, T2 och felskärmen vid start kräver felinjektion i steg 7.
     - iOS är overifierat.
5. **Klart när:** En giltig session sparas en gång, ogiltig inmatning stoppas med begripliga fel och återförsök skapar inga dubbletter. Uppfyllt för logik och enhetstester, och lyckat flöde är kontrollerat på S20. Persistensen på enhet och felflödena återstår (steg 6–7).

## Steg 6 – Lista sessioner (implementerat och enhetstestat, inte fullständigt verifierat)

Detaljplanen, med beslut, tillstånd, nycklar och checklistan M1–M10 med resultat, finns i `implementation/step-6-session-list.md`. Skärmen följer `docs/design/ui-ux.md` §5, med ändringarna Ö1–Ö3 från steg 6.

1. **Filer** (under `apps/mobile/`):
   - `src/features/sessions/formatSession.ts`: kortets rader och etiketten för skärmläsare. Lokalt datum och lokal tid via `Intl`, med enhetens språk, region och tidszon. Singular och plural (Ö3) och `Not planned` för `null`.
   - `src/features/sessions/invalidRowPresentation.ts`: ogiltiga rader med titel, text, unika orsaker, kort id eller `ID unavailable`, samt listnycklar som är unika även när id saknas eller upprepas. Positionsnyckeln är en reservlösning, inte en stabil identitet mellan omladdningar.
   - `src/features/sessions/sessionListController.ts`: läsningar med `listSessions`:
     - bara när listan är aktiv
     - vid aktivering och återkomst, vid Retry och när en sparning avslutas medan listan visas
     - högst en läsning åt gången och högst en väntande omladdning
     - generationsnummer mot gamla resultat, även efter `dispose` och `resume`.
   - `src/features/sessions/SessionList.tsx`, `SessionCard.tsx` och `InvalidSessionCard.tsx`.
   - `app/index.tsx`: en tunn route som renderar `SessionList`.
   - Tester: `tests/features/sessions/formatSession.test.ts`, `invalidRowPresentation.test.ts` och `sessionListController.test.ts`.
2. **Beteende:**
   - **Header:** `Sessions`, `Your practice, recorded.` och `New session`. Knappen är tillgänglig även under laddning och vid läsfel, eftersom `DatabaseGate` redan är redo.
   - **Kort:** Nyast först. Korten är inte klickbara och läses som en grupp, utan knapproll.
   - **Ogiltiga rader:** De visas efter de giltiga sessionerna (Ö1), utan datum, felkoder eller kolumnnamn.
   - **Tomt läge:** bara efter en lyckad läsning med noll rader.
   - **Läsfel:** En banner med `Try again` och `New session`. Det visas aldrig som en tom lista.
   - **Omladdning:** Tidigare kort ligger kvar. Om omladdningen misslyckas visas Ö2-bannern `Sessions couldn't be refreshed` / `Showing the sessions loaded earlier. Try again.`
3. **Beroenden:** inga nya.
4. **Kontroller:**
   - `npm run format:check`, `npm run lint` och `npm run typecheck` ger exit 0.
   - `npm test -- --runInBand` ger exit 0, med 22 testsviter och 453 av 453 tester godkända.
   - Android-exporten innehåller nio Lucide-ikoner.
   - Datumtesterna använder uttrycklig locale och tidszon, och Node-testerna **verifierar inte Hermes**. Logiktesterna bevisar inte att skärmen är korrekt inkopplad.
   - **Manuellt på Galaxy S20 (Expo Go, ägaren, 2026-10-27):**
     - **M1–M5 och M7–M10 är godkända.**
     - **M5 verifierar att skapade sessioner finns kvar efter fullständig omstart** i den testade miljön. Det är första verifieringen av persistens på enhet.
     - M8 (TalkBack) och M9 (största text och skärmzoom) gäller **listan**.
     - **M6** (datum, språk och tidszon) är **delvis kontrollerad, inte verifierad**.
   - **Återstår till steg 7 (felinjektion):** läsfel, misslyckad omladdning med kvarvarande kort, ogiltiga rader i en riktig databas och omladdning efter långsam sparning.
   - **iOS:** overifierat.
5. **Klart när:** Sparade sessioner visas korrekt, och felaktig data syns i stället för att döljas. Uppfyllt för logiken och det testade lyckade flödet på S20. M6 och felflödena återstår, och steg 6 är **inte fullständigt verifierat**.

### Fynd under steg 6: tangentbordet dolde formulärets nedersta fält (steg 5-kod)

- **Buggrapport:** `docs/bugs/keyboard-covers-lower-form-fields.md`. **Rättning:** commit `840e8c7`.
- **Rättningen:** `KeyboardAvoidingView` i `SessionForm.tsx` har `behavior="padding"` på alla plattformar. Den saknade anpassningen på Android är mätt i Expo Go på S20 (mekanismen i H1). Den bakomliggande plattformsorsaken (H3) är inte fastställd.
- **Manuellt verifierat i Expo Go på S20:**
  - `Planned rounds` syns helt automatiskt.
  - `Create session` går att nå med tangentbordet öppet.
  - Layouten återställs utan tomrum. Det gäller även sluttestet utan diagnostik.
- **Overifierat**, enligt buggrapporten:
  - övriga fält
  - felvisning med tangentbordet öppet
  - **TalkBack och största systemtext med tangentbordet öppet**
  - andra tangentbord
  - en egen Android-build (risk för dubbel anpassning)
  - iOS.
- **Skillnad mot listans tester:** TalkBack och största text är godkända för **listan** (M8, M9), men **inte** testade för formuläret med tangentbordet öppet.

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
   - **Sessionslistan (från steg 6), med felinjektion:**
     - läsfel med `Try again` och `New session`
     - misslyckad omladdning med kvarvarande kort och Ö2-bannern
     - ogiltiga rader i en riktig databas
     - omladdning när en långsam sparning avslutas medan listan visas.
   - **M6 från steg 6:** datum och tid efter uttryckligt byte av tidszon, 12- och 24-timmarsformat och språk (`Intl` i Hermes).
   - **Formuläret med tangentbordet öppet** (`docs/bugs/keyboard-covers-lower-form-fields.md`): övriga fält, felvisning, TalkBack, största systemtext och andra tangentbord. En egen Android-build och iOS markeras som overifierade tills de faktiskt har testats.
4. **Beroenden:** inga.
5. **Kontroller:** Checklistan körs och resultaten fylls i. Det som inte har körts märks som overifierat.
6. **Klart när:** En ny utvecklare kan installera, köra och verifiera appen bara med hjälp av README, och resultaten från enheten är dokumenterade.

## Steg 8 – CI

Detaljplanen, med förutsättningar, beslut, delsteg och resultat, finns i `implementation/step-8-ci.md`. Den har företräde framför punkterna nedan där de skiljer sig.

**Faktiskt läge (2026-10-28):**
- **`.github/workflows/ci.yml`:**
  - ett jobb på `ubuntu-latest`
  - utlösare: `pull_request` och `push` mot `main`
  - `contents: read`, 15 minuters tidsgräns och `concurrency` per PR eller branch
  - Node från `.nvmrc`
  - steg: `npm ci`, `format:check`, `lint`, `typecheck` och `npm test -- --runInBand`.
- Actions är pinnade med verifierade commit-SHA.
- **Avvikelse från punkt 2 nedan (ägarbeslut Ö1):** `npx expo install --check` och `npx expo-doctor` ingår **inte** i CI. De körs manuellt vid ändringar av beroenden, eftersom de beror på Expos tjänster.
- **Verifiering:**
  - **Lokalt kontrollerat i en ren klon.**
  - **Ännu inte verifierat i GitHub Actions** (8c). Steg 8 räknas inte som verifierat förrän den första körningen har lyckats.
  - Ett grönt CI betyder inte att kontrollerna på S20 har gått igenom.
- `npm audit` rapporterar tre high-fynd. Det är en separat fråga och påverkar inte CI (`implementation/step-8-ci.md` §9).

1. **Filer:** `.github/workflows/ci.yml`.
2. **Beteende:**
   - Node från `apps/mobile/.nvmrc`.
   - Kör `npm ci` och sedan `format:check`, `lint`, `typecheck`, `test -- --runInBand` och `npx expo install --check` i `apps/mobile`.
   - Inga bygg-, publicerings- eller enhetsjobb.
3. **Beroenden:** inga.
4. **Kontroller:** Arbetsflödet körs först vid push eller PR, och det kräver separat godkännande. Lokalt körs samma kommandon i följd.
5. **Klart när:** CI kontrollerar samma saker som README beskriver. Ett grönt CI-resultat betyder inte att enhetstesterna på S20 har gått igenom.

---

## Efter steg 8: sparade vapenprofiler (ägarbeslut 2026-10-27)

- Vapentyp är en fast lista (B2).
- Namn och kaliber är fritext per session och sparas som en historisk kopia i sessionsraden.
- Sparade vapenprofiler, som beskrivs i `CLAUDE.md`, blir ett eget steg efter steg 0–8. Beslutet dokumenterades först i `implementation/step-2-domain-validation.md`.
- **Historiska sessioner behåller sina egna inställningar.** Att skapa, ändra eller ta bort en profil får aldrig ändra en redan sparad session.
- Ordning: först CI (steg 8), sedan design och detaljplan för vapenprofiler.
- Poängdiametern i profilen väntar på beslut om källan till nominella diametrar (öppen fråga 3 i `CLAUDE.md`).

## Kända undantag

- **`git diff --check` och Markdown (ägarbeslut 2026-10-27):**
  - `Assigments/Assigment 3/upg.md`, rad 3, 12, 17 och 20, slutar med exakt två mellanslag, som är avsiktliga radbrytningar i Markdown. De fyra anmärkningarna är accepterade, och filen är oförändrad.
  - Alla andra anmärkningar är fortfarande fel. Hela kontrollen beskrivs inte som godkänd när undantaget förekommer.

## Antaganden som kvarstår

- Expo Go räcker för det här steget. Ingen development build, inget Android-paket-ID och ingen signering behövs.
- `Intl` i Hermes på RN 0.88 ger IANA-tidszon och lokal formatering. Det verifieras på S20 i steg 7. Om det inte fungerar stoppas sparningen med ett fel, och `expo-localization` föreslås för godkännande.
- Distans som börjar med decimaltecken (`.5`) eller slutar med det (`25.`) avvisas. Inledande nollor (`007`) godtas som 7.
- npm 11 kör inte installationsskripten för `@parcel/watcher` och `unrs-resolver` utan godkännande. Lint och bundling fungerar ändå, så de är inte godkända.
- Inga commits görs utan att ägaren ber om det. Föreslagna granskningspunkter är efter varje steg.
