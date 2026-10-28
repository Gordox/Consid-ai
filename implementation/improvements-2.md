# Förbättringsomgång 2: genomförande

Ägaren har godkänt besluten i uppdraget (2026-10-28). Utgångsläget är `main` på `8e183aa`/efterföljande commit, med UI v2.1.

## Läget i koden

| Område | Nuläge | Följd |
| --- | --- | --- |
| Kalibrering | Fyra tryck, ingen redigering av placerad punkt. Sparas i `rounds.calibration_json` i efterbildens pixlar. | Punkter blir valbara och dragbara. Sparning sker när fingret lyfts, inte per pekhändelse. |
| Markeringar | `round_marks` i efterbildens pixlar; bekräftelse raderar dem inte. | En ny kalibrering flyttar inga markeringar. Poängen räknas om av `evaluateDraft`. Bekräftade rundor kan inspekteras från lagrade markeringar. |
| Sena analyssvar | `applyAnalysisResult` kräver senaste försök och samma bildfiler. | Kalibreringen som skickades jämförs också med den lagrade. |
| Editorns layout | Fast bildhöjd och en separat skrollyta under. | En skrollande sida med bildytan som gestyta, och en fast primärrad utanför skrollen. |
| Formulär | Fältparet i en rad med `flex: 1`. | Etiketter, fält och fel i separata rader, så att fälten alltid hamnar på samma höjd. |
| Foton | Före och efter visas som likvärdiga. | Efterbilden kommer först. Förebilden ligger under "Improve detection". |
| Profiler och mallar | Finns inte. | Additiv migration 7 med två tabeller. Sessionernas snapshots ändras inte. |
| Kaliber | Fritext. | Sökbar lista med Custom. Lagras fortfarande som text. |
| Kamera | Systemets kamera via `expo-image-picker`. | `expo-camera` (finns i CLAUDE.md:s stack) med ett vägledande överlägg. Biblioteket finns kvar. |

## Brancher i ordning

1. `feature/editable-calibration`: redigerbar kalibrering, ny editorlayout och kalibreringsskydd för analys.
2. `feature/hit-inspection`: skrivskyddad helskärmsinspektion.
3. `fix/design-alignment`: fältpar, efterbild först och granskningen mot designen.
4. `feature/profiles-templates`: migration 7, repositories, hantering och val i formuläret.
5. `feature/calibre-picker`: sökbar kaliberväljare.
6. `feature/camera-overlay`: kameravy med överlägg.
7. `docs/improvements-2`: dokumentation och slutrapport.

Varje branch kör formatkontroll, lint, typkontroll, Jest och Android- och iOS-export innan den slås ihop med `main` med fast-forward.

## Resultat (2026-10-28)

### Brancher och commits (fast-forward till lokal `main`)

| Branch | Commit |
| --- | --- |
| `feature/editable-calibration` | `b883bee` plan, `d1214ae` |
| `feature/hit-inspection` | `e4bde41` |
| `fix/design-alignment` | `9e68e9c` |
| `feature/profiles-templates` | `33afaad` |
| `feature/calibre-picker` | `0d8b6a3` |
| `feature/camera-overlay` | `b0fba99` |
| `docs/improvements-2` | denna dokumentation |

### Implementerat och automatiskt testat

- **Kalibrering:**
  - Domänkontroll (`calibrationCheck.ts`) av ordning och avstånd. `evaluateDraft` spärrar en korsad kalibrering.
  - Reducern har vald punkt och flytt av punkt, med en ångra-post per dragning.
  - Träffträffytan för punkter är testad efter zoom och panorering.
  - En omkalibrering räknar om poängen för samma bildposition.
  - Ett analyssvar för en äldre kalibrering avvisas. Testat mot SQLite.
- **Inspektion:** laddaren gör inga skrivanrop, vilket testas genom att räkna dem. En bekräftad runda visar sparade värden och räknar inte om dem.
- **Fältpar och efterbild:** ett försök med bara efterbilden, som användaren valt, avvisas inte, men ett försök med en utbytt förebild gör det.
- **Profiler och mallar:**
  - Migration 7 körs mot en databas med schema 6 och sessioner kvar.
  - Ändring och arkivering av profil eller mall ändrar inte sessioner.
  - Arkivering och återställning fungerar, och senast använd tar aldrig en arkiverad.
  - En onormaliserad rad räknas som oläsbar.
  - Förifyllning markerar inte formuläret som ändrat och skriver aldrig över inmatning.
  - Ändringar mot en vald profil eller mall upptäcks.
- **Kaliber:**
  - Alla namn godtas av sessionsvalideringen oförändrade.
  - Sökning fungerar på alias.
  - Fritext och alias förblir Custom.
- **Kamera:** guidens geometri är testad. Själva kameran testas inte automatiskt.
- **Dubbeltryck:** åtgärdsskydd för inspektion, kamera, start av runda, bekräftelse samt profil- och mallformulär.

### Kontroller som körts på varje branch före sammanslagning

Formatkontroll, lint, typkontroll och Jest kördes seriellt utan varning om att Jest inte avslutas, med 743 tester efter kamerabranchen. Dessutom kontrollerades att alla importerade Lucide-ikoner finns som moduler, och Android- och iOS-exporten kördes. `npx expo install --check` efter tillägget av `expo-camera`: `expo-camera` stämmer, men sju befintliga paket ligger en patchversion efter Expos senaste. Det beror inte på ändringen och uppgraderades inte (se avvikelser).

### Granskning mot designbilderna (endast i kod)

Appen kunde inte renderas här: Android SDK, simulator och `react-native-web` saknas. Jämförelsen gjordes mellan koden och PNG-filerna.

| Skärm | Rättat |
| --- | --- |
| 02 New session | Underrubrik, platshållare för vapennamn, sidfot, Optional |
| 05 Round photos | Efterbilden först, förebilden under Improve detection (produktbeslut) |
| 07 Align target | Stegindikator, underrubrik med After photo, numrerade punkter, Use alignment, Undo och Reset i en egen rad |
| 08 Analyse | Rubriken Find new hits och rundan som underrubrik |
| 09 Analysing | Avbryt och text fanns sedan tidigare; ingen procent visas |
| 19 Form error | Underrubriken Check the highlighted fields. |

Kvar som medvetna avvikelser:
- Maxpoäng visas inte.
- Diametern gäller per runda.
- Rundkorten visar ingen klocktid.
- Analysens förlopp visas som en spinner i stället för en stapel utan mått.
- Optional står efter etiketten i stället för under fältet, enligt beslutet om ett konsekvent sätt.

### Avvikelser och begränsningar

- `expo-camera` är ett nytt beroende, men det finns i stacken i CLAUDE.md. Sju befintliga Expo-paket är en patch efter och uppgraderas inte här.
- Analysen tar inte hänsyn till planerat antal skott. Saknade markeringar blir inte missar. Algoritmen och leverantören är oförändrade.
- Ett förslag från en äldre kalibrering ligger kvar som obekräftat förslag i bildens koordinater. Endast nya svar för en annan kalibrering avvisas.
- Senast använd profil och mall registreras efter sparad session med "best effort". Ett misslyckande påverkar bara nästa förval.
- Om pekursprunget mäts om under skrollning ger det rätt koordinater i teorin, men det är inte provat på telefon.

### Inte verifierat på enhet

Gester, förstoraren, skrollspärren, kameran och behörigheter, bakgrund och återkomst, tangentbordet, stor text, TalkBack och safe area. Allt detta är bara granskat i kod. Telefonkontrollerna N1–N10 finns i `docs/device-tests/mvp.md`. Demopoängen är fortfarande demo. Tavlans mått och analysens precision på riktiga foton är oprövade.
