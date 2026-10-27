# Enhetskontroller: sessioner (steg 3–7)

Checklista för manuella kontroller och integrationstester på enhet.

> **Paus (2026-10-27):** Utbyggnaden av testverktyget (7c–7f) är pausad. Del B1, B2 och de rader i B0 som kräver 7e kan inte köras förrän arbetet återupptas. Del A kan köras i den vanliga appen. Inget som inte har körts är markerat som klart. Planen och besluten finns i [`implementation/step-7-verification.md`](../../implementation/step-7-verification.md).

**Regler för ifyllning:**
- Status och observationer fylls i **först när ägaren har rapporterat** dem. Inga resultat förutsägs.
- **Skriv inga sessionsuppgifter** i rapporterna (vapennamn, kalibrar, id, tider eller testdatans värden). Beskriv vad som syntes, till exempel "kortet överst visade rätt typ och distans".
- Om fingeravtrycket av den vanliga databasen skiljer sig före och efter (P0/P18): rapportera och stoppa. Försök inte återställa databasen.
- Fingeravtrycket (antal rader, högsta `rowid` och `user_version`) är en **begränsad rimlighetskontroll**. Oförändrade värden bevisar inte att befintliga sessionsuppgifter är oförändrade. Huvudskyddet är att testverktyget bara kan ändra de två tillåtna testdatabaserna.

**Statusvärden:**

| Status | Betydelse |
| --- | --- |
| Godkänd (rapporterad) | Ägaren har rapporterat att det förväntade resultatet uppnåddes |
| Underkänd (rapporterad) | Ägaren har rapporterat avvikelse. Avvikelsen beskrivs. |
| Delvis kontrollerad – inte verifierad | Kontrollen har gjorts ofullständigt |
| Ej genomförd | Kontrollen har inte körts |
| Ej genomförd – kräver testverktyget | Kan inte köras förrän verktyget finns (steg 7b–7e) |
| Blockerad | Kräver verktyg, enhet eller beslut som saknas |

## Testmiljö

Fylls i av ägaren före första nya kontroll. Värden som inte är kända anges som okända.

| Uppgift | Värde |
| --- | --- |
| Enhet | Samsung Galaxy S20 |
| Android-version | Okänd |
| One UI-version | Okänd |
| Tangentbord | Okänt (troligen Samsung Keyboard, ej bekräftat) |
| Expo Go-version | Okänd |
| Appens commit | – |
| Datum | – |

## Del A: kontroller i den vanliga appen (utan testverktyg)

Körs mot den vanliga databasen. Kontrollerna ändrar inga befintliga sessioner. Där en session skapas anges det.

### A1. Redan rapporterade resultat

Resultaten nedan är inte upprepade i steg 7. De gäller den miljö och det datum som står i källan.

| # | Kontroll | Status | Källa |
| --- | --- | --- | --- |
| S5 | Lyckat flöde för att skapa session (steg 5d). Vilka av de tio kontrollpunkterna som gicks igenom är inte specificerat. | Godkänd (rapporterad), omfattning ospecificerad | [`implementation/step-5-create-session.md`](../../implementation/step-5-create-session.md), status och §8 |
| M1 | Tomt läge eller befintliga sessioner vid start | Godkänd (rapporterad), 2026-10-27 | [`implementation/step-6-session-list.md`](../../implementation/step-6-session-list.md) §6 |
| M2 | Skapa session, nytt kort överst | Godkänd (rapporterad), 2026-10-27 | Samma |
| M3 | Ordning nyast först, singular och plural | Godkänd (rapporterad), 2026-10-27 | Samma |
| M4 | Discard och Back utan ändringar | Godkänd (rapporterad), 2026-10-27 | Samma |
| M5 | Sessionerna finns kvar efter fullständig omstart. Gäller det normala sparflödet, inte migrationer, rollback eller krascher. | Godkänd (rapporterad), 2026-10-27 | Samma |
| M6 | Datum, språk och tidszon | **Delvis kontrollerad – inte verifierad.** Ersätts av M6a–M6f nedan. | Samma |
| M7 | Korten är inte klickbara | Godkänd (rapporterad), 2026-10-27 | Samma |
| M8 | TalkBack i **listan** | Godkänd (rapporterad), 2026-10-27 | Samma |
| M9 | Största text och skärmzoom i **listan** | Godkänd (rapporterad), 2026-10-27 | Samma |
| M10 | Lång lista, skrollning, mörk bakgrund och statusfält | Godkänd (rapporterad), 2026-10-27 | Samma |
| KB | Tangentbordsrättningen (`840e8c7`): `Planned rounds` syns helt automatiskt, `Create session` går att nå och layouten återställs, i Expo Go | Godkänd (rapporterad), 2026-10-27, även sluttestet utan diagnostik | [`docs/bugs/keyboard-covers-lower-form-fields.md`](../bugs/keyboard-covers-lower-form-fields.md) |

M8 och M9 gäller **listan**. De säger inget om formuläret med tangentbordet öppet (K6, K7).

### A2. M6: datum, språk och tidszon

**Acceptanskriterium:** korrekt efter fullständig omstart. Beteendet under körning registreras men är inget krav. En avvikelse under körning dokumenteras som ett produktbeslut, utan att en orsak anges som inte har verifierats.

- **Under körning:** Ändra inställningen medan appen är öppen. Öppna sedan `New session` och tryck `Back`, så att listan läses om.
- **Efter omstart:** Svep bort Expo Go från de senaste apparna, eller använd Tvinga stopp. Starta sedan projektet igen, som i M5.

| # | Förutsättningar | Handling | Förväntat efter omstart | Observation under körning | Observation efter omstart | Status |
| --- | --- | --- | --- | --- | --- | --- |
| M6a | Minst en session är skapad nyss, och telefonens klocka är synlig | Notera tidszon, språk och 12/24 h. Jämför kortets tid med klockan. | Kortets tid stämmer med klockan på minuten | – (ingen ändring) | – | Ej genomförd |
| M6b | Efter M6a, med 24-timmarsformat | Byt till 12-timmarsformat | Tiden visas i 12-timmarsformat. Datumet är oförändrat. | – | – | Ej genomförd |
| M6c | Efter M6b | Byt tillbaka till 24-timmarsformat | Tiden visas i 24-timmarsformat | – | – | Ej genomförd |
| M6d | Efter M6c | Byt språk eller region till svenska (Sverige) | Datumet visas i svenskt format. Notera det exakta formatet. | – | – | Ej genomförd |
| M6e | Efter M6d. Notera den ursprungliga zonen. | Stäng av automatisk tidszon och välj London (Europe/London) | Alla kort flyttas med skillnaden mellan zonerna. Ordningen är oförändrad. | – | – | Ej genomförd |
| M6f | Efter M6e | Återställ alla inställningar till M6a | Samma visning som i M6a | – | – | Ej genomförd |

### A3. Formuläret med tangentbordet öppet och formulärets tillgänglighet

Fältet `Planned rounds` med standardtangentbordet är redan verifierat (KB). Inga sessioner sparas i A3.

| # | Förutsättningar | Handling | Förväntat | Faktisk observation | Status |
| --- | --- | --- | --- | --- | --- |
| K1 | Formuläret öppet | Tryck i `Firearm name`, sedan i `Calibre` | Fältet med fokus syns helt. `Create session` går att skrolla fram. | – | Ej genomförd |
| K2 | Formuläret öppet | Tryck i `Distance (m)` | Fältet syns helt. Tangentbordet har komma eller punkt. `Create session` går att skrolla fram. | – | Ej genomförd |
| K3 | Formuläret öppet | Tryck i `Shots per round` | Fältet syns helt. `Create session` går att skrolla fram. | – | Ej genomförd |
| K4 | Formuläret öppet | Gå genom alla fält med returtangenten och stäng sedan tangentbordet | Varje fält med fokus syns. Inget extra tomrum efter att tangentbordet stängts. | – | Ej genomförd |
| K5 | Formuläret öppet, med ogiltiga värden (till exempel `0` i `Shots per round`) | Tryck `Create session` medan tangentbordet är öppet | Bannern och fältfelen syns eller går att skrolla fram. Fokus hamnar i det första ogiltiga fältet, och det syns ovanför tangentbordet. | – | Ej genomförd |
| K6 | Största teckenstorlek och största skärmzoom | Upprepa K3–K5 | Etiketter och fel radbryts och klipps inte. Fältet med fokus och `Create session` går att nå. | – | Ej genomförd |
| K7 | TalkBack på | Med tangentbordet öppet: gå mellan fälten och till `Create session` | Etikett, värde och fel läses upp. `Create session` går att nå och aktivera. | – | Ej genomförd |
| K8 | TalkBack på, tangentbordet stängt | Gå genom hela formuläret och typraderna. Ändra ett fält, tryck `Back` och gå genom dialogen `Discard`. | `Back` läses som knapp. Typraderna läses som valda eller inte valda. Fel läses upp. Fokus hamnar i dialogens rubrik, och `Keep editing` kommer först. | – | Ej genomförd |

### A4. Navigering och plattform på Android

| # | Förutsättningar | Handling | Förväntat | Faktisk observation | Status |
| --- | --- | --- | --- | --- | --- |
| N1 | Formuläret med ändrade värden | Tryck Androids bakåtknapp. Tryck sedan bakåtknappen igen med dialogen öppen. | Dialogen `Discard` visas. Bakåt med dialogen öppen ger `Keep editing`, och formuläret är oförändrat. | – | Ej genomförd |
| N2 | – | Bakåtknappen under långsam sparning eller sparfel | Dialog 7.5, och bakåt i dialogen ger `Keep trying` | – | **Ej genomförd – kräver testverktyget** (körs med F4 och F5) |
| N3 | Appen stängd | Starta appen och växla mellan listan och formuläret | Mörk bakgrund utan vit blinkning, läsbart navigationsfält och ljust statusfält (`docs/design/ui-ux.md` §11) | – | Ej genomförd |
| N4 | – | Flygplansläge | Flyttad till del B (B0, N4), så att inga testposter hamnar bland de vanliga sessionerna | – | Se B0 |

## Del B: kontroller som kräver testverktyget

**Grunden för testverktyget finns från 7b** (B0). Persistenskontrollerna (B1) och felflödena (B2) byggs i 7c–7e. Kontrollerna körs bara mot de två tillåtna testdatabaserna, `target-practice-device-check.db` och `target-practice-ui-check.db`, och bara i utvecklingsläge. Den vanliga databasen ändras inte. Fingeravtrycket (P0/P18) är en extra kontroll.

### B0. Grunden för testverktyget och testläget (7b)

Kräver en utvecklingsversion i Expo Go (`npx expo start`). Länken `Developer checks` finns längst ner i listan.

| # | Förutsättningar | Handling | Förväntat | Faktisk observation | Status |
| --- | --- | --- | --- | --- | --- |
| T1 | Normalläge, listan visas | Skrolla till slutet av listan. Tryck `Developer checks` och sedan `Back`. | Länken finns i alla listtillstånd. Verktyget visar `Normal database is open. These are your sessions.` `Back` går tillbaka till listan. | Länken fungerade (ägaren). | Godkänd (rapporterad), 2026-10-27 |
| T2 | Normalläge | Tryck `Use UI check database`. Öppna sedan `New session` och verktyget. | Kort laddning, sedan listan med tomt läge. Bannern `Test mode` syns överst på listan, formuläret och verktyget. Notera om det finns ett extra tomrum mellan bannern och skärmens rubrik. TalkBack läser upp bannern. | Banner, avstånd och åtkomliga knappar OK **med tangentbordet stängt** (ägaren). Gäller inte formuläret med tangentbordet öppet, se fyndet nedan. | Godkänd (rapporterad), 2026-10-27 |
| T3 | Testläge från T2 | Skapa en session med ett namn som börjar med `UI check`. Tryck `Return to normal database`. | Testsessionen visas i testläget. Efter återgången saknas bannern, och listan visar dina vanliga sessioner som före T2, utan testsessionen. | Testdata syntes bara i testläge. Vanliga sessioner: 2 före och 2 efter (ägaren). | Godkänd (rapporterad), 2026-10-27 |
| T4 | Normalläge efter T3 | Tryck `Use UI check database` igen | Testsessionen från T3 finns kvar i testläget. Det visar att testdatabasen stängdes och öppnades igen. | Testdata fanns kvar efter lägesbyte (ägaren). | Godkänd (rapporterad), 2026-10-27 |
| T5 | Testläge | Avsluta Expo Go helt (som i M5) och starta projektet igen | Appen startar i normalläge utan banner och med dina vanliga sessioner | Normalläge efter fullständig omstart (ägaren). | Godkänd (rapporterad), 2026-10-27 |
| T6 | Normalläge | Tryck `Delete UI check database`. Växla sedan till testläge. | `UI check database deleted.` I testläge är listan tom igen. I testläge är raderingsknappen inaktiverad, med förklarande text. | Testdatabasen raderades och var tom vid återöppning (ägaren). | Godkänd (rapporterad), 2026-10-27 |
| T7 | – | Bytet under en pågående sparning | Knappen är inaktiverad med `A save is in progress…` | – | Väntar på 7e (fördröjning). Inget krav före 7c. Körs med F9b. |
| N4 | Appen redan laddad i Expo Go via Metro. Testläge (T2). | Slå på flygplansläge. Skapa en session med ett namn som börjar med `UI check`, läs listan och växla mellan listan och formuläret. **Ladda inte om och starta inte om appen.** Slå av flygplansläget och tryck `Return to normal database`. | Appens lokala funktioner fungerar som vanligt: sparning, lista och navigering. Efter återgången visas dina vanliga sessioner utan testsessionen. | Skapa och läsa utan nätverk fungerade med appen redan laddad (ägaren). Inget anges om meddelanden från Expo Go. | Godkänd (rapporterad), 2026-10-27 |

**Fynd under B0 (2026-10-27, ägaren): tangentbordet döljer formulärets nedersta fält i testläge.**
- Rättningen i `840e8c7` fungerar fortfarande i det testade flödet i normalläge, men motsvarande beteende fungerar inte i testläge.
- T2 är godkänd för banner, avstånd och knappar med tangentbordet **stängt**. Det innebär inte att formuläret fungerar med tangentbordet öppet i testläge.
- Analysen finns i [`docs/bugs/keyboard-covers-lower-form-fields.md`](../bugs/keyboard-covers-lower-form-fields.md), avsnittet "Ny observation i testläge".
- **Åtgärdat** med den dynamiska offseten efter experiment E2. Det är visuellt verifierat av ägaren i normalläge, testläge och efter återgång, 2026-10-27. Nya mätvärden är inte rapporterade, och andra plattformar är overifierade. Sluttestet utan diagnostik var OK på alla fem punkterna (2026-10-27). Det gäller bara `Planned rounds` och `Create session` i normalläge, i testläge och efter återgång, samt en sparad session i normalläge.

**N4 och Metro:**
- Appen själv använder inget nätverk.
- **Expo Go behöver Metro** för att ladda eller ladda om JavaScript-bundlen och för Fast Refresh. En omladdning eller omstart i flygplansläge kan därför misslyckas i Expo Go. Det är inte ett fel i appen och räknas inte i N4.
- Om det ändå händer: notera det, slå av flygplansläget och starta om.
- Funktion offline efter en kall start kan bara verifieras i en fristående build (X1).

**Overifierat, kan inte verifieras i Expo Go:** att länken och verktyget saknas i en release-build. Det täcks bara av automatiska tester (`isDevelopment: false`).

### B1. Persistens mot riktig SQLite (P)

Alla kontroller körs mot `target-practice-device-check.db` på en egen anslutning. Detaljerna står i planen, §3.2.

| # | Förutsättningar | Handling | Förväntat | Faktisk observation | Status |
| --- | --- | --- | --- | --- | --- |
| P0 | Vanligt läge | Läs den vanliga databasens fingeravtryck: antal, högsta `rowid` och `user_version` | Värdena visas, och inget skrivs | – | Ej genomförd – kräver testverktyget |
| P1 | Testdatabasen saknas | Öppna och migrera | `user_version = 1`, `wal`, nio kolumner och indexet | – | Ej genomförd – kräver testverktyget |
| P2 | Efter P1 | Migrera igen | Schema och version oförändrade | – | Ej genomförd – kräver testverktyget |
| P3 | Testfil med `user_version = 99` | Öppna och migrera | `DatabaseVersionTooNewError`. Filen har fortfarande version 99, inte `wal` och inga tabeller. | – | Ej genomförd – kräver testverktyget |
| P4 | Ny testfil | Migrera med en extra trasig migration 2 | `MigrationFailedError` (2). Versionen är 1, och den halvt skapade tabellen saknas. | – | Ej genomförd – kräver testverktyget |
| P5 | Efter P3 | Radera testfilen | Raderingen lyckas, vilket visar att anslutningen stängdes | – | Ej genomförd – kräver testverktyget |
| P6 | Efter P1 | Spara ett namn med citattecken och SQL-tecken | Läses tillbaka ordagrant. Tabellen finns kvar. | – | Ej genomförd – kräver testverktyget |
| P7 | Efter P1 | Rå insättning med en otillåten vapentyp | Avvisas (`CHECK`) | – | Ej genomförd – kräver testverktyget |
| P8 | Efter P1 | Rå insättning med text i en heltalskolumn | Avvisas (`STRICT`) | – | Ej genomförd – kräver testverktyget |
| P9 | Efter P1 | Spara samma session två gånger | `saved`, sedan `alreadySaved`. En rad. | – | Ej genomförd – kräver testverktyget |
| P10 | Efter P9 | Samma id, annan tid | `differentContent`. Raden oförändrad. | – | Ej genomförd – kräver testverktyget |
| P11 | Ogiltig rad med giltigt id | Spara med samma id | `existingRowInvalid`. Raden oförändrad. | – | Ej genomförd – kräver testverktyget |
| P11b | Efter P1, med konfliktriggern | Spara en ny session | `differentContent`. En rad med triggerns värden. Krävs innan F8 räknas som integrationstest. | – | Ej genomförd – kräver testverktyget |
| P12 | Efter P1 | Två samtidiga sparningar av samma session, sedan av två olika | En rad (`saved` och `alreadySaved`), sedan två nya rader | – | Ej genomförd – kräver testverktyget |
| P13 | Efter P1 | Distanserna 0.1, 25.5 och 999.9 | Exakt lika efter läsning | – | Ej genomförd – kräver testverktyget |
| P14 | Efter P1 | NFC-text och emoji | Oförändrade efter läsning | – | Ej genomförd – kräver testverktyget |
| P15 | – | NFD-namn genom validering, och enhetens tidszon | `é` som en kodpunkt. Tidszonen godtas. | – | Ej genomförd – kräver testverktyget |
| P16 | Efter P1 | Fem ogiltiga och två giltiga rader, sedan `listSessions` | Två sessioner och fem ogiltiga rader med rätt orsaker, utan värden | – | Ej genomförd – kräver testverktyget |
| P17 | Efter alla | Stäng och radera | Båda lyckas, och testfilen är borta | – | Ej genomförd – kräver testverktyget |
| P18 | Efter P17 | Läs den vanliga databasens fingeravtryck igen | Samma som P0. **Annars: rapportera och stoppa.** | – | Ej genomförd – kräver testverktyget |

### B2. Felflöden i UI med testdatabasen (F)

Körs i testläge mot `target-practice-ui-check.db`, med testdata vars namn börjar med `UI check`. Testläget visas med en banner på alla skärmar. Detaljerna står i planen, §4.5 och §5.

| # | Förutsättningar | Handling | Förväntat | Faktisk observation | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | Kontrollerat startfel en gång | Starta scenariot och tryck `Retry` | Felskärmen med standardtexten och bara `Retry`, som uppläses av TalkBack. Efter Retry visas listan. | – | Ej genomförd – kräver testverktyget |
| F2 | Testdatabas med `user_version = 99` (riktigt fel) | Starta scenariot och tryck `Retry` | Texten om nyare version. Retry ger samma skärm. Filen är orörd. | – | Ej genomförd – kräver testverktyget |
| F3 | Tabellen finns redan, och versionen är 0 (riktigt fel) | Starta scenariot | Standardtexten. Versionen är fortfarande 0. | – | Ej genomförd – kräver testverktyget |
| F4 | Kontrollerat sparfel en gång | `Create session`, sedan `Try saving again` | Låsta fält och sparfel. Efter Retry visas kortet. Verktyget visar `Attempt 2: same snapshot`. Även N2 kontrolleras här. | – | Ej genomförd – kräver testverktyget |
| F4b | Trigger som får insättningen att misslyckas (riktigt fel) | `Create session`, `Back` och sedan `Leave` | Osäkert sparfel, inte Konflikt eller Avvisad. Dialog 7.5. Inget nytt kort. | – | Ej genomförd – kräver testverktyget |
| F5 | Fördröjning 15 s **före** skrivning | `Create session`, vänta mer än 10 s, `Back` och sedan `Leave` | T1 efter 10 s och dialog 7.5. Kortet saknas först och dyker upp utan navigering. Även N2 kontrolleras här. | – | Ej genomförd – kräver testverktyget |
| F5b | Fördröjning 15 s **efter** skrivning, före svaret | Som F5 | Som F5, men kortet syns redan efter Leave. Inget dubblettkort. | – | Ej genomförd – kräver testverktyget |
| F6 | Fördröjning 30 s före skrivning | Som F5, sedan `New session` och fyll i | T2 visas, och `Create session` är inaktiverad tills sparningen är klar. Ingen navigering bort. | – | Ej genomförd – kräver testverktyget |
| F7 | Kontrollerad avvisning en gång | `Create session` | `Session not saved`, bara `Back to sessions` och ingen Retry | – | Ej genomförd – kräver testverktyget |
| F8 | P11b godkänd. Konfliktrigger. | `Create session` | Konfliktskärmen utan Retry. Listan visar triggerns rad. Räknas som integrationstest. | – | Ej genomförd – kräver testverktyget |
| F8c | Används bara om P11b inte går igenom. Kontrollerad konflikt. | `Create session` | Konfliktskärmen utan Retry. **Bara UI-flödet, inte ett integrationstest.** | – | Ej genomförd – kräver testverktyget |
| F9 | Fördröjning 15 s före skrivning, sedan samma följt av fel | Leave och vänta på listan | Kortet dyker upp av sig självt. Med fel laddas listan om, men inget kort tillkommer. | – | Ej genomförd – kräver testverktyget |
| F9b | Fördröjning 15 s före skrivning | Försök byta läge under sparningen och igen efteråt | Bytet är inaktiverat under sparningen och fungerar efteråt. Fingeravtrycket är oförändrat. | – | Ej genomförd – kräver testverktyget |
| F10 | Kontrollerat läsfel en gång | Starta scenariot och tryck `Try again` | `Sessions couldn't be loaded`, `Try again` och `New session`, aldrig tomt läge. Efter Try again visas listan. | – | Ej genomförd – kräver testverktyget |
| F10b | Tabellen omdöpt (riktigt fel) | Starta scenariot, återställ tabellen i verktyget och gå tillbaka | Samma banner. Efter återställningen visas listan. | – | Ej genomförd – kräver testverktyget |
| F11 | Listan laddad. Tabellen döps om i verktyget (riktigt fel). | Gå tillbaka till listan, återställ tabellen och tryck `Try again` | Korten ligger kvar med `Sessions couldn't be refreshed`. Efter Try again försvinner bannern. | – | Ej genomförd – kräver testverktyget |
| F12 | Fem ogiltiga och två giltiga rader | Starta scenariot och läs listan, även med TalkBack | Giltiga kort först, sedan fem `Unreadable session record` utan råa värden. Varje kort läses som en grupp. | – | Ej genomförd – kräver testverktyget |

## Del C: egen Android-build, andra tangentbord och iOS

Redovisas separat. Inga verktyg installeras utan ett nytt beslut.

| # | Område | Vad som ska testas | Status |
| --- | --- | --- | --- |
| X1 | Egen Android-build | Risken för dubbel anpassning av tangentbordet (H3), start, tema och persistens utanför Expo Go | **Blockerad.** Android SDK, Java och `adb` saknas och installeras inte utan beslut. |
| X2 | Andra tangentbord | K1–K5 med Gboard | **Ej genomförd.** Gboard installeras inte nu (ägarbeslut 2026-10-27). |
| X3 | iOS | Allt ovan och iOS-punkterna i steg 5 §8 | **Blockerad.** Ingen iOS-enhet. |
