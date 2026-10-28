# Återställning av foton och utkast: vad som stöds

Status 2026-10-28. **Ingen återställning är verifierad på S20.** Det som är verifierat är logiken i automatiska tester (`pendingPickRecovery.test.ts`, `sqlitePhotos.test.ts` och `sqlitePhotoCleanup.test.ts`).

## Vad appen gör

1. **Innan kameran eller bildväljaren öppnas** sparas en post i databasen (`pending_photo_picks`) med vilken runda och roll bilden gäller. När väljaren svarar medan appen lever tas posten bort, oavsett utfall.
2. **Varje gång appens skärmar startar** läser `PhotoRecovery` posten. Det sker vid kallstart, och när databasen öppnas igen efter ett byte av läge.
   - **Ingen post:** ingenting händer.
   - **En post finns:** appen frågar `expo-image-picker` efter ett kvarhållet resultat (`getPendingResultAsync`).
     - **Om det finns en bild** sparas den till rundan och rollen i posten, och rundan öppnas.
     - **Om rundan inte längre är ett utkast** sparas inget.
     - **Om det inte finns något resultat** visar appen att valet avbröts och ber dig ta eller välja bilden igen. Inget gissas.
   - Posten tas bort i alla fall, så samma bild sparas aldrig två gånger av återställningen.
3. **Varje fil skrivs in i journalen `photo_files`** innan den skrivs till disk. Städningen vid start raderar bara filer som:
   - finns i journalen
   - är äldre än 10 minuter enligt journalens egen tid
   - inte har någon rad som pekar på dem, kontrollerat precis före varje radering.

   Filer som inte står i journalen rörs aldrig.

## Vilka fall som stöds

| Fall | Vad som händer | Status |
| --- | --- | --- |
| Väljaren svarar medan appen lever (det normala) | Bilden sparas direkt och posten tas bort | Ingick i grundflödet som du rapporterade som fungerande. Den nya versionen (rättvänd kopia, journal) är inte provad. |
| **Androids aktivitet förstörs men processen lever**, till exempel "Don't keep activities" | `expo-image-picker` håller resultatet **i minnet** och lämnar ut det via `getPendingResultAsync`. Appen sparar bilden när skärmarna startar om. | Stöds i koden. **Overifierat.** Det är också overifierat om Expo Go startar om appens skärmar när aktiviteten återskapas. Om de inte gör det körs återställningen först vid nästa kallstart, och då finns resultatet bara kvar om processen fortfarande lever. |
| **Hela processen avslutas** medan väljaren är öppen (minnesbrist, gräns för bakgrundsprocesser) | Resultatet i minnet försvinner med processen. Om Android återskapar aktiviteten och lämnar resultatet till den nya processen kan bilden räddas. Annars visar appen att valet avbröts. | Bilden **lovas inte**. Utkastet, de andra bilderna och markeringarna finns kvar, eftersom de sparas direkt. **Overifierat.** |
| Du sveper bort appen eller tvångsstoppar den medan väljaren är öppen | Inget resultat. Vid nästa start visas att valet avbröts. | Bilden räddas inte. Utkastet finns kvar. **Overifierat.** |
| Appen avslutas mitt i sparandet, efter att bilden kommit tillbaka | Kopior utan rad ligger kvar och städas bort efter 10 minuter vid en senare start. Rundan har kvar sin tidigare bild eller ingen. | Stöds i koden och är testat mot SQLite. **Overifierat på enhet.** |
| iOS | `getPendingResultAsync` ger alltid null. En kvarlämnad post ger beskedet att valet avbröts. | Overifierat. iOS är inte prioriterat. |

## Utkast i övrigt

Antal skott, missar, diameter, kalibrering och markeringar skrivs till SQLite vid varje ändring. De finns kvar efter att appen avslutas, oavsett hur det sker. Det gäller inte en ändring som pågår precis när processen dör.

## Testa senare

Vänta med dessa tills grundflödet är provat. Ordningen nedan går från vanligast till ovanligast.
1. Utvecklaralternativ → **Don't keep activities** → ta en bild (fall 2).
2. Utvecklaralternativ → **Gräns för bakgrundsprocesser: inga** → ta en bild (ungefär fall 3).
3. Svep bort appen medan kameran är öppen (fall 4).
