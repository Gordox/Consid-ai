# Enhetskontroller: MVP med UI v2.1 (Galaxy S20, Expo Go)

Checklista för hela flödet efter omdesignen UI/UX v2.1 (`implementation/ui-ux-v2.md`).

**Läge 2026-10-28:**
- Grundflödet fungerade på S20 före fas 2 och före omdesignen, enligt din rapport.
- Ingen punkt nedan är genomförd eller godkänd. Den nya UI:n har inte körts på någon telefon.
- Automatiska tester och Android-exporten verifierar inte UI på telefonen.

**Regler:**
- Fyll i resultat först när de har körts.
- Skriv inga sessionsuppgifter eller bilder i rapporten.
- **Developer checks och testläget finns inte längre.** Appen öppnar alltid den vanliga databasen. Steg som skapar sessioner eller rundor (G2–G5, V1–V4) **skapar riktiga lokala sessioner** bland dina egna. Använd ett tydligt vapennamn, till exempel "Test UI", om du vill känna igen dem. Det finns ingen raderingsfunktion för sessioner.
- Gamla testdatabaser och bildmappen `photos-ui-check` på telefonen raderas inte och visas inte i appen.

**Förberedelse:**
1. **Starta appen.** I `apps/mobile`: `npm ci` och `npx expo start`. Ladda om Expo Go helt.
2. **Starta servern** (behövs för G4). Se startguiden i `services/analysis/README.md`.
3. **Ha en riktig tavla** med klistermärken till hands.

## Först: grundflödet (G1–G5)

| # | Handling | Förväntat | Resultat |
| --- | --- | --- | --- |
| G1 | Starta appen med dina befintliga sessioner. Pröva filtren **All / In progress / Finished**. Leta efter `Developer checks` och testbannern. | Allt finns kvar. Korten visar status, rundor och poäng med `demo pts`. Filtren visar rätt sessioner, och oläsbara poster (om några) syns i alla filter. Ingen `Developer checks`-länk och ingen testbanner finns. | Ej genomförd |
| G2 | **Skapar en riktig session.** `New session`: lämna fälten tomma och tryck `Create session`, fyll sedan i. Välj typ i bladet och prova `Cancel` en gång. Starta runda 1. | Fel visas först efter första försöket, och fokus hamnar på första felet. `Cancel` behåller tidigare val. Rundan börjar med `Actual shots` = planerat och `Hole diameter` märkt `Assumed`; `Use this diameter` ändrar till `Set by you`. | Ej genomförd |
| G3 | `Add photos`: före- och efterbild med `Camera` i porträttläge, och en ur `Library`. Avbryt kameran en gång. `Align target`: placera de fyra punkterna, dra innan du lyfter. | Avbrott behåller befintlig bild. Bilderna är rättvända. Förstoraren syns bort från fingret och inom bilden, och punkten hamnar under hårkorset. Ringarna ritas över tavlan. `Continue` leder till analysvalet. | Ej genomförd |
| G4 | `Analyse photos`. Öppna `Review hits`. Använd `Select and pan`, zooma och panorera, välj ett förslag och `Accept`, ta bort ett annat, lägg till en träff med `Add hits`, flytta en träff, ångra. | Under analysen visas `Analysing photos…` utan procent, och bilderna är låsta. Förslag är streckade med `?`, accepterade numrerade. Panorering lägger aldrig till en träff. `Review round` är spärrad tills inga förslag väntar. Borttaget förslag blir ingen miss. | Ej genomförd |
| G5 | `Review round`: ange missar/oklara så att skotten går jämnt upp, bekräfta. `Start next round`, gå tillbaka, `Discard round 2`, `Finish session`. | Med oklara skott står `Confirm incomplete round` och resultatet är en delsumma. `Round confirmed` visas med `Start next round` och `Back to session`. Bakåt från den skärmen leder till sessionen. `Finish session` med ett utkast visar `Finish the draft first`. Den avslutade sessionen visar `Session complete` och demo-märkning. | Ej genomförd |

## Sedan: övrigt flöde

| # | Handling | Förväntat | Resultat |
| --- | --- | --- | --- |
| V1 | Bild i landskapsläge, och en bild ur biblioteket tagen i landskapsläge | Båda är rättvända, och tryck i editorn hamnar rätt även efter zoom och panorering | Ej genomförd |
| V2 | Ta bort före-bilden och analysera igen | `No before photo` visas, och texten om att sifferkolumnerna inte genomsöks visas före och efter analysen. Godkända markeringar och dina egna finns kvar. | Ej genomförd |
| V3 | Stoppa servern och tryck `Analyse photos` | `Couldn't reach analysis service` visas med `Try again` och `Mark hits manually`. Foton och markeringar finns kvar. | Ej genomförd |
| V4 | Neka kameraåtkomst, försök ta en bild | `No camera access` med `Open settings` (om systemet inte frågar igen) och `Use library instead`. | Ej genomförd |
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
