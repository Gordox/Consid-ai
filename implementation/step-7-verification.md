# Detaljplan steg 7: verifiering på enhet, felinjektion och dokumentation

> **Notis (2026-10-28):** Developer checks, testläget, scenarioväljare och testdatabasradering är borttagna ur appen på ägarens beslut (`implementation/ui-ux-v2.md`). Delarna 7c–7f kan inte återupptas i den form som beskrivs här. Steget är fortfarande pausat och inte klart. Beslut och resultat nedan står kvar som historik.

> **Status (2026-10-27):** Planens riktning är godkänd av ägaren, med besluten Ö1–Ö8 (§8). **7a:** Checklistan är skapad och godkänd. **7b:** Grunden för testverktyget är implementerad och enhetstestad (§10). T1–T6 och N4 är godkända på S20. **7c–7f är pausade** (ägarbeslut 2026-10-27, §11) till förmån för appens funktioner. 7b är committad i `4e9dd1b` och tangentbordsrättningen efter E2 i `0fec9d9`. 7a, alltså planen och checklistan, committas tillsammans med den här statusen.
> **Utgångsläge och branch:** `feature/session-verification`, skapad från `feature/session-list` vid `3063e63` (Ö7). Ingen push eller sammanslagning görs utan ägarens besked.

## 1. Kontext och underlag

Steg 7 ska verifiera det som steg 3, 5 och 6 lämnade som overifierat, med så lite ny kod som möjligt. Underlag:
- `CLAUDE.md`
- `PLAN.md` steg 7
- `implementation/step-3-persistence.md` §7 (testplanen för S20)
- `implementation/step-5-create-session.md` §6 och §8
- `implementation/step-6-session-list.md` §6
- `docs/bugs/keyboard-covers-lower-form-fields.md`.

**Befintliga resultat som gäller oförändrat:**

| Område | Resultat | Källa |
| --- | --- | --- |
| Lyckat flöde för att skapa session | Kontrollerat på S20 i Expo Go | Steg 5d. Vilka av de tio punkterna som gicks igenom är inte specificerat. |
| Sessionslistan, M1–M5 och M7–M10 | Godkända på S20 i Expo Go | Steg 6, ägaren, 2026-10-27 |
| Persistens efter fullständig omstart (produktionsdatabasen) | Verifierad via M5 i den testade miljön | Steg 6 |
| M6 (datum, språk, tidszon) | **Delvis kontrollerad, inte verifierad** | Steg 6 |
| Tangentbordsrättningen (`840e8c7`) | Verifierad för `Planned rounds`, åtkomst till `Create session` och återställd layout i Expo Go på S20 | Buggrapporten |
| Automatiska tester | 22 sviter, 453 tester, alla godkända vid `3063e63` | Körning 2026-10-27 |

**Vad som indirekt redan är visat på S20 utan att vara ett eget test:**
- **Tidszonen i Hermes:** `deviceTimeZone()` gav ett värde som `isTimeZone` godtog. Annars hade `prepareSession` gett `Couldn't prepare session`, och M2 hade inte gått igenom.
- **Migration 1 mot riktig SQLite:** Den kördes på en ny databas och gav ett schema som `saveSession` och `listSessions` fungerar mot (M1–M5).

Det räknas som indirekt evidens. Kontrollerna P1 och P15 nedan ger direkt evidens.

## 2. Verifieringsmatris

**Kategorier:**
- **A:** automatiska tester med fake (Jest, Node)
- **I:** integrationstester mot riktig SQLite på enheten, via testverktyget och testdatabasen
- **U:** manuella UI-tester på S20 i Expo Go, med eller utan felinjektion
- **X:** kräver en egen Android-build eller iOS. Blockerat tills det finns ett nytt beslut.

Resultatkolumnen fylls i först när ägaren har rapporterat. Allt nedan är **ej genomfört**.

| Krav | Redan täckt av | Kvarstående metod | Förväntat resultat | Miljö | Avsnitt |
| --- | --- | --- | --- | --- | --- |
| Schemat, WAL och `user_version` på en ny databas | A (ordning med fake) | I: P1 | `user_version = 1`, `journal_mode = wal`, nio kolumner enligt `table_info` | S20, Expo Go | §3 |
| Upprepad initiering ändrar inget | A | I: P2 | Samma `sqlite_master` och samma version | S20 | §3 |
| En nyare databas lämnas orörd | A | I: P3, U: F2 | `DatabaseVersionTooNewError`, filen fortfarande 99, inget WAL och inga tabeller. Felskärmen visar U3-texten. | S20 | §3, §5 |
| Rollback när en migration misslyckas | A (bara att felet slås in) | I: P4, U: F3 | Versionen står kvar, och den halvt skapade tabellen finns inte | S20 | §3, §5 |
| `openSessionDatabase` stänger anslutningen efter ett migrationsfel | A | I: P5 | Testdatabasen går att radera direkt efteråt, vilket visar att anslutningen är stängd | S20 | §3 |
| Parameterbindning | A (SQL-strängen) | I: P6 | Texten sparas ordagrant, och tabellen finns kvar | S20 | §3 |
| `CHECK` och `STRICT` | A (bara frusen SQL-text) | I: P7, P8 | Rå SQL avvisas av SQLite | S20 | §3 |
| `saved` och `alreadySaved` | A | I: P9 | `saved` och sedan `alreadySaved`, med en rad | S20 | §3 |
| Id-konflikt | A | I: P10, P11, U: F8 (trigger) eller F8c (kontrollerat fel, bara UI) | `differentContent` och `existingRowInvalid`. Befintlig rad oförändrad. | S20 | §3, §5 |
| Samtidiga sparningar | A (bara logiken) | I: P12 | Exakt en rad. Ett `saved` och ett `alreadySaved`, eller två olika rader. | S20 | §3 |
| REAL, NFC och emoji läses tillbaka exakt | Inget | I: P13, P14 | `===` efter läsning | S20 | §3 |
| NFC-normalisering och tidszon i Hermes | Indirekt (M2) | I: P15 | `é` som en kodpunkt. Enhetens zon visas och godtas. | S20 | §3 |
| Ogiltiga rader i `listSessions` | A (fake-rader) | I: P16, U: F12 | Rätt `invalidRows` med kolumner och orsaker, utan värden | S20 | §3, §5 |
| Stängning och radering av testdatabasen | Inget | I: P17 | `closeAsync` lyckas och raderingen tar bort filerna | S20 | §3 |
| Produktionsdatabasen påverkas inte | – | Huvudskydd: guarden i §4.1. Extra kontroll: I: P0 och P18. | Samma fingeravtryck före och efter. Annars rapportera och stoppa. | S20 | §4 |
| Startfel och Retry | A (`databaseLifecycle`) | U: F1–F3 | Se §5 | S20 | §5 |
| Sparfel och Retry med samma ögonblicksbild | A (`sessionFormController`) | U: F4 | Se §5 | S20 | §5 |
| Avvisad och Konflikt | A | U: F7, F8 | Se §5 | S20 | §5 |
| Långsam sparning, Leave och sena resultat | A | U: F5, F5b, F6, F9 | Se §5 | S20 | §5 |
| Nytt formulär medan en sparning pågår (T2) | A | U: F6 | Se §5 | S20 | §5 |
| Läsfel och Retry | A (`sessionListController`) | U: F10 | Se §5 | S20 | §5 |
| Misslyckad omladdning med kvarvarande kort | A | U: F11 | Se §5 | S20 | §5 |
| Listan uppdateras efter avslutad långsam sparning | A | U: F9 | Se §5 | S20 | §5 |
| M6 (tidszon, språk, 12/24 h) | Node-tester med uttrycklig locale | U: M6a–M6f | Korrekt efter fullständig omstart (Ö2). Beteendet under körning registreras. | S20 | §6 |
| Formuläret med tangentbordet öppet | `Planned rounds` verifierat | U: K1–K6 | Se §6 | S20 | §6 |
| Formulärets tillgänglighet utan tangentbord | Inte specificerat i 5d | U: K7, K8 | Se §6 | S20 | §6 |
| Bakåtnavigering och dialoger på Android | M4 (Discard via `Back`) | U: N1–N3 | Se §6 | S20 | §6 |
| Flygplansläge | Inget | U: N4, i testläge mot UI-testdatabasen | Appens lokala funktioner fungerar. En omladdning av Expo Go kräver Metro och ingår inte. | S20 | §6 |
| Egen Android-build: tangentbordet (H3, risk för dubbel anpassning) | – | X1 | – | Kräver Android SDK. **Blockerat.** | §6.4 |
| Andra tangentbord (Gboard) | – | X2 | – | **Ej genomförd.** Gboard installeras inte nu (Ö8). | §6.4 |
| iOS (allt) | – | X3 | – | Ingen enhet. **Blockerat.** | §6.4 |

## 3. Persistens på enhet (I)

### 3.1 Kontrakt som hittills bara har testats mot fake

Från steg 3 §7. Fake-testerna verifierar ordning och orkestrering, men inte detta:

| Kontrakt | Varför fake inte räcker |
| --- | --- |
| Migration 1 är giltig SQL, och `STRICT` och `CHECK` gäller | Fake kör ingen SQL |
| `ROLLBACK` i `withExclusiveTransactionAsync` återställer både DDL och `user_version` | Fake spelar bara in `rollback` |
| Versionskontrollen före WAL lämnar en nyare fil helt orörd | Fake har ingen fil |
| `PRAGMA journal_mode = WAL` ger `wal` på Android | Fake svarar vad testet säger |
| `ON CONFLICT DO NOTHING` ger `changes === 0`, och läsningen efteråt ser raden | Native-beteendet |
| Parameterbindning i native-koden | Fake binder inget |
| REAL och Unicode läses tillbaka exakt | Ingen lagring |
| Två samtidiga `saveSession` på samma anslutning | Ingen native-kö |
| `closeAsync`, och att en stängd fil går att radera | Ingen fil |

**Täcks redan av M5 och tas inte med igen (Ö5):** att data från det **redan testade normala sparflödet** finns kvar efter fullständig omstart, och sorteringen i produktionsdatabasen. Testdatabasen får ingen egen omstartskontroll.

M5 verifierar **inte** migrationer, rollback, krascher eller avbrott mitt i en skrivning. Migrationer och rollback täcks av P1–P4. Krasch och avbrott mitt i en skrivning ingår inte i steg 7 och förblir overifierade.

### 3.2 Kontroller (P0–P18)

Alla körs mot **`target-practice-device-check.db`** på en **egen anslutning**, aldrig mot `DATABASE_NAME`. Varje kontroll har ett id, ett förväntat utfall och ett faktiskt utfall som visas på skärmen. Resultatet innehåller id, `pass` eller `fail`, felklass och antal. Felmeddelanden från SQLite visas bara för testdatabaserna. **Inga sessionsuppgifter skrivs i loggar eller testrapporter**, inte heller testdatans värden. Det som rapporteras är id och status.

| # | Förberedelse | Handling | Förväntat |
| --- | --- | --- | --- |
| P0 | – | Läser produktionens fingeravtryck via den befintliga, redan öppna anslutningen, bara med `SELECT`: antal rader, högsta `rowid` och `user_version`. Inga sessionsvärden. | Värdena visas. Inget skrivs. Detta är en extra kontroll, inte huvudskyddet. |
| P1 | Testdatabasen raderas om den finns | `openSessionDatabase` mot testnamnet | `user_version = 1`, `journal_mode = wal` och nio kolumner med rätt typer enligt `PRAGMA table_info(sessions)`, samt indexet `sessions_created_at_idx` |
| P2 | Efter P1 | `migrateDatabase` en gång till | Samma `sqlite_master`-innehåll och version |
| P3 | Ny testfil med `PRAGMA user_version = 99`, sedan stängd | `openSessionDatabase` | `DatabaseVersionTooNewError`. Efter ny öppning: version 99, `journal_mode` inte `wal` och inga tabeller. |
| P4 | Ny testfil | `migrateDatabase(db, [...MIGRATIONS, 'CREATE TABLE half_done (x INTEGER); SELECT * FROM no_such_table;'])` | `MigrationFailedError` med version 2. `user_version` är 1, och `half_done` finns inte. |
| P5 | Samma som P3 | Efter felet i P3: `deleteDatabaseAsync(testnamnet)` | Raderingen lyckas. expo-sqlite vägrar radera en öppen databas (`DeleteDatabaseException`, kontrollerat i källkoden), så det visar att anslutningen stängdes. |
| P6 | Efter P1 | `saveSession` med vapennamnet `O'Brien "Dirty" Harry; DROP TABLE sessions;--` | Läses tillbaka ordagrant, och tabellen finns kvar |
| P7 | Efter P1 | Rå `INSERT` med `firearm_type = 'shotgun'` | Avvisas av SQLite (`CHECK`) |
| P8 | Efter P1 | Rå `INSERT` med `'abc'` i `planned_shots_per_round` | Avvisas av SQLite (`STRICT`) |
| P9 | Efter P1 | Samma `Session` sparas två gånger | `saved`, sedan `alreadySaved`. En rad. |
| P10 | Efter P9 | Samma id, annan `createdAtUtc` | `SessionIdConflictError('differentContent')`. Raden oförändrad. |
| P11 | Rå rad med giltigt id och `firearm_name = ' x'` | `saveSession` med samma id | `SessionIdConflictError('existingRowInvalid')`. Raden oförändrad. |
| P11b | Efter P1: konfliktriggern från §4.5 skapas på testanslutningen | `saveSession` med en ny session | `SessionIdConflictError('differentContent')`. Exakt en rad med id:t, och den har triggerns värden, inte sessionens. Detta verifierar triggern innan F8 körs (Ö3). |
| P12 | Efter P1 | `Promise.all` med samma session två gånger, sedan med två olika sessioner | En rad, ett `saved` och ett `alreadySaved`. Sedan två nya rader. |
| P13 | Efter P1 | Sparar distanserna `0.1`, `25.5` och `999.9` och läser tillbaka | `===` |
| P14 | Efter P1 | Namn med NFC-text (`Śląsk`) och emoji (`🎯 Range`) | Oförändrade efter läsning |
| P15 | – | `validateSessionInput` med `e` + U+0301 i namnet, och `deviceTimeZone()` | Namnet blir `é` med längden 1, och tidszonen visas och godtas av `isTimeZone` |
| P16 | Efter P1 | Rå rader med versalt id, `created_at_utc = '2026-02-30T…'`, tidszonen `Foo/Bar`, namnet `' x'` och distansen `0.15`. Sedan `listSessions`. | Giltiga rader i `sessions`, och de fem i `invalidRows` med rätt kolumner och orsaker. `JSON.stringify(invalidRows)` innehåller inga radvärden. |
| P17 | Efter alla | `closeAsync`, sedan `deleteDatabaseAsync` | Båda lyckas. En ny öppning ger `user_version = 0`, och den raderas igen. |
| P18 | – | Läser produktionens fingeravtryck igen | Samma som P0. **Om värdena skiljer sig:** verktyget visar skillnaden och stoppar. Inga fler kontroller körs, och inget försök görs att återställa användarens databas. Ägaren beslutar om fortsättningen. |

**Stängning och städning:**
- Varje kontroll som öppnar en anslutning stänger den i `finally`.
- Testdatabasen raderas före körningen, om den finns, och efter körningen, även om en kontroll misslyckades.
- Ett misslyckat stängnings- eller raderingssteg redovisas som ett eget fel och döljs aldrig. Om det kvarstår visar verktyget att testdatabasen kan finnas kvar.

**Att radera bara om filen finns:** expo-sqlite kastar `DatabaseNotFoundException` när filen saknas och har inget API för att kontrollera om den finns. Det finns två alternativ:
1. **Föreslås:** Före körningen öppnas testdatabasen, stängs och raderas. Det skapar en tom fil om den saknas, vilket är ofarligt för ett testnamn.
2. Undantaget tolkas utifrån felmeddelandet. Det är skörare, eftersom meddelandet inte är ett kontrakt.

## 4. Isolerat testverktyg och felinjektion

### 4.1 Principer

- **Bara utvecklingsläge (Ö1):** `__DEV__` skyddar på tre nivåer, inte bara länkens synlighet:
  1. **Länken** i listan renderas bara när `__DEV__` är sann.
  2. **Testvägen:** `app/dev/checks.tsx` renderar bara `Not available` när `__DEV__` är falsk och anropar då ingen testfunktion.
  3. **Varje testoperation** (öppna en testdatabas, köra kontroller, förbereda scenarier, välja scenario, radera) börjar med `assertDevelopment()`, som kastar när `__DEV__` är falsk. Operationerna fungerar alltså inte ens om de anropas via en annan väg.
- **Inga sidoeffekter vid import:**
  - Inga moduler i `dev-tools` öppnar, skapar, ändrar eller raderar en databas på modulnivå. Allt sker i funktioner som anropas uttryckligen från verktygets skärm.
  - Ett enhetstest importerar modulerna med en mockad `expo-sqlite` och kontrollerar att `openDatabaseAsync` och `deleteDatabaseAsync` inte har anropats.
- **Bundlen:** Koden finns med i bundlen även i en release-build, men den körs aldrig där. Det är en accepterad begränsning (Ö1).
- **Inga generella ramverk:**
  - en fast lista med kontroller, P0–P18
  - en liten plan för engångsfel med tre insättningspunkter, som alla redan finns som inskickade beroenden:
    - `openAndMigrate` i `databaseLifecycle`
    - `save` i `sessionFormController`
    - `loadSessions` i `sessionListController`.
- **Skyddet för databaserna:**
  - **Huvudskydd:** Varje ändring och varje radering som verktyget gör är begränsad till de två uttryckligen tillåtna testdatabaserna, `target-practice-device-check.db` och `target-practice-ui-check.db`. Det gäller:
    - öppning av en testanslutning, eftersom öppning kan skapa en fil
    - radering
    - `PRAGMA user_version`
    - råa insättningar
    - omdöpning av tabeller
    - triggers.
  - Alla dessa går genom `assertTestDatabaseName(name)`. Den godtar exakt de två namnen och kastar för allt annat, även `DATABASE_NAME`, tom sträng och varianter med annat skiftläge.
  - Scenarioförberedelser tar emot databasnamnet och kör guarden innan de öppnar något. De får aldrig anslutningen från `SessionStore` i produktionsläge.
  - Funktionen enhetstestas.
  - **Extra kontroll:** Fingeravtrycket av produktionsdatabasen (P0, P18) är bara en extra kontroll. Om före och efter skiljer sig rapporterar verktyget det och stoppar. Inget försök görs att automatiskt återställa användarens databas.
  - **Fingeravtryckets begränsning (ägarens förtydligande):**
    - Antal rader, högsta `rowid` och `user_version` är en **begränsad rimlighetskontroll**.
    - Oförändrade värden bevisar **inte** att befintliga sessionsuppgifter är oförändrade. En ändring av en befintlig rad syns till exempel inte i något av de tre värdena.
    - Ingen mer avancerad lösning för fingeravtryck byggs nu. Huvudskyddet är fortsatt att alla teständringar bara kan nå de tillåtna testdatabaserna.
- **Inga sessionsuppgifter i loggar eller rapporter.** Verktyget loggar inget utöver felklasser i `__DEV__`, som `DatabaseGate` redan gör. Rapporter innehåller id för kontroller, status, felklass och antal.
- **Scenarioläget finns bara i minnet (Ö4):**
  - En fullständig omstart av appen går alltid tillbaka till produktionsdatabasen. Det finns ingen sparad flagga som kan låsa appen kvar mot testdatabasen.
  - När testläget är aktivt visas det tydligt på alla skärmar, i form av en banner högst upp: `Test mode: UI check database. Test data only.`
  - Bara testdata med namn som börjar med `UI check` används.
- **Inga nya beroenden.** Allt använder `expo-sqlite`, `expo-router` och React Native, som redan finns.

### 4.2 Två testdatabaser med olika syften

| Databas | Används av | Anslutning | Innehåll |
| --- | --- | --- | --- |
| `target-practice-device-check.db` | Persistenskontrollerna P1–P17 | Egen anslutning, som öppnas och stängs av verktyget | Skapas och raderas för varje körning |
| `target-practice-ui-check.db` | UI-scenarierna F1–F12 | `DatabaseGate` i scenarioläge, alltså samma väg som i produktion | Testdata med tydliga namn, till exempel `UI check · Pistol`. Raderas från verktyget i produktionsläge. |

### 4.3 Hur verktyget aktiveras

- **Ingång (Ö1):** En länk, `Developer checks`, längst ner i `SessionList`. Den renderas bara när `__DEV__` är sann och syns i alla listtillstånd, även vid läsfel.
  - Alternativet `DevSettings.addMenuItem` är inte kontrollerat i Expo Go och föreslås inte.
- **Route:** `app/dev/checks.tsx`, en tunn route till `src/features/dev-tools/DevChecksScreen.tsx`.
- **Skärmen har tre delar:**
  1. **Persistence checks:** Kör P0–P18 och visar resultatet per kontroll, med en sammanfattning högst upp.
  2. **UI scenarios:** Väljer ett scenario (§5), förbereder `target-practice-ui-check.db` och startar om `DatabaseGate` mot den.
     - Visar tydligt `UI check database active`.
     - Ger en knapp för att återgå, som startar om grinden mot produktionsdatabasen.
  3. **Cleanup:** Raderar `target-practice-ui-check.db`. Det går bara i produktionsläge, och native-koden vägrar ändå radera en öppen fil.

### 4.4 Scenarioläge i `DatabaseGate`

- `app/_layout.tsx` får, bara i `__DEV__`, en liten provider som håller `scenario: DevScenario | null`. `null` är startvärdet och betyder produktion.
- `DatabaseGate` får två valfria props, `databaseName`, som annars är `DATABASE_NAME`, och `faults`. Grinden renderas med `key` efter scenariot.
- **Ett scenariobyte avmonterar grinden.** Då körs den befintliga `deactivate`:
  - den väntar på `whenIdle()`
  - den stänger anslutningen
  - en ny grind öppnar den valda databasen.

  Navigeringen återgår till listan, eftersom `Stack` ligger inuti grinden.
- **Byte av läge och anslutningens livscykel (implementerat i 7b):** Bytet går genom den befintliga `databaseLifecycle`, med samma seriella kö som start, Retry och avmontering. Grinden avmonteras inte, och ingen ny livscykel skapas.
  1. `switchMode(mode)` sätter tillståndet `loading`. Skärmarna under grinden avmonteras då. Formulärets och listans kontroller körs med `dispose`, så att deras sena resultat inte publiceras i det nya läget.
  2. Den gamla anslutningens stängning läggs i kön:
     - Först väntar den på koordinatorn (`whenIdle()`), så att en sparning med flera satser hinner bli klar.
     - Sedan vägrar anslutningen nya operationer (`ConnectionClosingError`) och väntar på att pågående läsningar och skrivningar avslutas.
     - Sist körs `closeAsync`.
  3. Öppningen av den nya databasen läggs i samma kö och startar alltså först när den gamla anslutningen är stängd.
  4. **Initiering:** En öppning som pågår vid bytet slutförs. Dess generation är inaktuell, så anslutningen stängs utan att publiceras, och ett fel från den rapporteras inte i det nya läget.
  - Räkningen av pågående operationer görs av en liten omslutning runt anslutningen (`trackedConnection.ts`). Det är inget generellt ramverk.
- **Inga pågående operationer flyttas (Ö4):**
  - En sparning eller läsning använder alltid den anslutning som fanns när den startade. Den startas aldrig om mot den nya databasen.
  - Utöver livscykeln är knappen för byte inaktiverad i verktyget medan en sparning pågår, med texten `A save is in progress. Switch when it has finished.`
- **Evidens om stängningen:**
  - Ordningen (vänta på sparning, vänta på läsning, vägra nya operationer, stäng och öppna sedan) är **enhetstestad** med fake.
  - På enheten visar F9b att knappen är inaktiverad under en sparning.
  - Att native `closeAsync` fungerar efter ett byte visas på enheten av kontrollerna T4 och T6.

### 4.5 Riktiga databasfel och kontrollerade fel

**Riktiga fel**, framkallade i `target-practice-ui-check.db` med SQL innan grinden startas eller via verktyget medan listan visas:

| Fel | Hur |
| --- | --- |
| Nyare databasversion (F2) | `PRAGMA user_version = 99` på en tom fil |
| Migrationsfel (F3) | Tabellen `sessions` skapas manuellt med `user_version = 0`, så att `CREATE TABLE` i migration 1 misslyckas och rullas tillbaka |
| Läsfel (F10b, F11) | `ALTER TABLE sessions RENAME TO sessions_hidden`, och sedan tillbaka. `listSessions` får då ett riktigt `no such table`. |
| Ogiltiga rader (F12) | Råa insättningar enligt P16 |
| Id-konflikt (F8) | En `BEFORE INSERT`-trigger som först lägger in en annan rad med `NEW.id` (Ö3, godkänt försök) |
| Sparfel utan återhämtning (F4b) | En `BEFORE INSERT`-trigger med `RAISE(ABORT, 'dev: injected insert failure')` |

Konflikten via trigger går genom den riktiga repositoryvägen:
- Enligt SQLite-dokumentationen räknas ändringar som en trigger gör inte i `changes()`. Den yttre insättningen ger därför `changes === 0`.
- Läsningen ser triggerns rad, och `SessionIdConflictError('differentContent')` kastas av den riktiga koden.
- Att `changes` i expo-sqlite följer samma regel är **overifierat**.
- **Först verifieras att triggern faktiskt framkallar avsett resultat (Ö3).** Det görs som persistenskontroll P11b på testanslutningen innan UI-flödet F8 körs. Den visar att:
  - `saveSession` kastar `SessionIdConflictError` med `differentContent`
  - triggerns rad finns kvar
  - formulärets värden inte har skrivits.
- **Bara om P11b går igenom** räknas F8 som ett godkänt integrationstest av den riktiga konfliktmekanismen i UI-vägen.
- **Om P11b inte går igenom:** UI-flödet verifieras med det kontrollerade felet `conflictOnce` (F8c). F8c verifierar **bara UI-flödet** och räknas **inte** som ett godkänt integrationstest av konfliktmekanismen. Den riktiga mekanismen är då verifierad bara via P10 och P11 på repositorynivå.

**Kontrollerade fel** (`src/features/dev-tools/devFaults.ts`):
- En plan för engångsfel som verktyget fyller i och som förbrukas vid användning.
- De används där ett riktigt fel inte går att framkalla eller inte går att häva medan skärmen är öppen.

| Insättningspunkt | Fel | Används för |
| --- | --- | --- |
| `openAndMigrate` | `failNextOpen`: nästa öppning kastar ett `Error('dev: injected startup failure')` och lämnar ingen anslutning öppen | F1, där Retry ska lyckas |
| `save` | `failOnce`: första anropet kastar utan att anropa den riktiga `saveSession`, och nästa går igenom | F4, Retry med samma ögonblicksbild |
| `save` | `rejectOnce`: kastar ett riktigt `InvalidSessionError` | F7. Felet kan inte uppstå naturligt efter `prepareSession`. |
| `save` | `conflictOnce`: kastar ett `SessionIdConflictError('differentContent')` utan att anropa den riktiga sparningen | F8c, bara som reserv om P11b inte går igenom. Räknas inte som integrationstest. |
| `save` | `delayBeforeWriteMs` (15 000 eller 30 000, Ö6): väntar **innan** den riktiga `saveSession` anropas | F5, F6, F9. Raden finns inte i databasen under väntan. Det testar en sparning som är långsam innan något har skrivits. |
| `save` | `delayAfterWriteMs` (15 000): anropar den riktiga `saveSession` direkt och väntar **efter** att den har returnerat, innan resultatet lämnas till formuläret | F5b, F9. Raden finns i databasen medan formuläret fortfarande visar att sparningen pågår. Det testar ett svar som dröjer efter en lyckad skrivning, där listan kan visa raden innan formuläret vet att den sparades. |
| `save` | `delayBeforeWriteMs` följt av `failOnce` | F9, variant med fel: ingen rad skrivs, och listan laddas ändå om |
| `loadSessions` | `failNextReads: n`: de n nästa läsningarna kastar | F10, där `Try again` ska lyckas |

**Fördröjningarna är styrda och beskrivna (Ö6):**
- De är fasta värden som väljs i verktyget, alltså 15 s eller 30 s. De är inga slumpvärden.
- De gäller en gång och förbrukas av nästa sparning.
- Verktyget visar vilken fördröjning som är aktiv och om den gäller före eller efter skrivningen.
- Ingen fördröjning avbryter eller tidsbegränsar den riktiga sparningen.

**Registrerade sparanrop:** Omslaget runt `save` jämför varje anrop med det föregående. Verktyget visar bara `Attempt 1`, `Attempt 2: same snapshot (identity and values)` eller `Attempt 2: different snapshot`, som evidens för att Retry skickade samma ögonblicksbild (F4). **Inga id, tider eller andra sessionsvärden visas eller loggas.**

**Utan scenario** returneras originalfunktionerna oförändrade, och det enhetstestas.

### 4.6 Städning

- **Persistenskontrollerna:** städar efter sig själva (§3.2).
- **UI-databasen:**
  1. Återgå till produktion, eller starta om appen.
  2. Tryck `Delete UI check database`.
  3. Verktyget bekräftar att filen är borta genom att öppna, stänga och radera på nytt (§3.2).
- **Produktionsdatabasen:** Fingeravtrycket (P0, P18) läses före och efter en hel testomgång och visas så att ägaren kan jämföra.

## 5. Felflöden (U, med testverktyget)

Alla körs i scenarioläge mot `target-practice-ui-check.db`. "Enhetstestat" anger det som redan täcks av befintliga tester. "Ny evidens" anger vad enhetstestet inte kan visa.

| # | Flöde | Förberedelse | Handling | Förväntat | Enhetstestat | Ny evidens |
| --- | --- | --- | --- | --- | --- | --- |
| F1 | Startfel och Retry som lyckas | `failNextOpen` | Starta scenariot och tryck `Retry` | Felskärmen med U2-texten och bara `Retry`. Efter Retry visas listan. TalkBack läser upp felet. | `databaseLifecycle`: fel, klassning, Retry, ingen överlappning | `StartupErrorScreen` är inkopplad, texten och uppläsningen stämmer, och Retry fungerar med riktig öppning |
| F2 | Nyare version | `user_version = 99` | Starta scenariot och tryck `Retry` | U3-texten. Retry ger samma skärm igen. Efter återgång till produktion är produktionsdatabasen orörd (P0/P18). | Klassningen `newerVersion` | Riktigt fel, filen orörd och ingen loop |
| F3 | Migrationsfel | Tabellen finns redan med `user_version = 0` | Starta scenariot | U2-texten. Filen har fortfarande version 0 efteråt. | `openSessionDatabase` stänger vid fel | Riktigt `MigrationFailedError` och rollback i UI-vägen |
| F4 | Sparfel och Retry med samma ögonblicksbild | `failOnce` | Fyll i och tryck `Create session`, sedan `Try saving again` | Sparfelet visas med låsta fält. Efter Retry går appen tillbaka, och en ny rad syns. Verktyget visar två anrop med samma id, `createdAtUtc` och objektidentitet. | `retries with the exact same snapshot` | Låsta fält, texter och en riktig sparning efter Retry |
| F4b | Riktigt sparfel | Trigger med `RAISE` | Tryck `Create session`, sedan `Back` och `Leave` | Sparfel (osäkert), inte Konflikt eller Avvisad. Dialog 7.5. Ingen ny rad i listan. | `classifySaveResult` | Att ett riktigt SQLite-fel klassas som osäkert |
| F5 | Långsam sparning före skrivning och Leave | `delayBeforeWriteMs` 15 000 | Tryck `Create session`, vänta mer än 10 s, tryck `Back` och sedan `Leave` | T1 visas efter 10 s. Dialog 7.5. Appen går till listan, och kortet saknas. När sparningen är klar visas kortet utan att appen navigerar. | `flags a slow save`, `does not let a late result navigate` | Timern på enhet, dialogen och det sena resultatet |
| F5b | Långsamt svar efter skrivning och Leave | `delayAfterWriteMs` 15 000 | Som F5 | T1 och dialog 7.5 som i F5. **Kortet syns redan när listan visas efter Leave**, eftersom raden är skriven. Inget dubblettkort när svaret kommer och listan laddas om. | Samma | Att listan och formuläret förblir konsekventa när skrivningen redan har skett |
| F6 | Nytt formulär under pågående sparning | `delayBeforeWriteMs` 30 000 | Som F5, sedan direkt `New session` och fyll i | T2 visas, och `Create session` är inaktiverad. Den aktiveras när sparningen är klar, och det nya formuläret navigerar inte bort. | `shares the save lock between two forms` | Den delade koordinatorn i UI |
| F7 | Avvisad | `rejectOnce` | Tryck `Create session` | `Session not saved` med texten från Ö2, bara `Back to sessions` och ingen Retry. `Back` lämnar utan fråga. | `retry() gör ingenting`, `classifySaveResult` | Att skärmen och texten stämmer |
| F8 | Id-konflikt via trigger | P11b godkänd. Konfliktriggern i UI-databasen. | Tryck `Create session` | Konfliktskärmen enligt 7.6, utan Retry. Listan visar konfliktraden, inte formulärets värden. | Konfliktklassningen | Den riktiga konfliktmekanismen i UI-vägen. Räknas som integrationstest bara om P11b gick igenom (Ö3). |
| F8c | Id-konflikt, kontrollerat fel (reserv) | `conflictOnce`. Används bara om P11b inte gick igenom. | Tryck `Create session` | Konfliktskärmen enligt 7.6, utan Retry. Ingen ny rad. | Samma | **Bara UI-flödet.** Räknas inte som integrationstest av konfliktmekanismen. |
| F9 | Listan uppdateras när en långsam sparning blir klar | `delayBeforeWriteMs` 15 000, sedan en gång med `delayBeforeWriteMs` följt av `failOnce` | Leave enligt F5 och vänta på listan | Kortet dyker upp utan navigering eller polling. Med fördröjning följd av fel laddas listan om, men inget nytt kort visas. | `reloads an active list when a save finishes`, `reloads after a failed save` | Kopplingen mellan koordinatorn och listan i UI |
| F9b | Byte av läge under sparning | `delayBeforeWriteMs` 15 000 | Leave och gå till verktyget under sparningen. Försök `Return to production`. Försök igen när sparningen är klar. | Under sparningen är bytet inaktiverat med förklarande text. Efteråt fungerar bytet. Raden finns i UI-databasen vid nästa scenarioval, och produktionsdatabasens fingeravtryck är oförändrat. | `waits for an in-flight save before closing` | Att ingen pågående sparning flyttas till en annan anslutning eller databas (Ö4) |
| F10 | Läsfel och Try again | `failNextReads: 1` | Starta scenariot | `Sessions couldn't be loaded`, `Try again` och `New session`. Aldrig ett tomt läge. `Try again` visar listan. | `shows a read failure, never an empty list`, `retries after a failed first read` | Bannern och knapparna i UI |
| F10b | Riktigt läsfel | Tabellen omdöpt innan scenariot startar | Starta scenariot | Samma banner. Efter `Restore table` i verktyget och tillbaka läses listan. | – | Ett riktigt `no such table` klassas som läsfel |
| F11 | Misslyckad omladdning med kvarvarande kort | Listan laddad med kort, sedan `Hide table` i verktyget | Tillbaka till listan | Korten ligger kvar, med Ö2-bannern `Sessions couldn't be refreshed` och `Try again`. Efter `Restore table` och `Try again` försvinner bannern. | `keeps the earlier listing and flags the failure` | Ett riktigt fel och UI:t |
| F12 | Ogiltiga rader | Rader enligt P16 och två giltiga | Starta scenariot | Giltiga kort först, sedan fem `Unreadable session record` med kort id eller `ID unavailable` och begripliga orsaker. Inga råa värden. TalkBack läser varje kort som en grupp. `Try reading again` laddar om. | `invalidRowPresentation`, `toListItems` (inte testad separat) | Riktiga ogiltiga rader och skärmen |

## 6. Manuella kontroller (U)

Kontrollerna görs i Expo Go på S20 mot produktionsdatabasen och ändrar inga sessioner, utom där det står. Android-version, One UI-version, tangentbord och Expo Go-version noteras före första kontrollen. Det gäller även punkterna som var okända i buggrapporten.

### 6.1 M6, uppdelad

Varje fall har två kolumner, **under körning** och **efter omstart**:
- **Under körning:** Inställningen ändras medan appen är öppen. Sedan öppnas formuläret och stängs, så att listan läses om.
- **Efter omstart:** Expo Go stängs helt och startas igen, som i M5.

**Acceptanskriterium (Ö2):** I den här versionen räcker korrekt datum, språk och tidszon **efter fullständig omstart**.
- Beteendet **under körning** registreras för varje fall, men det är inget krav.
- Om det visar sig att listan inte följer en ändring under körning dokumenteras det som ett **produktbeslut**, en begränsning i den här versionen.
- Orsaken anges inte, till exempel cache i Hermes, om den inte har verifierats.

| # | Ändring | Förväntat efter omstart |
| --- | --- | --- |
| M6a | Utgångsläge: notera telefonens tidszon, språk och 12/24 h. Jämför ett nyss skapat korts tid med klockan. | Tiden stämmer med telefonens klocka på minuten. |
| M6b | 24 h till 12 h | Tiden visas med AM/PM eller motsvarande. Datumet är oförändrat. |
| M6c | Tillbaka till 24 h | Tiden visas som 24 h igen. |
| M6d | Språk eller region till svenska (Sverige) | Datumformatet följer svenska, till exempel `27 okt. 2026 14:00`, om Hermes har svenska data. Det exakta formatet noteras. |
| M6e | Automatisk tidszon av och London (Europe/London) | Alla kort flyttas med skillnaden mellan zonerna, en timme bakåt från Stockholm. Ordningen är oförändrad. |
| M6f | Allt tillbaka till utgångsläget | Samma som M6a |

### 6.2 Formuläret med tangentbordet öppet

| # | Handling | Förväntat |
| --- | --- | --- |
| K1 | Fokus i `Firearm name`, sedan `Calibre` | Fältet syns helt, och `Create session` kan skrollas fram |
| K2 | Fokus i `Distance (m)` | Samma. `decimal-pad` med komma eller punkt. |
| K3 | Fokus i `Shots per round` | Samma |
| K4 | Gå fältvis med returtangenten genom alla fält | Varje fält med fokus syns. Inget tomrum efter att tangentbordet stängts. |
| K5 | Tryck `Create session` med ogiltiga värden medan tangentbordet är öppet | Bannern och fältfelen syns eller kan skrollas fram. Fokus flyttas till det första ogiltiga fältet, och det syns ovanför tangentbordet. |
| K6 | Största systemtext och skärmzoom, sedan K3–K5 | Etiketter och fel radbryts och klipps inte. Fältet med fokus och `Create session` går att nå. |
| K7 | TalkBack med tangentbordet öppet: gå mellan fälten och till `Create session` | Etikett, värde och fel läses upp. `Create session` går att nå och aktivera. |
| K8 | TalkBack utan tangentbord: hela formuläret, typraderna och dialogen `Discard` | Enligt steg 5 §8. Den kontrollen är inte specificerad i 5d. |

### 6.3 Navigering och plattform på Android

| # | Handling | Förväntat |
| --- | --- | --- |
| N1 | Androids bakåtknapp på ett ändrat formulär, och bakåtknappen igen med dialogen öppen | Dialogen `Discard` visas. Bakåt med dialogen öppen ger `Keep editing`. |
| N2 | Androids bakåtknapp under F5 (långsam sparning) och F4 (sparfel) | Dialog 7.5. Bakåt i dialogen ger `Keep trying`. |
| N3 | Navigationsfältet, mörk bakgrund och ingen vit blinkning vid start och byte av skärm | Enligt `ui-ux.md` §11 |
| N4 | **I testläge mot UI-testdatabasen.** Appen är redan laddad i Expo Go. Slå på flygplansläge. Skapa en session med ett namn som börjar med `UI check`, läs listan och växla mellan skärmarna. Ladda inte om och starta inte om appen under testet. | Appens lokala funktioner (SQLite, formulär, lista) fungerar som vanligt. Inget av appens egna flöden behöver nätverk. |

**N4 och Metro:**
- Appen själv använder inget nätverk.
- **Expo Go behöver Metro**, och därmed nätverket, för att ladda JavaScript-bundlen vid start, vid omladdning och vid Fast Refresh. En omladdning eller omstart i flygplansläge kan därför ge ett anslutningsfel från Expo Go. Det är inte ett fel i appen och ingår inte i N4.
- En omstart skulle dessutom återställa normalläget.
- Appens funktion offline efter en kall start kan bara verifieras i en fristående build (X1).
- N4 körs i testläge så att inga testposter hamnar bland ägarens sessioner.

### 6.4 Egen Android-build, andra tangentbord och iOS (X), redovisas separat

| # | Område | Vad som skulle testas | Status |
| --- | --- | --- | --- |
| X1 | Egen Android-build | H3: om `adjustResize` plus `padding` ger dubbel anpassning. Dessutom start, tema, navigationsfält och persistens utanför Expo Go. | **Blockerat.** Kräver Android SDK, Java och `adb`, som inte är installerade (ägarbeslut). Inga verktyg installeras utan nytt beslut. |
| X2 | Andra tangentbord | K1–K5 med Gboard | **Ej genomförd.** Gboard installeras inte nu (Ö8). |
| X3 | iOS | Allt i steg 5 §8 (iOS), M1–M10, K1–K8 och `keyboardAppearance` | **Blockerat.** Ingen iOS-enhet. |

Dessa markeras som **overifierade** i all dokumentation tills de faktiskt har testats.

## 7. Genomförande

Efter varje delsteg med kod körs `npm run format:check`, `npm run lint`, `npm run typecheck` och `npm test -- --runInBand` från `apps/mobile`. Varje delsteg committas efter godkännande innan nästa påbörjas. Manuella resultat förs in först när ägaren har rapporterat dem.

| Delsteg | Filer | Ändring eller test | Förväntat resultat | Klart när |
| --- | --- | --- | --- | --- |
| **7a** Checklista för enheten | `docs/device-tests/sessions.md` (ny) | Checklistan med M6a–M6f, K1–K8, N1–N4, P0–P18 och F1–F12, med kolumner för datum, enhet, appversion, resultat och anteckningar. X1–X3 i ett eget avsnitt. Inga resultat ifyllda. | Ägaren kan köra §6 direkt utan ny kod | Filen finns, länkar och format är kontrollerade, och alla rader är markerade som ej genomförda |
| **7b** Grund för testverktyget (**implementerat och enhetstestat, ej verifierat på S20**, §10) | Se §10 | Utvecklingsskydd, tillåtna namn, radering av UI-testdatabasen, lägesbyte via livscykeln med stängning efter pågående operationer, testlägesbanner, verktygets skärm, route och länk | Enhetstesterna i §10 | Kontrollerna ger exit 0 (uppfyllt). T1–T6 och N4 i checklistan är körda på S20 (återstår). T7 väntar på 7e och är inget krav före 7c. |
| **7c** Persistenskontroller | `src/features/dev-tools/persistenceChecks.ts`, `DevChecksScreen.tsx`, `tests/features/dev-tools/persistenceChecks.test.ts` | P0–P18 som en fast lista. Varje kontroll får en öppen testanslutning och returnerar `pass` eller `fail` med förväntat och faktiskt utfall. | Enhetstester med fake: körningen stänger och raderar i `finally`, ett fel i en kontroll stoppar inte städningen, och en körning mot produktionsnamnet kastar innan något öppnas. **SQL-resultaten visas bara på enheten.** | Kontrollerna ger exit 0. Ägaren kör verktyget på S20 och rapporterar resultaten, som förs in i 7a. |
| **7d** Scenarioläge och riktiga fel | `app/_layout.tsx`, `src/features/startup/DatabaseGate.tsx` (`databaseName`, `key`), `src/features/dev-tools/devScenario.ts`, `uiScenarios.ts`, `DevChecksScreen.tsx`, tester för den rena delen | Scenarioval, förberedelse av `target-practice-ui-check.db` (F2, F3, F8, F10b, F11, F12), `Return to production` och `Delete UI check database` | Enhetstester: utan scenario används `DATABASE_NAME`, scenarioförberedelsen kör guarden och SQL:en för förberedelserna innehåller bara konstanter. | Kontrollerna ger exit 0. Ägaren kör F2, F3, F8, F10b, F11, F12 och F4b och rapporterar. |
| **7e** Kontrollerade fel | `src/features/dev-tools/devFaults.ts`, `DatabaseGate.tsx`, `SessionForm.tsx` och `SessionList.tsx` (omslag runt de befintliga `save` och `loadSessions`), `tests/features/dev-tools/devFaults.test.ts` | Engångsfelen i §4.5 och registreringen av sparanrop | Enhetstester: utan plan används samma funktion (identitet). Varje fel förbrukas en gång. Fördröjningen med fake timers anropar sedan den riktiga funktionen. `rejectOnce` kastar `InvalidSessionError`. Registreringen innehåller bara id, tid och identitet. | Kontrollerna ger exit 0. Ägaren kör F1, F4–F7, F9, F9b och F10 och rapporterar. |
| **7f** Dokumentation | `README.md`, `docs/decisions/0001-session-foundation.md` (ny), `docs/device-tests/sessions.md` (resultat), `PLAN.md`, den här planen samt statusraderna i steg 3, 5 och 6 och i buggrapporten | README enligt `PLAN.md` steg 7 punkt 2, plus ett avsnitt om testverktyget och hur testdatabaserna städas. Beslutsposten med B1–B10. Resultaten exakt som de rapporterats. | Allt som inte har körts är markerat som overifierat | Dokumentationskontrollerna, `format:check` och `git diff --check` går igenom |

**Ordning och beroenden:**
- 7a beror inte på någon kod. Ägaren kan köra §6 parallellt med 7b–7e.
- 7c, 7d och 7e kräver 7b.
- 7e kan göras före 7d om ägaren vill prioritera F4–F7.

**Nya beroenden:** inga. Allt använder `expo-sqlite` 58.0.14 (`openDatabaseAsync`, `deleteDatabaseAsync`, `closeAsync`), `expo-router` och React Native.

**Ändringar i produktionskod** (alla utan effekt när `__DEV__` är falsk eller inget scenario är valt):
- `DatabaseGate.tsx` får valfria props.
- `_layout.tsx` får en provider bara i `__DEV__`.
- `SessionForm.tsx` och `SessionList.tsx` får omslag runt de befintliga beroendena.
- `SessionList.tsx` får länken `Developer checks`, bara i `__DEV__`.

Kontrakten i `persistence/` ändras inte.

**Verkliga blockerare:**

| Blockerare | Påverkar | Status |
| --- | --- | --- |
| Android SDK, Java och `adb` saknas, och inga verktyg installeras (ägarbeslut) | X1 och H3 i buggrapporten | Blockerat tills ett nytt beslut |
| Ingen iOS-enhet | X3 | Blockerat |
| Gboard installeras inte nu (Ö8) | X2 | Ej genomförd |
| Ingen | 7a–7f i Expo Go på S20 | Inga blockerare |

**Risker som är kända men inte blockerande:**
- `changes` i expo-sqlite vid triggers. Det verifieras först i P11b, och F8c är reserven för UI-flödet (Ö3).
- Om listan följer ändringar av språk och tidszon under körning (M6). Det är inget krav (Ö2), och beteendet registreras.

## 8. Beslut (ägaren, 2026-10-27)

| # | Beslut |
| --- | --- |
| Ö1 | Ja till en utvecklingslänk. `__DEV__` skyddar också testvägen och varje testoperation, inte bara länken. Ingen testdatabas öppnas eller ändras som sidoeffekt av en import (§4.1). |
| Ö2 | Korrekt datum, språk och tidszon efter fullständig omstart räcker som acceptanskriterium i den här versionen. Beteendet under körning registreras. Begränsningar dokumenteras som produktbeslut och förklaras inte med Hermes-cache om det inte har verifierats (§6.1). |
| Ö3 | Triggerförsöket är godkänt i testdatabasen. Det verifieras först (P11b). Ett kontrollerat fel får verifiera UI-flödet (F8c) men räknas inte som godkänt integrationstest av den riktiga konfliktmekanismen (§4.5). |
| Ö4 | Scenarioläget finns bara i minnet. Testläget visas tydligt, och bara testdata används. Vid byte av läge flyttas inga pågående operationer till en annan anslutning eller databas (§4.1, §4.4). |
| Ö5 | M5 räcker för persistens efter omstart i det redan testade normala sparflödet. Det verifierar inte migrations-, rollback- eller kraschscenarier (§3.1). |
| Ö6 | 15 respektive 30 sekunder. Fördröjningen är styrd och beskriven, och det anges om den sker före skrivningen eller efter skrivningen men före svaret (§4.5). |
| Ö7 | `feature/session-verification` är skapad från `feature/session-list` vid `3063e63`. Planen är bevarad. Ingen sammanslagning eller push. |
| Ö8 | Gboard installeras inte nu, och X2 står kvar som ej genomförd. Egen Android-build (X1) och iOS (X3) förblir öppna. |

**Skyddet för databaserna (ägarens förtydligande):**
- All ändring och radering är begränsad till de två uttryckligen tillåtna testdatabaserna.
- Fingeravtrycket av den vanliga databasen är en extra kontroll, inte huvudskyddet.
- Inga sessionsuppgifter skrivs i loggar eller testrapporter.
- Om före/efter-jämförelsen skiljer sig rapporterar verktyget det och stoppar. Inget försök görs att automatiskt återställa användarens databas.

Inga öppna frågor återstår inför 7b.

## 9. Genomfört och nästa delsteg

**7a (2026-10-27, godkänd):**
- Besluten Ö1–Ö8 är införda i planen.
- `docs/device-tests/sessions.md` är skapad. Den har:
  - förutsättningar, handling, förväntat resultat, faktisk observation och status för varje kontroll
  - redan rapporterade resultat med hänvisning till källan
  - alla nya kontroller markerade som ej genomförda
  - en uppdelning mellan kontroller i den vanliga appen och kontroller som kräver testverktyget.

**7b (2026-10-27, `4e9dd1b`):** se §10. **Tangentbordsrättningen efter E2:** `0fec9d9`. Sluttestet utan diagnostik var OK på alla fem punkterna (buggrapporten).

**Nästa:** 7c, persistenskontrollerna, efter ägarens granskning av 7b och körningen av T1–T6 och N4 på S20. T7 väntar på 7e.

## 10. Resultat för 7b

**Nya filer** (under `apps/mobile/`):

| Fil | Ansvar |
| --- | --- |
| `src/features/dev-tools/testDatabases.ts` | De två tillåtna namnen, `assertDevelopment`, `assertTestDatabaseName` (exakt matchning, ekar aldrig namnet i felet), `databaseNameForMode` och `deleteTestDatabase` (utvecklingsskydd, namnskydd, öppna, stäng, radera). Inga sidoeffekter vid import. |
| `src/features/startup/trackedConnection.ts` | Räknar pågående operationer på anslutningen. `close()` vägrar nya operationer (`ConnectionClosingError`), väntar på pågående och stänger sedan. |
| `src/features/startup/databaseModeContext.ts` | `useDatabaseMode()` med läge och `switchMode` för verktygets skärm |
| `src/features/dev-tools/TestModeBanner.tsx` | `Test mode` / `UI check database. Test data only. A full restart returns to your sessions.` Visas över alla skärmar i testläge, även över laddning och felskärmen vid start. |
| `src/features/dev-tools/DevChecksScreen.tsx` | Visar läget. `Use UI check database` / `Return to normal database` (inaktiverad under sparning). `Delete UI check database` (bara i normalläge). Resultat visas bara som felklass. |
| `app/dev/checks.tsx` | Renderar verktyget bara när `__DEV__` är sann, annars `Not available` |
| `tests/features/dev-tools/testDatabases.test.ts`, `importSideEffects.test.ts`, `tests/features/startup/trackedConnection.test.ts` | Tester, se nedan |

**Ändrade filer:**
- **`src/features/startup/databaseLifecycle.ts`:**
  - Har nu `DatabaseMode` (`normal` eller `test`), `getMode()` och `switchMode()`.
  - `openAndMigrate` får läget.
  - Anslutningen lämnas ut via `trackConnection`.
  - Stängningen (`closeCurrent`) delas av byte och avmontering.
- **`src/features/startup/DatabaseGate.tsx`:**
  - Databasnamnet avgörs per öppning via `databaseNameForMode`.
  - `switchMode('test')` kräver `assertDevelopment()`.
  - Grinden tillhandahåller `DatabaseModeContext` och renderar bannern i testläge.
- **`src/features/sessions/SessionList.tsx`:** Länken `Developer checks` finns i sidfoten i alla listtillstånd, bara när `__DEV__` är sann.
- **`tests/features/startup/databaseLifecycle.test.ts`:**
  - Åtta nya tester för lägesbyte.
  - Två befintliga påståenden om identitet (`store.db` är samma objekt som anslutningen) är **ersatta** med en kontroll av att `store.db` skickar anrop vidare till just den anslutningen. Det beror på att butiken nu lämnar ut den räknande omslutningen. Påståendet är inte borttaget. Det kontrollerar fortfarande att rätt anslutning används, och att en övergiven anslutning inte används.

**Nya beroenden:** inga. `persistence/` och dess kontrakt är oförändrade.

**Automatiskt verifierat** (Jest, Node, fake, ingen rendering):

| Krav | Test |
| --- | --- |
| Import öppnar eller ändrar ingen databas | `importSideEffects.test.ts`: `testDatabases`, `DevChecksScreen`, `TestModeBanner`, `DatabaseGate`, `trackedConnection`, `app/dev/checks` och `app/_layout` importeras med en mockad `expo-sqlite`. `openDatabaseAsync` och `deleteDatabaseAsync` anropas inte. Lucide-ikonerna är mockade i just det testet, eftersom Jest inte laddar deras ES-moduler. **Testet visades kunna fånga felet:** ett tillfälligt `openDatabaseAsync` på modulnivå gav ett rött test och togs sedan bort. |
| Testoperationer avvisas utanför utvecklingsläge | `assertDevelopment(false)` kastar. `databaseNameForMode('test', false)` kastar. `deleteTestDatabase` med `isDevelopment: false` kastar utan att öppna eller radera något. |
| Den vanliga databasens namn och andra namn avvisas | `DATABASE_NAME`, tom sträng, annat skiftläge, mellanslag, sökväg, utan filändelse och ett annat namn kastar `NotATestDatabaseError`, utan att namnet syns i felet. `deleteTestDatabase` med dem öppnar och raderar inget. |
| Radering | Öppna, stäng och radera i den ordningen. Ingen radering om stängningen misslyckas. |
| Lägesbyte och pågående operationer | Den gamla anslutningen stängs innan den nya öppnas. En sparning och en läsning som pågår får bli klara innan stängningen. Nya operationer på den gamla anslutningen vägras. En initiering som pågår kasseras och stängs, och dess fel publiceras inte. Ett byte till samma läge gör inget. Efter avmontering öppnas inget mer. |
| Läget återställs vid omstart | En ny livscykel, som efter en fullständig omstart, börjar i `normal` och öppnar normalläget |

**Kontroller** (från `apps/mobile`, 2026-10-27):
- `npm run format:check`, `npm run lint` och `npm run typecheck` gav exit 0.
- `npm test -- --runInBand` gav 25 sviter och 482 av 482 tester godkända.
- `npx expo export --platform android` gav exit 0, med 1362 moduler.
- `git diff --check` gav inga fel.

**S20 (ägaren, Expo Go, 2026-10-27):**
- **T1–T6 och N4 är godkända (rapporterade).**
- Vanliga sessioner: 2 före och 2 efter.
- T2 gäller med tangentbordet stängt.
- T7 väntar på 7e och är inget krav före 7c.

**Fynd:** I testläge döljer tangentbordet återigen formulärets nedersta fält. Det är dokumenterat i buggrapporten, avsnittet "Ny observation i testläge". Det är inte åtgärdat, och 7c har inte påbörjats. Det gäller:
- att länken, bannern och bytet fungerar i UI
- att native `closeAsync` och `deleteDatabaseAsync` fungerar efter ett byte
- att testläget är tydligt på alla skärmar
- att en fullständig omstart återställer normalläget.

**Kan inte verifieras i Expo Go:**
- att länken och verktyget saknas i en release-build. Där är `__DEV__` falsk, vilket bara de automatiska testerna med `isDevelopment: false` täcker.
- Verktygets kod och texter finns i bundlen även i en release-build, vilket accepterades i Ö1.

**Kända begränsningar:**
- Bannern ligger ovanför skärmarna och tar själv hänsyn till statusfältet. Det är **inte kontrollerat** om skärmarna under den ändå får ett extra avstånd för statusfältet. Det kontrolleras visuellt i T2.
- Bytet kan inte framkallas under en sparning förrän fördröjningarna finns (7e).

## 11. Paus (ägarbeslut 2026-10-27)

Utbyggnaden av testverktyget pausas så att appens funktioner kan prioriteras.

**Behålls:** Grunden från 7b fungerar och finns kvar. Den består av utvecklingsskyddet, de tillåtna testdatabaserna, lägesbytet, bannern, radering och länken.

**Ingår i pausen:** Tangentbordsfelet i testläge är åtgärdat med den dynamiska offseten efter E2 (se buggrapporten). Diagnostiken är borttagen.

**Pausat och inte påbörjat:**
- 7c, persistenskontrollerna P0–P18 och P11b
- 7d, scenarioläget med riktiga fel: F2, F3, F4b, F8, F10b, F11, F12
- 7e, kontrollerade fel och fördröjningar: F1, F4–F7, F8c, F9, F9b, F10, samt N2 och T7
- 7f, dokumentationen: README-avsnittet för testverktyget, `docs/decisions/0001-session-foundation.md` och slutstatus.

**Kvarstående verifiering. Inget av detta är klart:**
- **Persistens mot riktig SQLite:** migrationer, rollback, nyare version, `CHECK` och `STRICT`, konflikter, samtidighet, REAL och Unicode samt stängning. Allt det är fortfarande bara testat med fake. Det är bara indirekt visat på S20 (M1–M5).
- **Felflödena i UI:**
  - startfel och Retry
  - sparfel och Retry
  - Avvisad och Konflikt
  - långsam sparning och sena resultat
  - läsfel, misslyckad omladdning och ogiltiga rader.

  Alla är bara enhetstestade.
- **M6a–M6f:** datum, språk och tidszon.
- **K1–K8:** övriga fält, felvisning, största text och TalkBack med tangentbordet öppet.
- **N1 och N3:** bakåtnavigering och plattform.
- **X1–X3:** egen Android-build, andra tangentbord och iOS.
- Att länken och verktyget saknas i en release-build.
