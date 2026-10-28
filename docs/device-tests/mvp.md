# Enhetskontroller: MVP med rundor (Galaxy S20, Expo Go)

Samlad checklista för MVP-flödet från `implementation/mvp-plan.md`. **Ingen punkt är genomförd.** Automatiska tester verifierar inte UI på telefonen.

**Regler:**
- Fyll i resultat först när de har körts.
- Skriv inga sessionsuppgifter i rapporten.
- Kör helst i testläge (`Developer checks` → `Use UI check database`), så att testposterna inte hamnar bland de vanliga sessionerna. Kontrollerna U1 och U9 körs i normalläge.

**Förberedelse:**
1. Starta med `npx expo start` från `apps/mobile` och ladda om Expo Go helt. Det behövs eftersom två native-moduler är nya: `expo-image-picker` och `expo-file-system`.
2. Ha en utskriven tavla, eller visa den på en annan skärm.

| # | Handling | Förväntat | Resultat |
| --- | --- | --- | --- |
| U1 | Starta appen i **normalläge** med dina befintliga sessioner | Alla sessioner finns kvar (migration 2), och varje kort visar `In progress · No confirmed rounds` och en pil | Ej genomförd |
| U2 | Skapa en session och tryck på kortet | Sessionsdetaljen visar inställningar, `In progress`, `No confirmed rounds yet.` och `Start round 1` | Ej genomförd |
| U3 | Tryck `Start round 1`, och sedan snabbt en gång till | Rundskärmen öppnas en gång. `Shots fired` är det planerade antalet. Tillbaka visar `Continue round 1`. | Ej genomförd |
| U4 | Före-bild med `Take photo`. Neka kameran första gången och tillåt sedan. | Vid nekad åtkomst: en banner med förklaring, och efter "neka permanent" knappen `Open settings`. Vid tillåten åtkomst: bilden visas. | Ej genomförd |
| U5 | Efter-bild med `Choose from library`. Avbryt först, välj sedan en bild. | Ett avbrutet val ger inget fel. Bilden visas med rätt proportioner och rätt orientering, utan att vara roterad. | Ej genomförd |
| U6 | `Calibrate and mark hits`. Tryck på de fyra punkterna där yttersta ringen korsar sifferraden: topp, höger, botten, vänster. Zooma först. | Punkterna `+1`–`+4` hamnar där du trycker, utan förskjutning. Ringarna ritas ut och följer tavlans tryckta ringar ungefär. | Ej genomförd |
| U7 | `Mark hits`: tryck på tre hål. Markera ett, dra det, ändra `Shots in this hole` till 2, ta bort ett och tryck `Undo`. | Markeringarna hamnar på hålen. Drag, antal, borttagning och ångra fungerar. Poängen under bilden uppdateras direkt. | Ej genomförd |
| U8 | Nyp för att zooma, dra för att panorera, och tryck `Fit` | Zoom och panorering fungerar. Tryck efter zoom hamnar fortfarande rätt. | Ej genomförd |
| U9 | Avsluta Expo Go helt mitt i rundan och starta igen (normalläge eller testläge, beroende på var rundan startades) | Rundan går att fortsätta. Foton, kalibrering och markeringar finns kvar. | Ej genomförd |
| U10 | Tillbaka på rundskärmen: ändra `Declared misses` och `Unresolved shots` så att det går ihop, och tryck `Confirm round` två gånger snabbt | Rundan bekräftas en gång. Detaljen visar poäng, eller `Subtotal …, incomplete` om det finns oklara skott. Demo-noteringen visas. | Ej genomförd |
| U11 | Öppna den bekräftade rundan | Skrivskyddad vy med poäng, träffpoäng, missar, oklara skott, foton och `Confirmed results can't be changed.` | Ej genomförd |
| U12 | Starta runda 2. Ersätt efter-bilden när markeringar finns. | Dialogen `Replace the after photo?` visas. Om du bekräftar rensas kalibrering och markeringar. | Ej genomförd |
| U13 | Försök `Finish session` medan runda 2 är ett utkast, kassera sedan runda 2 och avsluta | `Finish session` är spärrad med förklaring. Efter `Discard round` och `Finish session` visar listan `Finished · 1 round · … points`. | Ej genomförd |
| U14 | (Utvecklingsläge) `Add demo suggestions` på en kalibrerad runda | Tre förslag med texten `Demo suggestions … not analysis of your photo`. Ett förslag är streckat med `?`. Om du kör igen visas dialogen `Replace the current suggestions?`. | Ej genomförd |
| U15 | Flygplansläge med appen redan laddad: hela U2–U10 | Allt fungerar lokalt. Analys är inte konfigurerad och visar inget nätverksfel. | Ej genomförd |
| U16 | TalkBack: sessionskort, rundrader, steppers (svep upp och ner), `Confirm round` | Korten läses som knappar. Steppers kan justeras. Dialogerna läses upp. Editorns bildyta är inte tillgänglig för TalkBack, vilket är en känd begränsning. | Ej genomförd |
| U17 | Största systemtext på sessionsdetaljen och rundskärmen | Texterna radbryts och knapparna går att nå | Ej genomförd |

**Overifierat även efter checklistan:**
- liveanalys (ingen tjänst finns)
- riktig poäng (tavlan är inte verifierad)
- egen Android-build
- iOS
- att Android dödar aktiviteten under kameran (`getPendingResultAsync` hanteras inte).
