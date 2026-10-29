# Beslut: pågående analys, utkastrevisioner och sena resultat

Datum: 2026-10-29. Ägaren godkände stabiliseringsplanens omfattning och preciseringar. Detta dokument beskriver de tekniska valen.

## Pågående analys

- **En analys fortsätter när användaren lämnar rundan**, så länge appens process lever. Status och Cancel finns i ett register som hör till databasanslutningen (`src/features/analysis/analysisRuns.ts`), inte i en skärm.
- **Cancel betyder bara att appen slutar vänta.** Anropet avbryts i appen och ett sent svar ignoreras. Servern kan redan ha tagit emot bilderna och kan arbeta klart.
- En körning visas som pågående tills dess utfall är sparat, inte bara tills svaret kommit. En andra start för samma runda vägras direkt.
- **Ett lagrat `pending`-försök är inget bevis på att något körs.** När databasen öppnas finns ännu ingen förfrågan på anslutningen, och en tidigare anslutnings förfrågningar kan inte längre skriva (anslutningen vägrar nya operationer när den stängs). Därför registreras alla `pending`-försök som `interrupted` vid varje öppning. Om ett `pending`-försök utan körning dyker upp medan appen kör, registrerar bekräftelsen det som `interrupted` i samma transaktion i stället för att blockera.
- Ingen SQLite-transaktion hålls öppen medan appen väntar på nätverket.

## Utkastrevisioner

- `rounds.draft_revision` räknas upp vid varje skrivning till ett utkast: räknare, kalibrering och markeringar, foton, applicerad analys och bekräftelse.
- Skärmar skickar den revision de visade. En skrivning mot en annan revision vägras (`DraftChangedError`) och ingenting skrivs.
- En skärms sparkö stannar vid första konflikten. Den och alla senare köade ögonblicksbilder släpps, eftersom de bygger på det gamla utkastet. Skärmen läser om rundan och säger hur många ändringar som inte sparades. Gamla ögonblicksbilder skrivs aldrig om med den nya revisionen.
- **Bekräftelsen** bygger och validerar resultatet från de lagrade värdena i samma transaktion. Den kräver den revision användaren granskade och vägrar om en analys körs eller om förslag väntar. Räknarkolumnerna skrivs från samma resultat som `confirmed_json`. En upprepad bekräftelse returnerar det redan sparade resultatet utan att skriva.

## Sena fotoresultat

- En fotooperation bär revisionen användaren såg när den valde att ta eller välja bilden. En bild som blir klar för sent ersätter därför aldrig en nyare bild, raderar aldrig markeringar som gjorts under tiden och läggs aldrig till i en bekräftad eller kasserad runda. Dess kopior raderas.

## Lämna en skärm

- Alla bakåtvägar (synlig Back/Close, Androids bakåt, iOS-gesten) går genom samma spärr. Pågående egen sparning inväntas. Efter 8 sekunder erbjuds Stay/Leave; tröskeln avbryter inget och navigerar inte av sig själv. Ett definitivt misslyckande frågar på samma sätt. Stay gör den tidigare begäran ogiltig, och Leave ger högst en navigering.

## Inte ändrat

- `PRAGMA foreign_keys` är fortfarande avstängd (separat fråga).
- Inga befintliga migrationer är ändrade. Migration 1–7 är fästa med fingeravtryck i testerna.
