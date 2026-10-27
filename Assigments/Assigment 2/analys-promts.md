# Promts
## planing
Läs CLAUDE.md.

Projektet är nytt och har ännu ingen implementation. Analysera hur
kodbasens första grund bör utformas utifrån projektets krav.

För den här uppgiften begränsar vi implementationen till:
- En mobilapp med React Native, Expo och TypeScript.
- Ett formulär för att skapa en träningssession.
- Validering av sessionsinställningarna.
- Lokal lagring i SQLite.
- En lista där sparade sessioner visas.

Implementera inte kamera, bildanalys, poängberäkning, backend,
autentisering eller molnsynkronisering ännu.

Identifiera lämpliga ansvarsgränser, risker för duplicerad logik,
onödig komplexitet och framtida teknisk skuld.

Markera vilka beslut som behöver fattas och vilka antaganden du gör.

Jag vill bara ha en analys. Skapa eller ändra inga filer.

----
## Response
Analysen är klar och jag har inte ändrat något i repot. Den finns bara i planfilen /Users/antonsvensson/.claude/plans/pasted-content-id-af35-l-s-claude-md-floating-candy.md, som plan-läget kräver. Repot innehåller i dag bara CLAUDE.md och uppgiftsanteckningarna, så det finns ingen befintlig kod att bygga vidare på.

Ansvarsgränser

Skärmarna i app/ ska vara tunna och bara koppla ihop formulär, lista och navigering.
Formuläret i features/sessions håller fältvärdena som text, visar fel och hindrar att samma session sparas två gånger.
Domänen i domain/session är en ren valideringsfunktion utan beroenden till React Native, Expo eller SQLite. Den returnerar antingen ett godkänt värde eller fel per fält.
Lagringen i persistence sköter migrationer, ett tunt repository och en enda funktion som översätter mellan databasrad och session.
Risker för duplicerad logik

Formuläret får lätt egna valideringsregler vid sidan av domänens.
Listan över vapentyper kan hamna på tre ställen: i väljaren, i TypeScript-typen och i databasens CHECK. Gör en lista till enda källa och testa att migrationen stämmer med den.
Gränsvärden kan bli hårdkodade i feltexterna.
Lös talparsning: Number("") blir 0 och parseInt("12abc") blir 12.
Onödig komplexitet att undvika nu

State-bibliotek och ORM.
Generiska repositories.
Formulär- och schemabibliotek, om ingen godkänner dem.
Vapenprofiler, måldefinitioner och rundor som egna tabeller.
Teknisk skuld att förebygga från start

Migrationer som bara läggs till, aldrig ändras i efterhand.
Inställningarna sparas som en kopia i sessionen, i egna kolumner i stället för en JSON-klump.
Kolumnerna status, target_definition_id och distance_m finns från början.
Tid sparas i UTC tillsammans med tidszonen sessionen skapades i.
Ett fast ID per formulär, så att två tryck på spara inte skapar två sessioner.
Raderna valideras när de läses från databasen.
Beslut som behövs (B1–B10)

B1: Gränsvärden för namnlängder, avstånd och antal. CLAUDE.md kräver gränser men anger inga värden.
B2: Vilka vapentyper som ska finnas.
B3: Vilket mål-ID sessionen ska spara, eftersom målets mått inte är verifierade.
B4: Kaliber som fritext eller som en fast lista.
B5: Om decimalkomma ska godtas, till exempel 25,5.
B6: Egen validering eller zod.
B7: Hur databaskoden ska testas. expo-sqlite går inte att köra i Jest, så alternativet är att lägga till better-sqlite3 eller testa manuellt på telefonen.
B8: Om ESLint ska kompletteras med Prettier.
B9: Appens namn och licens.
B10: Om anteckningar ska kunna skrivas och sessioner redigeras redan i detta steg.
Mina antaganden

Vapeninställningarna fylls i direkt i formuläret, utan sparade vapenprofiler.
Bara skapa och lista sessioner, ingen redigering eller borttagning.
Textlängd räknas i Unicode-tecken efter normalisering.
Jest via jest-expo som testkörare.
expo-sqlite fungerar i Expo Go, så ingen egen utvecklingsbuild behövs för det här steget.
Arbetet sker i en egen branch, inte på main.
Säg till när du vill att jag implementerar det.