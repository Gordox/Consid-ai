# Enhetskontroller: MVP med UI v2.1 (Galaxy S20, Expo Go)

Checklista för hela flödet efter omdesignen UI/UX v2.1 (`implementation/ui-ux-v2.md`).

**Läge 2026-10-29:**
- Grundflödet fungerade på S20 före fas 2 och före omdesignen, enligt din rapport.
- Ingen punkt nedan är genomförd eller godkänd. Den nya UI:n har inte körts på någon telefon.
- Automatiska tester och Android-exporten verifierar inte UI på telefonen.

**Övergripande användarkontroll 2026-10-29** (efter stabiliseringen, `main` på `0b00062`):
- Ägaren provade det manuella flödet på S20 och bedömde att det fungerar bra.
- Servern och bildanalysen provades inte.
- Det är en helhetsbedömning, inte resultat per kontroll. S-1–S-10 och raderna nedan står kvar som Ej genomförd tills enskilda resultat rapporteras.

**Regler:**
- Fyll i resultat först när de har körts.
- Skriv inga sessionsuppgifter eller bilder i rapporten.
- **Developer checks och testläget finns inte längre.** Appen öppnar alltid den vanliga databasen. Steg som skapar sessioner eller rundor (G2–G5, V1–V4) **skapar riktiga lokala sessioner** bland dina egna. Använd ett tydligt vapennamn, till exempel "Test UI", om du vill känna igen dem. Det finns ingen raderingsfunktion för sessioner.
- Gamla testdatabaser och bildmappen `photos-ui-check` på telefonen raderas inte och visas inte i appen.

**Förberedelse:**
1. **Starta appen.** I `apps/mobile`: `npm ci` och `npx expo start`. Ladda om Expo Go helt.
2. **Starta servern** (behövs för G4). Se startguiden i `services/analysis/README.md`.
3. **Ha en riktig tavla** med klistermärken till hands.

## Stabilisering (S-1–S-10)

Kör dessa på HEAD efter stabiliseringen (`implementation/stabilization.md`). **R** = skapar eller ändrar riktiga lokala data i din vanliga databas. S-1 ändrar också databasen (migration), se dess rad; S-7 är en ren läskontroll. Använd vapennamnet "Test stabilisering".

| # | Handling | Förväntat | Data | Resultat |
| --- | --- | --- | --- | --- |
| S-1 | Starta den nya versionen med dina befintliga data. Öppna listan, en bekräftad runda och ett utkast. | Allt finns kvar (migration 8 lägger bara till kolumner). Bekräftade rundor visar samma poäng som förut. | **Ändrar databasen:** första starten kör migration 8 (lägger till kolumner, ändrar inga befintliga värden). Varje start markerar dessutom kvarlämnade `pending`-analysförsök som `interrupted` och raderar journalförda bildkopior som ingen rad pekar på och som är äldre än 10 minuter. | Ej genomförd |
| S-2 | Kamera: ta en bild och tryck X direkt medan `Saving photo…` visas. Upprepa med Androids bakåtknapp. Vänta, och pröva en gång att trycka bakåt när sparningen tar lång tid. | En enda navigering tillbaka till rundan, bilden finns i rundan. Efter 8 s visas `Still saving the photo` med Stay/Leave; Stay håller dig kvar tills bilden sparats. | R | Ej genomförd |
| S-3 | `Library` från rundskärmen och från kameraskärmen. Neka biblioteksåtkomst om systemet erbjuder det. | Samma flöde. Nekad åtkomst ger ett begripligt besked. Notera om Android 13 alls frågar. | R | Ej genomförd |
| S-4 | Starta analys, gå tillbaka till sessionen, öppna rundan igen och öppna editorn. Tryck `Cancel analysis` i editorn. Analysera igen och låt den bli klar medan editorn är öppen. | Analysen visas fortfarande som pågående efter att rundan öppnats igen. Editorn är skrivskyddad med bannern `Analysis running`. När den är klar visas förslagen; inga markeringar försvinner. | R | Ej genomförd |
| S-5 | Med väntande förslag: flytta en kalibreringspunkt. | Förslagen är genomstrukna och märkta `earlier alignment`, bannern `Alignment changed` visas och analyspanelen erbjuder `Analyse again`. Accepterade träffar ligger kvar på samma ställe. | R | Ej genomförd |
| S-6 | Diameter: skriv `9,65` och tryck `Add photos`; skriv `abc` och tryck `Add photos`. Öppna kaliberbladet, tryck i Custom och skriv, med tangentbordet öppet och vid största systemtext. | `9.65` sparas och används; `abc` visar fel och stoppar. Custom-fältet och Done ska gå att nå. Om de döljs: notera det (rättning väntar på detta test). | R | Ej genomförd |
| S-7 | `Inspect hits` på den äldsta bekräftade rundan och på ett utkast; stäng med Androids bakåt. | Räknade träffar är numrerade, inte `?`. Ingenting ändras. | **Läskontroll:** skapar eller ändrar inget. | Ej genomförd |
| S-8 | Editor: nyp för att zooma, lyft ett finger och dra med det andra. Bakgrunda appen mitt i en dragning och kom tillbaka. | Sidan skrollar inte medan ett finger ligger på bilden, ingen punkt läggs till, och sidan går att skrolla igen efteråt. Om sidan skrollar ändå: notera det. | R (om en punkt flyttas) | Ej genomförd |
| S-9 | Tvångsstoppa appen under en analys och starta om. Kör sedan "Don't keep activities" med biblioteket från kameraskärmen. | `The last analysis didn't finish because the app was closed or restarted.` Rundan går att bekräfta. Bildvalet räddas eller beskrivs som avbrutet. | R | Ej genomförd |
| S-10 | Hela flödet: ny session → runda → foto → justering → manuella träffar → granska → bekräfta → nästa runda → kassera utkastet → avsluta → listan. | Kärnflödet fungerar; bekräftelsen visar samma resultat som granskningen. | R | Ej genomförd |

Ingen av kontrollerna verifierar riktig poäng eller analysprecision.

## Förbättringsomgång 2 (N1–N10)

Kör dessa efter G1–G5. N2–N10 skapar eller ändrar riktiga lokala sessioner, profiler och mallar i din vanliga databas.

| # | Handling | Förväntat | Resultat |
| --- | --- | --- | --- |
| N1 | `Profiles and templates`: skapa profilen "Test UI" och en mall med 25 m, 5 skott och tomma planerade rundor. Arkivera mallen och återställ den. | Mallen visar `Not planned`. Den arkiverade ligger under `Archived` och kan återställas. | Ej genomförd |
| N2 | `New session`: välj profil och mall, ändra kalibern för just den sessionen, skapa sessionen. Öppna sedan `New session` igen. | Fälten fylls. `Changed from … for this session only` visas. Profilen är oförändrad. Nästa formulär börjar från samma profil och mall, utan fråga om att kasta ändringar när du går tillbaka direkt. | Ej genomförd |
| N3 | Kaliber: sök `9x19`, välj `9mm Luger`. Byt till `Custom` och skriv en egen text. Öppna en gammal session med fritext. | Sökningen hittar via alias. Custom sparas som skriven. Gammal fritext visas oförändrad. Diametern ändras inte. | Ej genomförd |
| N4 | Fältparet vid normal och största systemtext. | Fälten `Shots per round` och `Planned rounds` ligger på samma höjd; vid stor text staplas de. Inget klipps. | Ej genomförd |
| N5 | `Camera` på efterbilden: neka behörighet först, tillåt sedan. Ta en bild med cirkeln runt tavlan. Gå till bakgrunden och tillbaka. | Nekad behörighet ger `Open settings` eller `Allow camera` och `Use library instead`. Överlägget syns inte i den sparade bilden. Bilden är rättvänd och hör till rätt runda. Kameran startar igen efter återkomst. | Ej genomförd |
| N6 | `Improve detection`: lägg till och ta bort en förebild. | Efterbilden är huvudhandlingen. Förebilden syns alltid när den finns och kan tas bort. | Ej genomförd |
| N7 | `Align target`: placera fyra punkter, dra punkt 2, zooma och panorera, dra igen. Byt plats på två punkter. | Punkten följer fingret under förstoraren och ringarna följer direkt. Sidan skrollar inte medan fingret är på bilden. Vid fel ordning visas förklaringen och `Use alignment` är spärrad. Undo tar tillbaka en dragning. | Ej genomförd |
| N8 | Markera två träffar, gå tillbaka till `Align target` och flytta en punkt. | Träffarna ligger kvar på samma ställe i bilden; poängen ändras. | Ej genomförd |
| N9 | `Inspect hits` på ett utkast och på en bekräftad runda. Zooma, panorera, slå av och på `Show hits`, välj en träff. Stäng med knappen och med Androids bakåtknapp. | Markeringarna följer bilden. Vald träff visar sin poäng. Ingen handling ändrar något; utkastet erbjuder `Edit hits`. | Ej genomförd |
| N10 | Ta förebilden från en helt annan vinkel så att bilderna inte kan registreras, tryck `Analyse photos` och sedan `Analyse after photo only`. | `Photos couldn't be aligned` visas med valet att analysera bara efterbilden och en förklaring av begränsningarna. | Ej genomförd |

## Först: grundflödet (G1–G5)

| # | Handling | Förväntat | Resultat |
| --- | --- | --- | --- |
| G1 | Starta appen med dina befintliga sessioner. Pröva filtren **All / In progress / Finished**. Leta efter `Developer checks` och testbannern. | Allt finns kvar. Korten visar status, rundor och poäng med `demo pts`. Filtren visar rätt sessioner, och oläsbara poster (om några) syns i alla filter. Ingen `Developer checks`-länk och ingen testbanner finns. | Ej genomförd |
| G2 | **Skapar en riktig session.** `New session`: lämna fälten tomma och tryck `Create session`, fyll sedan i. Välj typ i bladet och prova `Cancel` en gång. Starta runda 1. | Fel visas först efter första försöket, och fokus hamnar på första felet. `Cancel` behåller tidigare val. Rundan börjar med `Actual shots` = planerat och `Hole diameter` märkt `Assumed`; `Use this diameter` ändrar till `Set by you`. | Ej genomförd |
| G3 | `Add photos`: före- och efterbild med `Camera` i porträttläge, och en ur `Library`. Avbryt kameran en gång. `Align target`: placera de fyra punkterna, dra innan du lyfter. | Avbrott behåller befintlig bild. Bilderna är rättvända. Förstoraren syns bort från fingret och inom bilden, och punkten hamnar under hårkorset. Ringarna ritas över tavlan. `Continue` leder till analysvalet. | Ej genomförd |
| G4 | `Analyse photos`. Öppna `Review hits`. Använd `Select and pan`, zooma och panorera, välj ett förslag och `Accept`, ta bort ett annat, lägg till en träff med `Add hits`, flytta en träff, ångra. | Under analysen visas `Analysing photos…` utan procent, och bilderna är låsta. Förslag är streckade med `?`, accepterade numrerade. Panorering lägger aldrig till en träff. `Review round` är spärrad tills inga förslag väntar. Borttaget förslag blir ingen miss. | Ej genomförd |
| G5 | `Review round`: ange missar/oklara så att skotten går jämnt upp, bekräfta. `Start next round`, gå tillbaka, `Discard round 2`, `Finish session`. | Med oklara skott står `Confirm incomplete round` och resultatet är en delsumma. `Round confirmed` visas med `Start next round` och `Back to session`. Bakåt (rubriken, Androids bakåtknapp) från den skärmen leder till sessionen. Dubbeltryck på `Start next round` ger en runda och öppnar den en gång. `Finish session` med ett utkast visar `Finish the draft first`. Den avslutade sessionen visar `Session complete` och demo-märkning. | Ej genomförd |

## Sedan: övrigt flöde

| # | Handling | Förväntat | Resultat |
| --- | --- | --- | --- |
| V1 | Bild i landskapsläge, och en bild ur biblioteket tagen i landskapsläge | Båda är rättvända, och tryck i editorn hamnar rätt även efter zoom och panorering | Ej genomförd |
| V2 | Ta bort före-bilden och analysera igen | `No before photo` visas, och texten om att sifferkolumnerna inte genomsöks visas före och efter analysen. Godkända markeringar och dina egna finns kvar. | Ej genomförd |
| V3 | Stoppa servern och tryck `Analyse photos`. Starta sedan servern, analysera igen och tryck `Cancel analysis` medan den pågår. | Utan server: `Couldn't reach analysis service` med `Try again` och `Mark hits manually`. Vid avbrott: `Analysis cancelled`-text, inga nya förslag dyker upp efteråt, och manuell markering fungerar. Foton och markeringar finns kvar. | Ej genomförd |
| V4 | Neka kameraåtkomst, försök ta en bild | Rubriken `Camera access`, bannern `Allow camera access`, `Allow camera` eller `Open settings` (om systemet inte frågar igen) och `Use library instead`. (Texten ändrad 2026-10-29 för att stämma med appen.) | Ej genomförd |
| V5 | Största systemtext och 320–360 dp bredd: listan, formuläret med tangentbordet öppet, rundans steg, editorns panel och dialogerna | Texter radbryts, fältparet i formuläret staplas, primärknappar går att nå med tangentbordet öppet, inget hamnar bakom statusfält eller navigationsfält | Ej genomförd |
| V6 | TalkBack: sessionskort, filter, select-sheet, markörlistan i editorn | Kort läses som en knapp med status och poängbas. Förslag går att välja och granska via listan. Att placera nya träffar kräver fortfarande touch. | Ej genomförd |

## Vänta: avancerad återställning

Vänta med dessa tills G1–G5 fungerar. Vad som stöds står i `docs/photo-recovery.md`.

| # | Handling | Förväntat enligt koden | Resultat |
| --- | --- | --- | --- |
| A1 | Utvecklaralternativ → **Don't keep activities** på. Ta en bild och godkänn. Stäng av alternativet efteråt. | Bannern `The after photo … was saved.` visas och bilden finns. Eller, om Expo Go inte startar om skärmarna: bilden saknas tills nästa start, och då står det att valet avbröts. Notera vilket som händer. | Ej genomförd |
| A2 | Samma som A1, men avbryt kameran | Bannern säger att valet avbröts. Ingenting ändras. | Ej genomförd |
| A3 | Starta en analys och avsluta Expo Go helt under tiden. Starta igen. | Texten `The last analysis didn't finish …` visas. Ett nytt försök fungerar. | Ej genomförd |
| A4 | Svep bort appen medan kameran är öppen | Vid nästa start står det att valet avbröts. Utkastet finns kvar. | Ej genomförd |

**Inte verifierat ens efter checklistan:**
- Hur bra detektionen är på riktiga foton (`docs/evaluation.md`).
- Riktig poäng (`docs/target-calibration.md`).
- Egen Android-build och iOS.
- TalkBack i editorns bildyta.
- Städningen av övergivna kopior, som inte syns i UI:t.
