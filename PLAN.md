# Implementationsplan: skapa och lista träningssessioner

## Kontext

Det här är den första avgränsade implementationen av Target Practice Log: en Expo-app (**Target Practice**, tekniskt namn `target-practice`) där man kan skapa en träningssession med validerade inställningar, spara den i SQLite och se sparade sessioner i en lista. Besluten B1–B10 och de övriga justeringarna från ägaren gäller.

Kamera, bildanalys, poängberäkning, mål, backend, autentisering, synk, redigering, borttagning, anteckningar och sessionsstatus ingår inte.

## Status

| Steg | Innehåll | Status |
| --- | --- | --- |
| 0 | Förberedelser | Klart |
| 1 | Scaffold och verktyg | Klart, enhetstest på S20 återstår |
| 2 | Domän: inställningar och validering | Ej påbörjat |
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
   - `tsconfig.json`: ärver `expo/tsconfig.base` och har `strict: true` och `noUncheckedIndexedAccess: true`.
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

## Steg 2 – Domän: inställningar och validering (ren TypeScript)

1. **Filer** (`apps/mobile/src/domain/session/`):
   - `firearmType.ts`: `FIREARM_TYPES = ['pistol', 'revolver', 'rifle', 'other'] as const`, `type FirearmType` och `isFirearmType(value: unknown)`.
   - `sessionLimits.ts`: alla gränser från B1 som namngivna konstanter. Distans uttrycks i tiondels meter (`DISTANCE_TENTHS_MIN = 1`, `DISTANCE_TENTHS_MAX = 10_000`).
   - `parseText.ts`: `normalizeLabel(raw)` (NFC och trim) och `codePointLength(s)` (`[...s].length`).
   - `parseNumber.ts`:
     - `parseDistanceMetres(raw)` med regex `^\d+([.,]\d)?$` (ASCII-siffror, ingen `u`-flagga). Värdet räknas som heltal i tiondelar för intervallkontrollen och returneras som meter.
     - `parseWholeNumber(raw)` med regex `^\d+$` och `Number.isSafeInteger`.
     - Båda returnerar ett typat resultat.
   - `session.ts`:
     - Typerna `SessionFormInput` (strängar, `firearmType: string | null`), `SessionSettings` och `Session` (`id`, `createdAtUtc`, `createdTimeZone`, `settings`).
     - `type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }`.
     - Felkoderna `required | tooLong | invalidNumber | tooManyDecimals | outOfRange | unsupportedValue`.
   - `validateSessionInput.ts`: `validateSessionInput(input: SessionFormInput): Result<SessionSettings, SessionFieldErrors>`.
   - `sessionId.ts`: `isSessionId(value: unknown)` (UUID-regex).
   - `createSession.ts`: `buildSession(settings, { id, createdAtUtc, createdTimeZone })`. Den validerar id, tid och tidszon och läser inte klockan själv.
   - Tester: `apps/mobile/tests/domain/*.test.ts`.
2. **Beteende:**
   - Text normaliseras med NFC och trimmas, och längden räknas därefter.
   - Tom text ger `required`, och text över gränsen ger `tooLong`. Texten trunkeras aldrig.
   - Distans:
     - `25,5` och `25.5` godtas båda.
     - Följande avvisas: `1 000`, `1,000.5`, `1.000`, `1e3`, `25.5m`, `-5`, `+5`, `.5`, `25.`, `25,55` (`tooManyDecimals`), `0` och `1000.1` (`outOfRange`).
   - Heltal: `1.0`, `1,5`, `10abc` och `1e2` avvisas. Inget värde avrundas.
   - Planerat antal rundor: tom sträng eller bara blanksteg blir `null`. Övriga värden valideras som heltal.
   - Okänd vapentyp ger `unsupportedValue`, saknad vapentyp ger `required`.
   - Alla fältfel returneras samtidigt, inte bara det första.
3. **Beroenden:** inga.
4. **Kontroller:**
   - Automatiska Jest-tester för:
     - varje gräns exakt på, strax under och strax över
     - NFC: `"é"` jämfört med `"é"` ger samma längd efter normalisering
     - emoji räknas per kodpunkt
     - blanka fält
     - alla avvisade talformat ovan
     - tomt valfritt fält blir `null` och aldrig `0`
     - flera fel samtidigt
     - `buildSession` med ogiltigt id eller tom tidszon.
   - Därefter `npm run lint`, `npm run typecheck`, `npm test -- --runInBand`.
5. **Klart när:** All validering är ren, deterministisk och testad, och den importerar inget från React Native, Expo eller SQLite.

## Steg 3 – Persistens: migration och repository

1. **Filer** (`apps/mobile/src/persistence/`):
   - `database.ts`: `DATABASE_NAME = 'target-practice.db'`.
   - `migrations.ts`:
     - `MIGRATIONS: readonly string[]`. Indexet plus 1 är versionen. Listan får bara växa, och en befintlig post ändras aldrig.
     - `migrateDatabase(db)`: läser `PRAGMA user_version`. Om databasversionen är högre än appens kastas ett fel och databasen lämnas orörd. Annars körs varje väntande migration tillsammans med `PRAGMA user_version = n` i `withExclusiveTransactionAsync`. `PRAGMA journal_mode = WAL` sätts före migrationerna.
   - `sessionRow.ts`: `parseSessionRow(row: unknown): Result<Session, InvalidSessionRow>`.
     - Den kontrollerar alla kolumntyper och kör samma domänregler som vid inmatning: längd, enum, intervall och högst en decimal.
     - Den kontrollerar också `isSessionId`, att datumet är giltigt ISO-UTC och att tidszonen inte är tom.
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
