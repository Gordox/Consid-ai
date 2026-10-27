# Detaljplan steg 3: persistens med expo-sqlite, migrationer och sessionsrepository

> **Status:** Implementerat och enhetstestat (3a–3e, commits `8ced34c`, `10cfb19`, `ec87c7f`, `a216492` samt dokumentationen i 3e). Ej verifierat på Galaxy S20; integrationstesterna i avsnitt 7 körs i steg 7.

> **Numrering (2026-10-27):** Ett nytt steg 4 (UI/UX-design) har lagts till i `PLAN.md`, och tidigare steg 4–7 heter nu steg 5–8. Hänvisningarna till kommande steg i den här planen använder den nya numreringen.

## Kontext

Steg 2 är klart och ligger på `main` (`c8cee73`, plus ägarens commit `6bd992b`). Steg 3 ska kunna spara och läsa sessioner i SQLite på ett säkert sätt, så att steg 5 (formulär) och steg 6 (lista) kan bygga på det. Steg 3 planerar inte `SQLiteProvider`, skärmar, ID-generering, klocka, enhetens tidszon, redigering, borttagning, mål, status, vapenprofiler, backend, ORM eller generiska repositories.

## 1. Förutsättningar (kontrollerade utan ändringar)

| Område | Observation |
| --- | --- |
| Git | Branch `main`, ren arbetskatalog. Senaste commits: `6bd992b` (ägarens anteckningar) och `c8cee73` (steg 2f). **Förslag:** Skapa `feature/session-persistence` från `main` när planen är godkänd. |
| Steg 2 i koden | `Result` (`src/domain/result.ts`). `Session`, `SessionSettings`, `SessionField`, `SettingsFieldError(s)` (`session.ts`). `checkSessionSettings(unknown)` (`validateSessionInput.ts`). `isSessionId`, `isUtcTimestamp`, `isTimeZone` (`sessionMetadata.ts`). `buildSession` och `SessionBuildErrors` (`buildSession.ts`). `checkDistanceMetres` med domänens epsilon 1e-9 (`parseNumber.ts`). `FIREARM_TYPES` och gränskonstanterna. **Inget som steg 3 behöver saknas.** |
| Äldre signaturer i PLAN.md | Steg 3 i `PLAN.md` nämner redan att `checkSessionSettings` och metadatakontrollerna ska återanvändas. Planen utgår från de faktiska signaturerna ovan. |
| Test | `jest-expo`, `testMatch: tests/**/*.test.ts`, `types: ["jest"]`. 238 tester. Moduler som bara gör `import type` från expo-sqlite laddar inget nativt i Jest, eftersom Babel tar bort typimporterna. |
| expo-sqlite | SDK 58 anger `~58.0.14`. Den är inte installerad. Paketet innehåller SQLite **3.53.3** (`vendor/sqlite3/sqlite3.h`), så `STRICT`-tabeller (kräver 3.37) och `ON CONFLICT DO NOTHING` (kräver 3.24) stöds. expo-sqlite finns i Expo Go. |
| API:er som jag har kontrollerat i källkoden | `execAsync(source)` (ingen parameterbindning). `runAsync(source, params: SQLiteBindParams)` ger `{ changes, lastInsertRowId }`. `getFirstAsync<T>(source, params)` ger `T \| null`. `getAllAsync<T>(source, params)` ger `T[]`. `SQLiteBindValue = string \| number \| null \| boolean \| Uint8Array \| ArrayBuffer`. |
| `withExclusiveTransactionAsync` | Öppnar en **egen anslutning** (`Transaction.createAsync`, `useNewConnection: true`) och kör `BEGIN`, `task(txn)`, `COMMIT`. Vid fel körs `ROLLBACK` och det ursprungliga felet kastas vidare. Anslutningen stängs i `finally`. Alla frågor inne i transaktionen **måste** gå via `txn`. Andra skrivningar under transaktionen kan få felet `database is locked`. Fungerar inte på webb. |
| Dokumentationens exempel | Exemplet sätter WAL och `user_version` utan transaktion och med en interpolerad version. Planen avviker medvetet: versionen kontrolleras först och varje migration är atomisk. |

## 2. Omfattning

**Ingår:** databasnamn och schemaversion, migration 1, validering och mappning av rader, sparning med idempotenta återförsök, listning med synliga ogiltiga rader, enhetstester med fake samt en dokumenterad testplan för S20.

**Ingår inte:** se Kontext. Databasens livscykel, alltså att öppna databasen, `SQLiteProvider`, `onInit` och felskärmen, hör till steg 5.

## 3. Filer och kontrakt (bara signaturer)

```ts
// src/persistence/database.ts — bara typimporter från expo-sqlite
import type { SQLiteBindParams, SQLiteDatabase } from 'expo-sqlite';

export const DATABASE_NAME = 'target-practice.db';

// Den minsta del av anslutningen som persistenslagret använder. Läsresultat är unknown,
// så att allt som läses måste valideras vid körning och fakes inte behöver casts.
export type SessionDatabase = {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, params: SQLiteBindParams): Promise<{ readonly changes: number }>;
  getFirstAsync(source: string, params: SQLiteBindParams): Promise<unknown>;
  getAllAsync(source: string, params: SQLiteBindParams): Promise<unknown[]>;
  withExclusiveTransactionAsync(task: (txn: SessionDatabase) => Promise<void>): Promise<void>;
};

// Kontroll vid kompilering, utan cast, att den riktiga anslutningen uppfyller typen.
// Används i steg 5 när SQLiteProvider lämnar över anslutningen.
export function asSessionDatabase(db: SQLiteDatabase): SessionDatabase {
  return db;
}

export class DatabaseStateError extends Error {} // databasen är i ett läge som inte borde kunna uppstå

// src/persistence/sessionRow.ts — inga native-importer, bara domänen
export const SESSION_COLUMNS = ['id', 'created_at_utc', 'created_time_zone', 'firearm_name',
  'firearm_type', 'calibre_label', 'distance_m', 'planned_shots_per_round', 'planned_rounds'] as const;
export type SessionColumn = (typeof SESSION_COLUMNS)[number];
export type SessionRowError =
  | SettingsFieldError                 // från steg 2: required, tooLong, invalidNumber, tooManyDecimals,
                                       // outOfRange, unsupportedValue, invalidType, notNormalized
  | 'missingColumn' | 'invalidId' | 'invalidTimestamp' | 'invalidTimeZone';
export type InvalidSessionRow = {
  readonly id: string | null;          // bara om id:t i sig är ett giltigt sessions-ID
  readonly errors: Partial<Record<SessionColumn, SessionRowError>>; // kolumner och orsaker, aldrig värden
};
export function parseSessionRow(row: unknown): Result<Session, InvalidSessionRow>;
export function sessionToRowParams(session: Session): SQLiteBindValue[]; // i samma ordning som SESSION_COLUMNS

// src/persistence/migrations.ts
export const MIGRATIONS: readonly string[];          // index + 1 = version, får bara utökas
export const LATEST_SCHEMA_VERSION: number;           // = MIGRATIONS.length
export class DatabaseVersionTooNewError extends Error { readonly databaseVersion: number; readonly supportedVersion: number }
export class JournalModeError extends Error { readonly journalMode: string }
export class MigrationFailedError extends Error { readonly version: number; readonly cause: unknown }
export function migrateDatabase(db: SessionDatabase, migrations?: readonly string[]): Promise<void>;

// src/persistence/sessionRepository.ts
export type SaveSessionResult = 'saved' | 'alreadySaved';
export class InvalidSessionError extends Error { readonly errors: SessionBuildErrors }
export class SessionIdConflictError extends Error {
  readonly sessionId: string;
  readonly reason: 'differentContent' | 'existingRowInvalid';
}
export function saveSession(db: SessionDatabase, session: Session): Promise<SaveSessionResult>;
export type SessionListing = { readonly sessions: Session[]; readonly invalidRows: InvalidSessionRow[] };
export function listSessions(db: SessionDatabase): Promise<SessionListing>;
```

**Ansvar och importer (inga cirklar):**
- `database.ts` har bara typimporter från `expo-sqlite`.
- `sessionRow.ts` importerar bara från domänen och `expo-sqlite`-typen `SQLiteBindValue`, som en typimport.
- `migrations.ts` importerar `database.ts`.
- `sessionRepository.ts` importerar `database.ts`, `sessionRow.ts` och domänen.
- Ingen persistensmodul gör en import av `expo-sqlite` vid körning. Det kontrolleras med `grep` i 3e.

**Livscykel:** Alla funktioner tar emot en öppen anslutning (`db`). De öppnar och stänger den aldrig. I steg 5 kopplas `SQLiteProvider databaseName={DATABASE_NAME} onInit={migrateDatabase}`, och där visas också fel från migrationen.

**Fel som kastas:**

| Fel | När |
| --- | --- |
| `DatabaseVersionTooNewError` | `user_version` är högre än `LATEST_SCHEMA_VERSION`. |
| `JournalModeError` | WAL kunde inte aktiveras. |
| `MigrationFailedError` | En migration misslyckades. Har `version` och `cause`. |
| `InvalidSessionError` | Sessionen är ogiltig och skrivs därför inte. |
| `SessionIdConflictError` | Samma ID finns redan med annat innehåll eller som en ogiltig rad. |
| `DatabaseStateError` | Ett läge som inte borde kunna uppstå, till exempel ett ogiltigt svar på `PRAGMA` eller en konflikt där raden ändå saknas. |

Fel från SQLite själv, som `database is locked` eller ett CHECK-brott, kastas vidare oförändrade och fångas aldrig upp. Felmeddelanden innehåller id och kolumnnamn, men aldrig värden från raden.

## 4. Migrationer

**Ordning i `migrateDatabase(db, migrations = MIGRATIONS)`:**
1. `getFirstAsync('PRAGMA user_version', [])`. Svaret kontrolleras vid körning och måste vara `{ user_version: icke-negativt heltal }`, annars kastas `DatabaseStateError`.
2. Om versionen är **högre än** `migrations.length` kastas `DatabaseVersionTooNewError` **innan något skrivs**, alltså även före WAL, eftersom ändrat journalläge också är en ändring av filen.
3. `getFirstAsync('PRAGMA journal_mode = WAL', [])` körs på huvudanslutningen och **utanför** transaktioner, eftersom journalläget inte kan ändras inne i en transaktion. Om svaret inte är `wal` kastas `JournalModeError`. WAL lagras i filen och gäller därför även transaktionens egen anslutning.
4. Om versionen redan är `migrations.length` är migrationen klar.
5. För varje väntande version `n` körs `withExclusiveTransactionAsync(async (txn) => { … })`:
   - `user_version` läses igen **via `txn`**. Är den redan `>= n` har en annan initiering hunnit före, och migrationen hoppas över. Är den inte `n - 1` kastas `DatabaseStateError`.
   - `txn.execAsync(migrations[n - 1])` körs.
   - `txn.execAsync(\`PRAGMA user_version = ${n}\`)` körs. `n` är ett internt heltal och aldrig användardata.
6. Ett fel i en transaktion leder till `ROLLBACK` i expo-sqlite. Både schemat och versionen återgår, eftersom DDL och `user_version` är transaktionella i SQLite. Felet slås in i `MigrationFailedError(n, cause)`, och senare migrationer körs inte.

**Migration 1** (oförändrad från `PLAN.md`):
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
**Ny avvikelse:** Indexet omfattar också `id DESC`, så att det matchar sorteringen i `listSessions`. Det ändrar inget beteende.

**Vad `STRICT` och `CHECK` garanterar och inte garanterar:**

| Garanteras av SQLite | Garanteras inte, utan bara av domänen |
| --- | --- |
| Rätt lagringsklass per kolumn. Text som inte går att tolka i en INTEGER- eller REAL-kolumn avvisas. Heltal i en REAL-kolumn lagras som REAL. | NFC och trim. SQLite normaliserar aldrig Unicode. |
| `NOT NULL`, unikt `id` och intervall och tillåtna vapentyper enligt `CHECK`. | UUID-formatet, giltiga datum och giltiga tidszoner. |
| Längd i tecken (`length()` räknar tecken i TEXT, vilket motsvarar kodpunkter i UTF-8). | Högst en decimal för distansen. `CHECK` kontrollerar bara intervallet. |
| | Undantag: `length()` slutar räkna vid U+0000. En text med NUL kan alltså räknas kortare. Om den börjar med NUL bryter den mot `CHECK`, och insättningen ger ett synligt fel. Inget sparas tyst. |

**Andra typfrågor:**
- **NULL:** Bara `planned_rounds` får vara NULL.
- **Heltal:** Heltal i JS binds som tal. Med gränserna 1–100 uppstår ingen precisionsförlust.
- **REAL:** Distansen lagras som IEEE-double och läses tillbaka bit för bit lika. Det verifieras på S20.

**Gamla migrationer och framtida regler:**
- Migration 1 ändras aldrig. Ett test fryser dess exakta SQL-text, och ett annat test kontrollerar att `CHECK`-värdena stämmer med `FIREARM_TYPES` och gränskonstanterna. Ändras en konstant blir testet rött, vilket tvingar fram ett medvetet beslut.
- **Förslag till policy:**
  - Om gränser **vidgas** krävs en ny migration som bygger om tabellen, eftersom SQLite inte kan ändra `CHECK`.
  - Om gränser **skärps** för ny inmatning får de inte tillämpas på redan sparade rader. Då införs separata regler för lagrade poster, eller en version per rad, i samma ändring.
  - Ingen `rules_version`-kolumn läggs till nu.

## 5. Radvalidering (`parseSessionRow(row: unknown)`)

1. **Om `row` inte är ett objekt** (eller är `null` eller en array) får alla nio kolumner `invalidType`, och `id` blir `null`.
2. **Varje kolumn kontrolleras med `'kolumn' in row`.** En kolumn som saknas ger `missingColumn`. Det gäller även `planned_rounds`, där `null` är tillåtet men en saknad kolumn inte är det.
3. **Inställningar:** Ett objekt med fälten i `SessionSettings` byggs av de kolumner som finns och skickas till **`checkSessionSettings`** från steg 2. Fel per fält kopplas till kolumnnamn via en tabell av typen `Record<SessionField, SessionColumn>`, som kompilatorn kräver ska vara komplett. Regler för text, enum, intervall och decimaler kommer därmed bara från domänen. Flyttalsbrus hanteras av domänens `checkDistanceMetres` (epsilon 1e-9), och **ingen egen tolerans införs**.
4. **Metadata:** `isSessionId`, `isUtcTimestamp` och `isTimeZone` från steg 2. De ger `invalidId`, `invalidTimestamp` och `invalidTimeZone`, eller `invalidType` om värdet inte är en sträng.
5. **Alla fel samlas.** Ett lyckat resultat är ett nytt `Session`-objekt. Inga standardvärden sätts, och okända extra kolumner ignoreras.
6. **Felresultatet** innehåller bara `id`, om det är ett giltigt sessions-ID, och kolumnnamn med orsak. Inga namn, kalibrar eller andra värden från raden.

## 6. Repositoryt

**`saveSession(db, session)`:**
1. **Validering först:** `buildSession(session.settings, { id, createdAtUtc, createdTimeZone })`. Om den misslyckas kastas `InvalidSessionError(errors)`, och ingenting skrivs.
2. **Insättning:** `runAsync('INSERT INTO sessions (<9 kolumner>) VALUES (?, …, ?) ON CONFLICT(id) DO NOTHING', sessionToRowParams(session))`. **Alla värden binds som parametrar.** SQL-strängen är konstant.
3. **Om `changes === 1`** returneras `'saved'`.
4. **Om `changes === 0`** läses raden med `getFirstAsync('SELECT <9 kolumner> FROM sessions WHERE id = ?', [id])`:
   - Ingen rad ger `DatabaseStateError`. Det kan bara hända om raden tas bort samtidigt, och någon borttagning finns inte i appen.
   - En ogiltig rad ger `SessionIdConflictError(id, 'existingRowInvalid')`. Raden skrivs aldrig över.
   - En giltig rad jämförs fält för fält med `===` för alla nio värden. Identiskt innehåll ger `'alreadySaved'`, och annars kastas `SessionIdConflictError(id, 'differentContent')`.
5. **Samtidiga anrop:** Varje sats körs atomiskt i autocommit, och SQLite garanterar att bara en `INSERT` med samma id lyckas. Ett anrop som får `changes === 0` ser den andra radens commit och returnerar `alreadySaved` eller kastar konflikt. Repositoryt använder inte `withExclusiveTransactionAsync`, eftersom en egen anslutning kan ge `database is locked` för andra skrivningar.

**Kontrakt för steg 5 (dokumenteras nu, implementeras inte):** Ett återförsök måste skicka **exakt samma `Session`-objekt**, med samma `createdAtUtc`, tidszon och inställningar. Bara samma ID räcker inte. Om sessionen byggs om med ny tid ger det `differentContent` i stället för `alreadySaved`.

**`listSessions(db)`:**
- Kör `getAllAsync('SELECT <9 kolumner> FROM sessions ORDER BY created_at_utc DESC, id DESC', [])`.
- Varje rad går genom `parseSessionRow` och hamnar antingen i `sessions` eller i `invalidRows`, i samma ordning som frågan returnerar.
- Ett databasfel kastas vidare och blir **aldrig** en tom lista. Ogiltiga rader är data i resultatet, medan fel vid databasåtkomst är undantag.
- Sorteringen är kronologisk eftersom alla tidsstämplar har exakt samma format.

## 7. Teststrategi

Inga nya testberoenden används. Fakes ligger i `tests/persistence/fakeDatabase.ts`, som inte matchar `*.test.ts` och därför inte körs som en egen svit. Fakes implementerar `SessionDatabase`, spelar in anrop och returnerar förinställda svar.

| Fil | Täcker |
| --- | --- |
| `sessionRow.test.ts` (ren logik, ingen fake) | <ul><li>giltig rad, med och utan `planned_rounds`</li><li>varje kolumn saknas, inklusive `planned_rounds`</li><li>fel typer: id `42`, tid som tal, distans `'25'`</li><li>`null` i obligatoriska kolumner</li><li>värden som inte är objekt: `null`, `[]`, sträng</li><li>id med versaler ger `invalidId` och `id: null`</li><li>`2026-02-30…` ger `invalidTimestamp`, och id finns kvar</li><li>tidszonen `Foo/Bar`</li><li>namnet `' x'` och NFD-text ger `notNormalized`, 101 tecken ger `tooLong`</li><li>vapentypen `'shotgun'`</li><li>distans `0.15` ger `tooManyDecimals`, `0.1 + 0.2` godtas</li><li>skott `1.5` och `101`, rundor `0`</li><li>flera fel samtidigt</li><li>felresultatet innehåller inga värden från raden (kontrolleras med `JSON.stringify`)</li><li>extra kolumner ignoreras</li><li>indata ändras inte</li><li>`sessionToRowParams` ger rätt ordning och värden</li></ul> |
| `migrations.test.ts` (fake) | <ul><li>ny databas: versionen läses, sedan WAL, sedan en transaktion med migration 1 och `user_version = 1`, i den ordningen</li><li>databas med senaste versionen: bara versionen läses och WAL sätts, ingen transaktion körs</li><li>nyare databas: `DatabaseVersionTooNewError` utan något enda skrivanrop, alltså inte heller WAL</li><li>felaktigt svar på `user_version`: `DatabaseStateError`</li><li>WAL svarar `delete`: `JournalModeError` och ingen migration</li><li>fel i en migration: `MigrationFailedError` med version och `cause`, och senare migrationer körs inte (med två injicerade migrationer)</li><li>version som redan är högre inne i transaktionen: migrationen hoppas över</li><li>flera väntande migrationer: i ordning och var och en i en egen transaktion</li></ul> |
| `migrationSchema.test.ts` | <ul><li>migration 1 är fryst som exakt text</li><li>`CHECK`-värdena stämmer med `FIREARM_TYPES` och gränskonstanterna</li><li>`LATEST_SCHEMA_VERSION === MIGRATIONS.length`</li></ul> |
| `sessionRepository.test.ts` (fake) | <ul><li>ogiltig session: `InvalidSessionError` och inget anrop till `runAsync`</li><li>`changes 1` ger `saved`, och parametrarna har rätt ordning</li><li>SQL-strängen innehåller inga värden från sessionen, även med citattecken i namnet</li><li>`changes 0` med identisk rad ger `alreadySaved`</li><li>`changes 0` med annan `createdAtUtc` ger konflikt `differentContent`, vilket visar kontraktet för steg 5</li><li>`changes 0` med ogiltig rad ger `existingRowInvalid`</li><li>`changes 0` utan rad ger `DatabaseStateError`</li><li>avvisad `runAsync` kastar samma fel vidare</li><li>`listSessions`: blandade rader delas upp med bevarad ordning, tom tabell ger tomma listor, avvisad `getAllAsync` kastar vidare och SQL:en innehåller rätt `ORDER BY`</li></ul> |

**Vad fakes inte verifierar:** riktig SQLite, att SQL-syntaxen är giltig, `CHECK` och `STRICT`, `ROLLBACK`, transaktionsbeteendet i den native-koden, låsning, parameterbindning i den native-koden och REAL-värden som sparas och läses tillbaka. Allt det verifieras bara på S20.

**Testplan för integration på S20** (dokumenteras i 3e, körs i steg 7 med ett testverktyg som bara finns i utvecklingsläge, `__DEV__`; det verktyget ingår inte i steg 3):
- **Separat testdatabas:** `target-practice-device-check.db`. Verktyget vägrar köra mot `DATABASE_NAME`. Riktiga sessioner raderas eller ändras aldrig. Testdatabasen tas bort med `deleteDatabaseAsync` före och efter.
- **Fall som ska verifieras:**

| Fall | Förväntat |
| --- | --- |
| Ny databas | `user_version = 1`, `journal_mode = wal`, rätt kolumner enligt `table_info` |
| Initiering en gång till | Inga förändringar |
| Testdatabasen satt till `user_version = 99` | `DatabaseVersionTooNewError`, och filen är oförändrad (fortfarande 99 och inga tabeller) |
| Injicerad migration 2 med ogiltig SQL | Versionen står kvar på 1, och den halvt skapade tabellen finns inte. Det visar att `ROLLBACK` fungerar. |
| Parameterbindning med `O'Brien "Dirty" Harry; DROP TABLE sessions;--` | Texten sparas ordagrant |
| Rå SQL med `firearm_type = 'shotgun'` | Avvisas av `CHECK` |
| Rå SQL med `'abc'` i en INTEGER-kolumn | Avvisas av `STRICT` |
| Samma session sparad två gånger | `saved` och sedan `alreadySaved` |
| Annat innehåll med samma id | Konflikt |
| `Promise.all` med två sparningar av samma session | Exakt en rad, ett `saved` och ett `alreadySaved` |
| `Promise.all` med två olika sessioner | Båda sparas |
| Distanserna `0.1`, `25.5` och `999.9` | Läses tillbaka exakt lika (`===`) |
| NFC-text och emoji | Läses tillbaka oförändrade |
| Sortering efter att appen tvångsstängts och startats om | Rätt ordning, och sessionerna finns kvar |

## 8. Implementationsordning

Efter varje delsteg körs `npm run format:check`, `npm run lint`, `npm run typecheck` och `npm test -- --runInBand` från `apps/mobile`. Varje delsteg committas innan nästa påbörjas. Alla delsteg nedan räknas som **implementerade och enhetstestade**. Inget räknas som **verifierat på S20** förrän testplanen har körts i steg 7.

| Delsteg | Filer | Ansvar | Beroenden | Tester | Klart när |
| --- | --- | --- | --- | --- | --- |
| 3a | `package.json`, `package-lock.json`, `src/persistence/database.ts` (och `app.json` om installationen lägger till ett plugin) | `npx expo install expo-sqlite`, `DATABASE_NAME`, `SessionDatabase`, kontrollen vid kompilering och `DatabaseStateError` | **expo-sqlite ~58.0.14** (det enda nya beroendet) | Inga nya. Typkontrollen visar att `SQLiteDatabase` uppfyller `SessionDatabase`. | Alla fyra kontroller ger exit 0, `npx expo install --check` är OK och ändringen i lockfilen är redovisad |
| 3b | `src/persistence/sessionRow.ts`, `tests/persistence/sessionRow.test.ts` | `SESSION_COLUMNS`, `parseSessionRow`, `sessionToRowParams` | inga | Raderna för `sessionRow.test.ts` i avsnitt 7 | Alla rader går igenom, och domänens regler återanvänds utan egna regex eller gränser |
| 3c | `src/persistence/migrations.ts`, `tests/persistence/fakeDatabase.ts`, `migrations.test.ts`, `migrationSchema.test.ts` | Migration 1, `migrateDatabase` och migrationsfelen | inga | Raderna för migrationer i avsnitt 7 | Ordningen version, WAL, transaktioner är testad med fake, och den frysta SQL-texten och `CHECK`-värdena stämmer |
| 3d | `src/persistence/sessionRepository.ts`, `tests/persistence/sessionRepository.test.ts` | `saveSession`, `listSessions`, `InvalidSessionError` och `SessionIdConflictError` | inga | Raderna för repositoryt i avsnitt 7 | `saved`, `alreadySaved`, båda konflikterna och vidarekastade fel är testade |
| 3e | `PLAN.md`, `implementation/step-3-persistence.md` (status) | Steg 3 i `PLAN.md` uppdateras med de faktiska kontrakten. Testplanen för S20 läggs in i checklistan för steg 7. Det kontrolleras att persistenslagret bara har typimporter från expo-sqlite. | inga | `grep -rn "from 'expo-sqlite'" src/persistence` får bara ge träffar på `import type` | Alla fyra kontroller ger exit 0. Status: "implementerat och enhetstestat, ej verifierat på S20". |

## 9. Beslut och förslag

**Befintliga beslut som gäller:**
- B3: ingen målkolumn
- ingen statuskolumn
- historisk kopia i egna kolumner
- UTC-tid och IANA-tidszon
- unikt sessions-ID
- `ON CONFLICT DO NOTHING`
- migrationer som redan använts bevaras
- ogiltiga rader varken försvinner eller får standardvärden
- B7: ingen `better-sqlite3`, integrationstester på S20
- expo-sqlite är det enda nya beroendet.

**Nya förslag:**
1. `SessionDatabase` är en smal typ där läsresultat är `unknown`, med en kontroll vid kompilering mot `SQLiteDatabase`.
2. `migrateDatabase` tar en valfri lista med migrationer, för fake-tester och testverktyget på S20.
3. Ordningen är versionskontroll, WAL med kontroll av svaret (`JournalModeError`), och sedan en transaktion per migration där versionen läses om via `txn`.
4. Indexet omfattar även `id DESC`.
5. Felklasserna enligt tabellen i avsnitt 3.
6. Radfel per kolumn utan värden, där id bara tas med om det är giltigt.
7. Vid konflikt med en ogiltig befintlig rad kastas `SessionIdConflictError('existingRowInvalid')`.
8. Jämförelse med `===` på alla nio fält.
9. Policyn för framtida ändringar av regler.
10. Testverktyget för S20 byggs i steg 7, inte i steg 3.
11. Ny branch: `feature/session-persistence`.

**Ingen blockerande fråga.** Om `npx expo install expo-sqlite` lägger till ett plugin i `app.json` redovisas det i 3a, och ändringen behålls bara om Expo kräver den.
