# Enhetskontroller: MVP med rundor och analys (Galaxy S20, Expo Go)

Checklista för hela flödet efter fas 2 (`implementation/mvp-plan.md` §9).

**Läge 2026-10-28:**
- Du har rapporterat att grundflödet fungerar på S20. Det gällde versionen före fas 2.
- Ingen punkt nedan är genomförd eller godkänd.
- Automatiska tester verifierar inte UI på telefonen.

**Regler:**
- Fyll i resultat först när de har körts.
- Skriv inga sessionsuppgifter eller bilder i rapporten.
- Kör i testläge (`Developer checks` → `Use UI check database`), utom V1 som körs i normalläge.

**Förberedelse:**
1. **Starta appen.** I `apps/mobile`: `npm ci` och sedan `npx expo start`. Ladda om Expo Go helt, eftersom `expo-image-manipulator` är en ny native-modul.
2. **Starta servern** (behövs för V8–V11). Följ `services/analysis/README.md`:
   - Starta den med `--host 0.0.0.0`.
   - Sätt `EXPO_PUBLIC_ANALYSIS_URL=http://<datorns-ip>:8000` i `apps/mobile/.env.local`.
   - Starta om `npx expo start`.
   - Öppna `http://<datorns-ip>:8000/health` i S20:s webbläsare. Sidan ska visa `{"status":"ok"}`.
3. **Ha en riktig tavla** med klistermärken till hands.

| # | Handling | Förväntat | Resultat |
| --- | --- | --- | --- |
| V1 | Starta i **normalläge** med dina befintliga sessioner och rundor. | Allt finns kvar efter migration 3–5. Gamla bekräftade rundor visar sin poäng med `(demo)`. Listan visar `Demo scores: …`. | Ej genomförd |
| V2 | Ny session, `Start round 1`. Titta på `Hole diameter`. | Texten `Assumed, not set: 9.0 mm …` visas tillsammans med din kaliber och knappen `Use 9.0 mm`. | Ej genomförd |
| V3 | Ta en **efter-bild med telefonen i porträttläge** och öppna editorn. | Bilden är rättvänd på rundskärmen och i editorn. Det visas ingen varning om att storleken inte stämmer. | Ej genomförd |
| V4 | Samma sak med telefonen i **landskapsläge**, och en bild ur biblioteket som är tagen i landskapsläge. | Båda är rättvända. Tryck i editorn hamnar där du trycker. | Ej genomförd |
| V5 | Kalibrera de fyra punkterna. Zooma in och kontrollera ringarna. | Punkterna hamnar rätt. De ritade ringarna följer tavlans ungefär. Måtten är demo, så de ytterst behöver inte stämma. | Ej genomförd |
| V6 | Utvecklaralternativ → `Don't keep activities` **på**. Tryck `Take photo`, ta bilden och godkänn. Stäng av alternativet efteråt. | Appen startar om, rundan öppnas och bannern `The after photo … was saved.` visas. Bilden finns på rätt plats. | Ej genomförd |
| V7 | Samma som V6, men avbryt kameran. | Bannern säger att ingen bild kom tillbaka. Ingenting ändras. | Ej genomförd |
| V8 | Runda med **före-bild** (märken på gamla hål) och efter-bild. Kalibrera och tryck `Analyze photos`. | `Analysing…` visas. Bildknapparna och `Edit hits` är låsta. Sedan kommer `N suggestions added …` och `N suggestions to review`. | Ej genomförd |
| V9 | Öppna editorn. | Förslagen är streckade. Osäkra förslag har `?`. Hur många förslag som hamnar på riktiga hål ska noteras, inte bedömas som rätt eller fel. | Ej genomförd |
| V10 | Godkänn ett förslag, ta bort ett och flytta ett. Prova `Accept N suggestions`. | Godkända och flyttade blir heldragna och räknas. Borttagna försvinner. `Confirm round` är spärrad tills inga förslag väntar. | Ej genomförd |
| V11 | Ta bort före-bilden och analysera igen, alltså med bara efter-bild. | Texten om att det är mindre pålitligt visas. Godkända och egna markeringar finns kvar, och samma hål läggs inte till igen. | Ej genomförd |
| V12 | Stoppa servern och tryck `Analyze photos`. | Ett felmeddelande om nätverket visas, och knappen heter `Try analysis again`. Foton och markeringar finns kvar. | Ej genomförd |
| V13 | Starta analys och avsluta Expo Go helt under tiden. Starta igen och öppna rundan. | Texten `The last analysis didn't finish …` visas. Ett nytt försök fungerar. | Ej genomförd |
| V14 | Ändra `Hole diameter`, ange missar och oklara skott så att det går ihop, och tryck `Confirm round` två gånger snabbt. | Rundan bekräftas en gång. Med oklara skott står det `Subtotal …, N unresolved shot(s) not counted`. Diametern visas som `(set by you)`. | Ej genomförd |
| V15 | `Start round 2`. | Diametern från runda 1 gäller och visas som `Set by you`. | Ej genomförd |
| V16 | Kassera runda 2, tryck `Finish session` och gå tillbaka till listan. | Kortet visar `Finished · Demo scores: 1 round · …`. Detaljen visar demonoteringen ovanför poängen. | Ej genomförd |
| V17 | Flygplansläge med appen laddad: hela flödet utan analys. | Allt utom analysen fungerar. Analysen ger ett tydligt felmeddelande. | Ej genomförd |
| V18 | Största systemtext på rundskärmen och i editorns panel. | Texterna radbryts och knapparna går att nå. | Ej genomförd |

**Inte verifierat ens efter checklistan:**
- **Hur bra detektionen är på riktiga foton.** Det kräver märkta bilder, se `docs/evaluation.md`.
- **Riktig poäng.** Tavlan är inte verifierad, se `docs/target-calibration.md`.
- **Egen Android-build och iOS.**
- **TalkBack i editorns bildyta**, som är en känd begränsning.
- **Städningen av övergivna kopior.** Den syns inte i UI:t. Den kan bara kontrolleras genom att jämföra lagringsutrymmet före och efter en omstart som sker mer än en timme efter ett avbrutet sparande.
