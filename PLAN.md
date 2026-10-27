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
| 3 | Persistens: migration och repository | Ej påbörjat |
| 4 | Skapa session | Ej påbörjat |
| 5 | Lista sessioner | Ej påbörjat |
| 6 | Dokumentation och integrationstester på enhet | Ej påbörjat |
| 7 | CI | Ej påbörjat |

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
- `expo-crypto` för `randomUUID()` (steg 4). Det är ett Expo-paket men står inte uttryckligen i stacken, så det godkänns genom den här planen.

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
   - Nya filer: `app/_layout.tsx` (Stack), `app/index.tsx` (rubriken "Target Practice", ersätts i steg 5), `eslint.config.js`, `.prettierrc.json`, `.prettierignore`, `jest.config.js`, `.nvmrc`.
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
   - `src/domain/session/firearmType.ts`: `FIREARM_TYPES = ['pistol', 'revolver', 'rifle', 'other'] as const`, `FirearmType` och `isFirearmType(value: unknown)`. Visningsetiketterna hör till UI-lagret (steg 4).
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
   - Hermes på S20 är inte verifierat. Det täcks av checklistan i steg 6.
5. **Klart när:** All validering är ren, deterministisk och testad, och den importerar inget från React Native, Expo eller SQLite. Uppfyllt.

## Steg 3 – Persistens: migration och repository

1. **Filer** (`apps/mobile/src/persistence/`):
   - `database.ts`: `DATABASE_NAME = 'target-practice.db'`.
   - `migrations.ts`:
     - `MIGRATIONS: readonly string[]`. Indexet plus 1 är versionen. Listan får bara växa, och en befintlig post ändras aldrig.
     - `migrateDatabase(db)`: läser `PRAGMA user_version`. Om databasversionen är högre än appens kastas ett fel och databasen lämnas orörd. Annars körs varje väntande migration tillsammans med `PRAGMA user_version = n` i `withExclusiveTransactionAsync`. `PRAGMA journal_mode = WAL` sätts före migrationerna.
   - `sessionRow.ts`: `parseSessionRow(row: unknown): Result<Session, InvalidSessionRow>`.
     - Den kontrollerar alla kolumntyper och kör samma domänregler som vid inmatning, genom att återanvända `checkSessionSettings` från steg 2: längd, NFC, enum, intervall och högst en decimal.
     - Den kontrollerar också metadata med `isSessionId`, `isUtcTimestamp` och `isTimeZone` från steg 2.
     - Den sätter aldrig standardvärden.
   - `sessionRepository.ts`:
     - `saveSession(db, session)`: `INSERT … ON CONFLICT(id) DO NOTHING`. Om ingen rad ändrades läses den befintliga raden. Är den identisk returneras `alreadySaved` (idempotent återförsök). Annars kastas `SessionIdConflictError`.
     - `listSessions(db)`: `ORDER BY created_at_utc DESC, id DESC`. Returnerar `{ sessions, invalidRows }`, där `invalidRows` innehåller id (om det går att läsa) och orsak.
   - Tester: `apps/mobile/tests/persistence/sessionRow.test.ts` och `migrations.test.ts`.
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
   CREATE INDEX sessions_created_at_idx ON sessions (created_at_utc DESC);
   ```
   - Inställningarna sparas som en historisk kopia i sessionsraden.
   - Det finns ingen `status`-kolumn och inga mål-kolumner (B3 och justeringen om status). De läggs till i senare migrationer.
   - SQLite:s `length()` räknar tecken i TEXT, vilket motsvarar kodpunkter, så kolumnen skyddar samma gräns som domänen. NFC-kravet går inte att uttrycka i SQL och kontrolleras bara i domänen.
   - Kontrollen av "högst en decimal" vid läsning tål ett epsilon på 1e-9, enbart för flyttalsbrus. Epsilonet dokumenteras och är ingen tolerans för själva värdet.
3. **Beroenden:** `expo-sqlite`.
4. **Kontroller:**
   - Automatiskt, `parseSessionRow` med vanliga objekt (riktig logik, ingen mock):
     - giltig rad
     - varje kolumn saknas, har fel typ eller ligger utanför gränsen
     - okänd vapentyp
     - `planned_rounds` som `null` respektive `0`
     - distans med två decimaler
     - trasigt datum.
   - Automatiskt, `migrateDatabase` med en minimal fake-db (en inspelad lista av SQL-anrop):
     - **verifierar bara** ordning, versionslogik, att fel kastas när databasen är nyare än appen och att varje migration körs i en transaktion
     - **verifierar inte** att SQL:en är giltig för SQLite eller att `CHECK` faktiskt fungerar.
   - Automatiskt: ett test som kontrollerar att `CHECK`-värdena i migration 1 matchar `FIREARM_TYPES` och `sessionLimits`. Det fångar avvikelser, men visar inte att SQL:en går att köra.
   - Manuellt: täcks i steg 6 med riktig expo-sqlite på S20.
5. **Klart när:** Schema, migrationsrutin och repository finns. Radvalidering och migrationslogik är enhetstestade, och det är dokumenterat vad mockarna inte täcker.

## Steg 4 – Skapa session (formulär och arbetsflöde)

1. **Filer:**
   - `apps/mobile/app/_layout.tsx` (ändras): `SQLiteProvider databaseName={DATABASE_NAME} onInit={migrateDatabase}` runt Stack. Om migrationen misslyckas visas en tydlig felskärm i stället för en tom app.
   - `apps/mobile/app/sessions/new.tsx`: en tunn route som renderar `SessionForm` och navigerar tillbaka till listan efter sparning.
   - `apps/mobile/src/services/deviceContext.ts`:
     - `nowUtcIso()`
     - `deviceTimeZone()`, som hämtar tidszonen från `Intl.DateTimeFormat().resolvedOptions().timeZone` och kastar ett fel om värdet saknas eller är ogiltigt
     - `newSessionId()`, som använder `randomUUID` från `expo-crypto`.
   - `apps/mobile/src/features/sessions/createSession.ts`: `createSession(input, deps: { id, now, timeZone, save })` validerar, bygger posten och sparar. Resultatet är `invalid` (med fältfel), `saved`, `alreadySaved` eller ett kastat fel.
   - `apps/mobile/src/features/sessions/firearmTypeLabels.ts`: `Record<FirearmType, string>` med Pistol, Revolver, Rifle och Other. Kompilatorn kräver en etikett per typ.
   - `apps/mobile/src/features/sessions/fieldErrorMessages.ts`: engelska feltexter byggda av felkod och gränskonstanter, utan hårdkodade tal.
   - `apps/mobile/src/features/sessions/SessionForm.tsx`: fält, segmentknappar för vapentyp (`accessibilityRole="radio"`), knappen Save och fältfel under respektive fält.
   - Tester: `apps/mobile/tests/features/createSession.test.ts` och `fieldErrorMessages.test.ts`.
2. **Beteende:**
   - Sessions-ID skapas med `useState(() => newSessionId())`, alltså en gång per formulärinstans. Ett återförsök efter ett fel använder samma ID. När användaren lämnar skärmen och öppnar formuläret igen skapas ett nytt ID.
   - En `useRef`-flagga för pågående sparning blockerar samtidiga tryck direkt. Knappen är inaktiverad och visar "Saving…" medan sparningen pågår.
   - Vid fel visas ett meddelande och en Retry-knapp, och inmatningen behålls.
   - Vid `SessionIdConflictError` visas ett felmeddelande. Den befintliga raden skrivs aldrig över tyst.
   - Distansfältet använder `keyboardType="decimal-pad"` och heltalsfälten `number-pad`. Tangentbordet räknas inte som validering, utan domänen avgör.
3. **Beroenden:** `expo-crypto`.
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
     - formuläret öppnas igen och nästa session får ett nytt ID.
5. **Klart när:** En giltig session sparas en gång, ogiltig inmatning stoppas med begripliga fel och återförsök skapar inga dubbletter.

## Steg 5 – Lista sessioner

1. **Filer:**
   - `apps/mobile/app/index.tsx` (ersätts): en route som läser via `listSessions` när skärmen får fokus (`useFocusEffect`) och renderar `SessionList`.
   - `apps/mobile/src/features/sessions/SessionList.tsx`: `FlatList`, tomt läge ("No sessions yet") och knappen "New session".
   - `apps/mobile/src/features/sessions/formatSession.ts`: ren formatering av lokal tid (`toLocaleString`), distans (`25.5 m`) och planerade rundor ("Not planned" när värdet är `null`).
   - Test: `apps/mobile/tests/features/formatSession.test.ts`.
2. **Beteende:**
   - Varje post visar vapennamn, typetikett, kaliber, distans, skott per runda, planerade rundor och skapad tid i enhetens lokala tid.
   - Ogiltiga rader visas som "Unreadable session record" med id och orsak. De försvinner inte och fylls inte med standardvärden.
   - Om läsningen misslyckas visas ett felläge med Retry.
3. **Beroenden:** inga.
4. **Kontroller:**
   - Automatiskt: `formatSession` för distans med och utan decimal, `null` för rundor och en fast tidszon i testet (`TZ` sätts i Jest-konfigurationen).
   - Därefter lint, typkontroll och tester.
   - Manuellt på S20: listan uppdateras efter sparning, nyast visas först och det tomma läget visas på en ny installation.
5. **Klart när:** Sparade sessioner visas korrekt, och felaktig data syns i stället för att döljas.

## Steg 6 – Dokumentation och integrationstester på enhet

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
4. **Beroenden:** inga.
5. **Kontroller:** Checklistan körs och resultaten fylls i. Det som inte har körts märks som overifierat.
6. **Klart när:** En ny utvecklare kan installera, köra och verifiera appen bara med hjälp av README, och resultaten från enheten är dokumenterade.

## Steg 7 – CI

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
- `Intl` i Hermes på RN 0.88 ger IANA-tidszon och lokal formatering. Det verifieras på S20 i steg 6. Om det inte fungerar stoppas sparningen med ett fel, och `expo-localization` föreslås för godkännande.
- Distans som börjar med decimaltecken (`.5`) eller slutar med det (`25.`) avvisas. Inledande nollor (`007`) godtas som 7.
- npm 11 kör inte installationsskripten för `@parcel/watcher` och `unrs-resolver` utan godkännande. Lint och bundling fungerar ändå, så de är inte godkända.
- Inga commits görs utan att ägaren ber om det. Föreslagna granskningspunkter är efter varje steg.
