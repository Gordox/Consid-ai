# Implementation och kodgranskning

Status: 2026-10-27. Dokumentationen bygger på Claude Codes sammanställning av repot, konversationen och körda kontroller. Resultaten har inte verifierats genom en separat granskning av repot här.

## Omfattning

Jag avgränsade arbetet till en mobilapp med React Native, Expo och TypeScript där användaren kan skapa en träningssession, få inmatningen validerad, spara sessionen lokalt i SQLite och se sparade sessioner i en lista.

Kamera, bildanalys, poängberäkning, backend, autentisering, molnsynkronisering, målhantering, redigering, borttagning och anteckningar lämnades utanför denna etapp.

Hittills är endast steg 0–1 genomförda: projektgrund och utvecklingsverktyg. Appen har en startskärm med rubriken ”Target Practice”. Formulär, domänvalidering, SQLite och sessionslista är ännu inte implementerade.

## Del A – Analys och plan

### Vad agenten identifierade

Repot saknade från början produktkod. Agenten föreslog tunna skärmar, separat formulärlogik, ren domänvalidering och avgränsad databasåtkomst.

Den identifierade risker för dubblerade valideringsregler, vapentyper på flera ställen, hårdkodade gränsvärden och alltför tillåtande talparsning. Exempelvis blir `Number("")` noll medan `parseInt("12abc")` accepterar en del av strängen.

Den lyfte även behov av migrationer, historiska kopior av sessionsinställningar, bevarad tidszon, skydd mot dubbel sparning och hantering av ogiltiga databasrader. Dessa var designrisker inför implementationen, inte konstaterade fel i befintlig produktkod.

### Vad jag stoppade eller ändrade och varför

- Jag stoppade `target_definition_id` från start. Målhantering ska införas senare utan påhittade mål-ID:n.
- Jag stoppade ett oanvänt statusfält. Status ska införas när ett faktiskt beteende behöver det.
- Jag avvisade `better-sqlite3` enbart för tester. Den riktiga Expo-integrationen ska testas på Galaxy S20; en annan SQLite-adapter verifierar inte den integrationen.
- Jag valde en liten egen valideringsfunktion framför zod för denna avgränsade implementation.
- Jag begränsade genomförandet till steg 0–1 trots att planen omfattar steg 0–7.
- Jag valde Node 26 efter uppgraderingen av min lokala Node-installation, i stället för agentens föreslagna Node 24.

### Vad agenten missade

Den första analysen saknade en konkret implementationsordning. Skyddet mot dubbel sparning behövde kompletteras med unik databasnyckel, återförsök och nytt ID för varje ny session. Testförslaget behövde tydligare skilja mellan ren logik, mockar och riktig expo-sqlite.

Under implementationen rapporterade agenten ytterligare brister:

- Den körde `brew install node@24` utan att först stämma av ändringen. En uppgradering av `simdjson` gjorde den befintliga Node-installationen obrukbar. Jag återställde den genom `brew upgrade node`.
- Beroendeplanen behövde justeras, bland annat genom att lägga till `react-dom` och välja en ESLint-version som fungerade med Expo-konfigurationen.
- Testkonfigurationen tillät enligt agenten ursprungligen en lyckad körning utan tester. Detta ändrades till `passWithNoTests: false`.
- Mallen innehöll filer som inte ingick i planen, bland annat `LICENSE`, `AGENTS.md` och `.claude/settings.json`. Agenten tog bort dessa och redovisade det som en avvikelse. Borttagningen och eventuell licensinformation behöver fortfarande bedömas; en mallfil ska inte automatiskt betraktas som onödig.
- Agenten redovisade inte direkt att `npm audit` hade rapporterat tre sårbarheter med hög allvarlighetsgrad. Dessa är fortfarande outredda.

### Vilka steg som genomfördes

Jag godkände planen och bad agenten implementera endast steg 0 och 1. Agenten skapade Expo-projektet, navigering, en tillfällig startskärm och konfiguration för TypeScript, ESLint, Prettier och Jest. Planen sparades i `PLAN.md`.

Ändringarna finns enligt sammanställningen i commit `0eb6b1c` på branchen `feature/session-foundation`. Steg 2–7 återstår. Vissa avvikelser från planen har redovisats, men min uttryckliga bedömning av samtliga avvikelser är ännu inte dokumenterad.

## Verifiering

### Automatiska kontroller och resultat

Följande rapporterades körda på commit `0eb6b1c` med Node 26.12.1, från `apps/mobile`:

| Kontroll | Rapporterat resultat |
| --- | --- |
| `npm run format:check` | Godkänd, exit 0 |
| `npm run lint` | Godkänd, exit 0 |
| `npm run typecheck` | Godkänd, exit 0 |
| `npm test -- --runInBand` | Underkänd, exit 1: inga tester finns ännu |
| `npm ls --depth=0` | Inga ogiltiga eller saknade paket rapporterade |

Testkommandots fel visar att frånvaro av tester inte döljs, men är inte ett godkänt testresultat eller bevis på fungerande beteende.

Tidigare kördes `npm ci` från tom `node_modules` framgångsrikt. Agenten rapporterade också godkända resultat för `npx expo install --check`, `npx expo-doctor` (20/20) och `npx expo export --platform android`. De tre senare kontrollerna gjordes före den sista ändringen av rotpaketets `engines`-uppgift i lockfilen och har inte rapporterats omkörda därefter.

En exporterad Android-bundle är inte samma sak som ett installerat och testat Android-program.

### Manuella tester och resultat

Inga manuella tester på telefonen är bekräftade ännu. Nästa kontroll är att starta projektet och verifiera att startskärmen visas på Samsung Galaxy S20.

När sessionsfunktionerna har implementerats återstår tester av giltig och ogiltig inmatning, sparning, dubbeltryck, listvisning och att sparade sessioner finns kvar efter omstart.

### Är projektet körbart?

Delvis verifierat. Installation, statiska kontroller och en tidigare Android-export har lyckats enligt agentens rapport. Körning på fysisk enhet är inte bekräftad. Den avgränsade produktfunktionen är ännu inte färdig.

### Kända begränsningar

- Formulär, validering, SQLite och sessionslista saknas.
- Automatiska tester saknas och testkommandot misslyckas därför.
- Tre tidigare rapporterade beroendesårbarheter är inte utredda. Deras påverkan på appen är ännu okänd.
- Installationsskript för `@parcel/watcher` och `unrs-resolver` har enligt agenten inte körts. Behov och konsekvenser behöver undersökas innan ett beslut fattas.
- README och CI återstår enligt planen.
- `PLAN.md` är på svenska trots projektinstruktionens krav på engelska. Språkvalet behöver förtydligas.
- Vissa genomförda avvikelser från planen återstår att bedöma.

## Del B – Arkitektur

- **Fynd och filreferens:** Separat arkitekturgranskning är inte genomförd. Designriskerna i Del A ska inte redovisas som verifierade kodfynd.
- **Min bedömning:** Behöver kompletteras efter granskning mot principerna i `CLAUDE.md`.
- **Åtgärd, verifiering och commit:** Ingen granskningsåtgärd redovisad. Commit `0eb6b1c` avser projektgrunden, inte en åtgärdad arkitekturgranskning.

## Del B – Säkerhet

- **Fynd och filreferens:** Separat säkerhetsgranskning är inte genomförd. Det finns en rapport om tre audit-varningar med hög allvarlighetsgrad, men paket, advisories, beroendekedjor och konkreta filreferenser saknas i underlaget.
- **Min bedömning:** Varningarna behöver utredas innan deras påverkan eller rätt åtgärd kan bedömas. De ska varken ignoreras eller beskrivas som bevisade exploaterbara fel i appen.
- **Åtgärd, verifiering och commit:** Ingen säkerhetsåtgärd eller tillhörande commit redovisad ännu.

## Del B – Kodkvalitet

- **Fynd och filreferens:** Separat kodkvalitetsgranskning är inte genomförd. Inga konkreta granskningsfynd med radnummer har redovisats.
- **Min bedömning:** Godkänd lint och typkontroll är värdefullt men ersätter inte granskning av ansvar, namngivning och felhantering.
- **Åtgärd, verifiering och commit:** Ingen granskningsåtgärd redovisad ännu.

## Återstående arbete inför inlämning

1. Bedöm avvikelserna från planen och utred audit-varningarna utan automatiska, potentiellt brytande uppgraderingar.
2. Bekräfta startskärmen på Galaxy S20.
3. Fortsätt den godkända planen ett steg i taget och dokumentera verifieringen efter varje steg.
4. Kör arkitektur-, säkerhets- och kodkvalitetsgranskning som separata uppgifter utan implementation.
5. Bedöm fynden, godkänn avgränsade åtgärder och dokumentera tester samt commit-ID per åtgärd. Om en kategori saknar verkliga fynd, redovisa detta och stäm av med läraren i stället för att hitta på problem.
6. Uppdatera denna dokumentation med faktiska resultat före inlämning.
