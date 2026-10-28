# Enhetskontroller: MVP med rundor och analys (Galaxy S20, Expo Go)

Checklista för hela flödet efter fas 2 (`implementation/mvp-plan.md` §9–11).

**Läge 2026-10-28:**
- Du har rapporterat att grundflödet fungerade före fas 2.
- Ingen punkt nedan är genomförd eller godkänd.
- Automatiska tester verifierar inte UI på telefonen.

**Regler:**
- Fyll i resultat först när de har körts.
- Skriv inga sessionsuppgifter eller bilder i rapporten.
- Kör G2–G5 i testläge (`Developer checks` → `Use UI check database`). G1 körs i normalläge.

**Förberedelse:**
1. **Starta appen.** I `apps/mobile`: `npm ci` och `npx expo start`. Ladda om Expo Go helt, eftersom `expo-image-manipulator` är en ny native-modul.
2. **Starta servern** (behövs för G4). Se startguiden i `services/analysis/README.md`.
3. **Ha en riktig tavla** med klistermärken till hands.

## Först: grundflödet (G1–G5)

| # | Handling | Förväntat | Resultat |
| --- | --- | --- | --- |
| G1 | Starta i **normalläge** med dina befintliga sessioner. | Allt finns kvar efter migration 3–6. Gamla bekräftade rundor visar poäng med `(demo)`. Listan visar `Demo scores: …`. | Ej genomförd |
| G2 | Ny session → `Start round 1`. Läs `Hole diameter` och tryck `Use 9.0 mm`, eller ändra värdet. | Först står det `Assumed, not set: 9.0 mm …` med din kaliber. Efteråt står det `Set by you`. | Ej genomförd |
| G3 | Ta en före-bild och en efter-bild med kameran i porträttläge. Öppna `Calibrate and mark hits` och tryck de fyra kalibreringspunkterna. | Båda bilderna är rättvända. Det visas ingen varning om storleken. Punkterna hamnar där du trycker, och ringarna ritas över tavlan (måtten är demo). | Ej genomförd |
| G4 | Tillbaka på rundskärmen: `Analyze photos`. Öppna sedan editorn. Godkänn, ta bort och flytta förslag, och markera eventuella missade hål själv. | Under analysen står `Analysing…` och bild- och editorknapparna är låsta. Därefter står det `N suggestions added …`. Förslagen är streckade tills de godkänns. `Confirm round` är spärrad medan förslag väntar. | Ej genomförd |
| G5 | Stäm av skotten (missar och oklara skott vid behov) och tryck `Confirm round`. Starta runda 2, kassera den, tryck `Finish session` och gå till listan. | Rundan bekräftas en gång. Med oklara skott står det `Subtotal …, N unresolved shot(s) not counted`. Runda 2 får diametern från runda 1. Listan visar `Finished · Demo scores: 1 round · …`. | Ej genomförd |

## Sedan: övrigt flöde

| # | Handling | Förväntat | Resultat |
| --- | --- | --- | --- |
| V1 | Bild i landskapsläge, och en bild ur biblioteket tagen i landskapsläge | Båda är rättvända, och tryck i editorn hamnar rätt | Ej genomförd |
| V2 | Ta bort före-bilden och analysera igen | Texten om att sifferkolumnerna inte genomsöks visas före och efter analysen. Godkända markeringar och dina egna finns kvar. | Ej genomförd |
| V3 | Stoppa servern och tryck `Analyze photos` | Ett felmeddelande om nätverket visas, och knappen heter `Try analysis again`. Foton och markeringar finns kvar. | Ej genomförd |
| V4 | Flygplansläge med appen laddad: hela flödet utan analys | Allt utom analysen fungerar | Ej genomförd |
| V5 | Största systemtext på rundskärmen och i editorns panel | Texterna radbryts och knapparna går att nå | Ej genomförd |

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
