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

## Resultat

Fylls i när arbetet är klart.
