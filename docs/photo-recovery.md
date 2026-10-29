# Återställning av foton och utkast: vad som stöds

Status 2026-10-29. **Ingen återställning är verifierad på S20.**

> **Ändrat i stabiliseringen (2026-10-29):** Kameran är appens egen vy (`expo-camera`). Den öppnar ingen annan aktivitet, så återställningen nedan gäller **bildbiblioteket**, både från rundskärmen och från kameraskärmens biblioteksknapp (samma flöde, `src/features/rounds/libraryPick.ts`). Posten sparar nu också vilken revision av utkastet valet utgick från: en bild som kommer tillbaka efter en omstart läggs bara till om rundan inte har ändrats sedan dess. Inget av detta är verifierat på telefon; logiken är testad mot SQLite (`sqliteLatePhotos.test.ts`, `pendingPickRecovery.test.ts`, `sqlitePhotos.test.ts`, `sqlitePhotoCleanup.test.ts`).
>
> *Historik:* I förbättringsomgång 2 gällde återställningen bara rundskärmens biblioteksknapp; kameraskärmens biblioteksval hade ingen post.

## Vad appen gör

1. **Innan bildväljaren öppnas** sparas en post i databasen (`pending_photo_picks`) med vilken runda och roll bilden gäller. När väljaren svarar medan appen lever tas posten bort, oavsett utfall.
2. **Varje gång databasen öppnas** läser `PhotoRecovery` posten (vid kallstart, eller om databasen öppnas igen).
   - **Ingen post:** ingenting händer.
   - **En post finns:** appen frågar `expo-image-picker` efter ett kvarhållet resultat (`getPendingResultAsync`).
     - **Om det finns en bild** sparas den till rundan och rollen i posten, och rundan öppnas.
     - **Om rundan inte längre är ett utkast** sparas inget.
     - **Om rundan har ändrats sedan valet började** (en annan bild, markeringar) sparas inget, och appen säger det. Bildens kopior raderas.
     - **Om det inte finns något resultat** visar appen att valet avbröts och ber dig ta eller välja bilden igen. Inget gissas.
   - Posten tas bort i alla fall, så samma bild sparas aldrig två gånger av återställningen.
3. **Varje fil skrivs in i journalen `photo_files`** innan den skrivs till disk. Städningen vid start raderar bara filer som:
   - finns i journalen
   - är äldre än 10 minuter enligt journalens egen tid
   - inte har någon rad som pekar på dem, kontrollerat precis före varje radering.

   Filer som inte står i journalen rörs aldrig.

## Vilka fall som stöds

**Normala avbrott (appen lever):**

| Fall | Vad som händer |
| --- | --- |
| Avbryter bildväljaren | Befintlig bild ligger kvar. Posten tas bort. |
| Kameran: X eller bakåt innan bilden tas | Ingenting ändras. |
| Kameran: X, Androids bakåt eller iOS-gesten medan bilden sparas | Att lämna avbryter inte sparningen. Appen väntar på den och går tillbaka en gång när den är klar. Efter 8 sekunder kan du välja **Stay** eller **Leave**; med Leave kan bilden fortfarande läggas till när sparningen blir klar. |
| Sparningen misslyckas | Inget ändras i rundan. De nya kopiorna raderas. Kamerans egen fil raderas bara om rundan avvisade bilden (ändrad, bekräftad eller kasserad); vid andra fel ligger den kvar i cachen. |
| En äldre bild blir klar efter en nyare, eller efter att du har gjort markeringar | Den äldre bilden läggs inte till och ersätter inget. Dess kopior raderas. |
| Rundan kasseras eller bekräftas medan bilden sparas | Bilden läggs inte till. Dess kopior raderas. |

**Processen avslutas:**

| Fall | Vad som händer | Status |
| --- | --- | --- |
| Androids aktivitet förstörs men processen lever, under bildbiblioteket | `expo-image-picker` lämnar ut resultatet via `getPendingResultAsync`, och appen sparar bilden när databasen öppnas, om rundan inte har ändrats. | Stöds i koden. **Overifierat.** |
| Hela processen avslutas medan bildbiblioteket är öppet | Resultatet försvinner normalt med processen. Appen säger då att valet avbröts. | Bilden **lovas inte**. Utkastet, de andra bilderna och markeringarna finns kvar. **Overifierat.** |
| Appen avslutas medan kameravyn är öppen, eller efter att bilden tagits men innan den sparats | Bilden förloras. Utkastet behåller sin tidigare bild. Kamerans fil kan ligga kvar i appens cache tills systemet rensar den. | **Overifierat.** |
| Appen avslutas mitt i sparandet | Bildraden skrivs i en enda transaktion. Om transaktionen hann committa har rundan den **nya** bilden; annars har den kvar den **gamla** (eller ingen). Kopior utan rad ligger kvar och städas efter 10 minuter vid en senare start. | Stöds i koden och är testat mot SQLite. **Overifierat på enhet.** |
| Appen avslutas under en analys | Vid nästa start registreras försöket som avbrutet (`interrupted`) och du kan försöka igen. Ett sent svar från servern kan inte längre nå appen. | Testat mot SQLite. **Overifierat på enhet.** |
| iOS | `getPendingResultAsync` ger alltid null. En kvarlämnad post ger beskedet att valet avbröts. | Overifierat. iOS är inte prioriterat. |

## Utkast i övrigt

Antal skott, missar, diameter, kalibrering och markeringar skrivs till SQLite vid varje ändring. De finns kvar efter att appen avslutas, oavsett hur det sker. Det gäller inte en ändring som pågår precis när processen dör. Om rundan har ändrats på en annan väg (till exempel nya förslag från en analys) skrivs äldre ändringar från en skärm inte över det; skärmen läser om rundan och säger hur många ändringar som inte sparades.

## Testa senare

Vänta med dessa tills grundflödet är provat. Ordningen nedan går från vanligast till ovanligast.
1. Utvecklaralternativ → **Don't keep activities** → ta en bild (fall 2).
2. Utvecklaralternativ → **Gräns för bakgrundsprocesser: inga** → ta en bild (ungefär fall 3).
3. Svep bort appen medan bildväljaren är öppen (fall 4).
4. Svep bort appen medan appens kameravy är öppen: utkastet ska finnas kvar, och ingen bild ska ha lagts till.
5. Öppna biblioteket från kameraskärmen med "Don't keep activities" på.
