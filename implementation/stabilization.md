# Stabilisering av MVP:n: genomförande

Underlag: granskningen och stabiliseringsplanen (2026-10-28) samt ägarens preciseringar (2026-10-29). Utgångsläge `main` på `29cb8e8`. Inga nya produktfunktioner, inget konto, ingen synk, ingen Expo-uppgradering, ingen ändring av `foreign_keys` och ingen publik serverdrift.

## Brancher och commits (fast-forward till lokal `main`, inget pushat)

| Branch | Commit | Fynd |
| --- | --- | --- |
| `fix/draft-revision-migration` | `20a0f88` | Migration 8 (förutsättning) |
| `fix/analysis-run-consistency` | `6116f18` | G-01, G-06 |
| `fix/navigation-and-photos` | `253f5ae` | G-03, G-08, G-09, G-11, sena fotoresultat, kassering (G-17) |
| `fix/stale-suggestions` | `cb2dc39` | G-04 |
| `fix/diameter-and-history` | `0a90627` | G-05, G-07, spårbarhet (G-17) |
| `fix/editor-scroll-lock` | `c62c14f` | G-10 |
| `docs/stabilization` | denna dokumentation | G-13, K6–K8 |

## Schema

Migration 8 lägger bara till kolumner:

| Kolumn | Syfte | Befintliga rader |
| --- | --- | --- |
| `rounds.draft_revision` | Optimistisk samtidighetskontroll | 0 |
| `analysis_attempts.calibration_json` | Kalibreringen som försöket skickades med | NULL ("inte registrerad") |
| `round_marks.attempt_id` | Försöket ett förslag kom ifrån | NULL (aldrig ifyllt i efterhand) |
| `pending_photo_picks.draft_revision` | Revisionen bildvalet utgick från | NULL |

Migration 1–7 är oförändrade och fästa med fingeravtryck i `migrationSchema.test.ts`. Ett test kör schema 7 → 8 med sessioner, ett utkast, en bekräftad runda, markeringar, försök och en väntande bildpost, och visar att alla befintliga värden är oförändrade (även en diameter med tre decimaler). Ett annat test kör en runda bekräftad på schema 3 genom hela kedjan till schema 8. Inga historiska poäng skrivs om.

## Vad som är åtgärdat

- **G-01 och G-06: analys, redigering och bekräftelse.**
  - En analys körs i ett register som hör till databasanslutningen. Status och Cancel finns kvar när rundan lämnas och öppnas igen, och en körning syns tills dess utfall är sparat.
  - Analysen fortsätter vid vanlig navigering. Cancel betyder bara att appen slutar vänta; servern kan arbeta klart.
  - När anslutningen stängs avbryts körningarna, och deras sena skrivningar vägras av den stängda anslutningen. Varje ny öppning registrerar `pending`-försök utan körning som `interrupted`.
  - Alla skrivningar till ett utkast kontrollerar och räknar upp revisionen. Editorns och räknarnas sparköer stannar vid första konflikten, släpper de gamla ögonblicksbilderna och läser om rundan. Användaren får veta hur många ändringar som inte sparades. Editorn är skrivskyddad medan en analys pågår.
  - `confirmRound` bygger och validerar resultatet från DB i samma transaktion. Den kräver den granskade revisionen, vägrar om förslag väntar eller en analys körs, och registrerar övergivna försök som `interrupted`. Räknarkolumnerna skrivs från samma resultat, och en upprepad bekräftelse returnerar det sparade resultatet utan att skriva.
  - Bekräftelseskärmen bekräftar inget om en räknarsparning misslyckades eller vägrades.
- **G-03, G-11 och sena fotoresultat: navigering och bilder.**
  - En gemensam spärr gäller alla bakåtvägar i kameran och editorn. Den väntar på egen sparning, erbjuder Stay/Leave efter 8 s utan att avbryta något, frågar vid definitivt misslyckande och navigerar högst en gång.
  - Fotoskrivningar bär revisionen användaren såg. En bild som blir klar för sent ersätter aldrig en nyare bild och raderar aldrig nya markeringar. Bilder läggs aldrig till i bekräftade eller kasserade rundor, och avvisade kopior raderas.
- **G-08:** Biblioteksflödet, med väntande post och återställning, är gemensamt för rundskärmen och kameraskärmen. Nekad biblioteksbehörighet ger ett eget besked.
- **G-09:** Kamerans temporära fil raderas bara om den ligger i appens cache utanför fotomappen. Kontrollen görs segment för segment, inte som strängprefix. Filen raderas bara när kopiorna är sparade eller rundan avvisade bilden; vid osäkra fel ligger den kvar. Bibliotekets filer raderas aldrig.
- **G-04:** Förslag från en tidigare justering är genomstrukna och märkta i editorn, inspectorn och listan. Förslag utan registrerad justering säger det. Analyspanelen visar inte längre en sammanfattning eller varningar från en annan justering, och den erbjuder Analyse again. Accepterade träffar och bildpositioner ändras aldrig.
- **G-05:** Diametern skrivs in som tal: punkt eller komma, högst två decimaler, 1–30 mm, validerat i domänen. Rå text, validerat värde och sparat värde hålls isär. Add photos sparar och inväntar giltig text, och ogiltig text stoppar steget. Äldre värden med fler decimaler visas fullt ut och skrivs aldrig om.
- **G-07:** Bekräftade rundor visas utifrån sitt sparade resultat. Träffar som räknades före granskningskravet visas inte längre som `?`. Saknad härkomst står som "source not recorded".
- **G-17:** Bekräftade skott från förslag har försökets id. Manuella träffar får inget id, och algoritmversionen ligger kvar i försöket. Kassering av ett utkast har ett synkront skydd mot dubbeltryck.
- **G-10:** Skrollspärren följer antalet fingrar på bilden och släpps vid avbruten gest och när appen går i bakgrunden.
- **G-13, K6–K8:** README (återställning, kamera, analys, CI-status), `PLAN.md:449` som historik, `docs/device-tests/mvp.md` (V4-text och S-1–S-10), `docs/photo-recovery.md` (normala avbrott och processavslut, inklusive att ett avbrott under sparandet kan lämna antingen den gamla eller den nya bilden) och beslutet i `docs/decisions/2026-10-29-analysis-runs-and-draft-revisions.md`.

## Kontroller (på integrerad `main`, `c62c14f`, och på varje branch före sammanslagning)

| Kommando (`apps/mobile`) | Resultat |
| --- | --- |
| `npm run format:check` | exit 0 |
| `npm run lint` | exit 0, inga fynd |
| `npm run typecheck` | exit 0 |
| `npm test -- --runInBand` | exit 0. 66 sviter, 818 tester (före: 58 sviter, 743). Ingen varning om att Jest inte avslutas. |
| `npx expo export --platform android` / `--platform ios` | exit 0 båda, till en mapp utanför repot |
| `npx expo install --check` | **exit 1**, redovisas separat nedan |

Serverkontrollerna kördes inte: varken `services/analysis` eller `contracts/` har ändrats (bara en mening i serverns README).

**Expo-kontrollen (2026-10-29):** Åtta paket ligger en patch efter Expos lista: `expo` 58.0.20 (~58.0.21), `expo-constants` 58.0.13 (~58.0.14), `expo-file-system` 58.0.12 (~58.0.13), `expo-image-manipulator` 58.0.15 (~58.0.16), `expo-linking` 58.0.14 (~58.0.15), `expo-router` 58.0.27 (~58.0.28), `react-native` 0.88.0 (0.88.1) och `jest-expo` 58.0.12 (~58.0.13). `react-native` har tillkommit sedan granskningen dagen innan. Det beror på att Expo har släppt en ny patch, inte på någon ändring här. Det är en versionsavvikelse, ingen konstaterad inkompatibilitet. Uppgraderingen ligger kvar som en separat underhållspunkt.

## Vad testerna visar och inte visar

- Samtidighetsfallen körs mot riktig SQLite (`node:sqlite`) och appens egna repositories och sparköer, med styrda promises:
  - en editorsparning efter att en analys lagt till förslag
  - flera köade ändringar med en extern ändring emellan
  - bekräftelse vid ändrad revision, väntande förslag, pågående eller övergiven analys och upprepning
  - ett äldre foto som blir klart efter ett nyare, ett foto efter nya markeringar, och kassering eller bekräftelse under sparning
  - hela analysförsöket med registret, Cancel, sena svar och stängd anslutning.
- Utgångsspärren, diameterregeln, sökvägskontrollen och skrollspärrens logik är testade som rena funktioner.
- **Det verifierar inte native-beteende:**
  - gester och skrollspärren på Android
  - kamerans fil och cache
  - tangentbordet
  - `usePreventRemove` med iOS-gesten
  - expo-sqlite på telefonen.
- Ingen React-komponent renderas i testerna.

## Kvarstående begränsningar

- Ingenting är provat på telefon. Telefonkontrollerna är S-1–S-10 i `docs/device-tests/mvp.md`.
- Kaliberbladets Custom-fält med tangentbordet öppet (G-12) väntar på S-6. Ingen kodändring är gjord.
- Om skrollspärren hinner fram innan Androids ScrollView fångar gesten avgörs av S-8. Inget gestbibliotek är bytt.
- En konflikt i editorn kräver att användaren gör om ändringen. Ingen sammanslagning görs, med avsikt.
- När användaren lämnar kameran under sparning och väljer Leave kan bilden ändå läggas till senare. Dialogen säger det.
- Poängen är fortfarande demo. Detektionen är bara prövad på syntetiska bilder.
- Sessionsanteckningar (G-02) är ett öppet scopebeslut och är inte implementerade.

## Externa förutsättningar (oförändrade)

1. Verifierad tavelspecifikation.
2. Verkliga S20-foton med facit.
3. Källa för nominella diametrar per kaliber.
4. Acceptanströsklar för analysen.
5. Ägarens beslut om push, så att CI kan köra.
