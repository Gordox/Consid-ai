# MVP-plan: från session till bekräftade rundor

> **Status (2026-10-28):** Ägarbeslut om självständigt MVP-arbete. Beslutet ersätter kraven på godkännande före varje delsteg, PR före sammanslagning, att steg 7–8 blir klara först och att vapenprofiler blir nästa funktion. Planen uppdateras efter faktiskt resultat (§8).
> **Arbetssätt:** En featurebranch per sammanhängande del. Varje del får relevanta kontroller och en granskning av diffen, committas och slås ihop med lokal `main`. Inget pushas, publiceras eller deployas.

## 1. Utgångsläge

- `main` = `d802586`, alltså steg 0–6, 7a–7b och CI (steg 8).
- **CI är verifierat i GitHub Actions.** PR #2 (`679c863`) och push till `main` (`d802586`) lyckades, med alla steg gröna. Node- och npm-versionen i Actions är inte avläst, eftersom loggarna kräver inloggning.
- **Fungerar på S20:** skapa session och sessionslistan. Se `docs/device-tests/sessions.md`.

## 2. Mål och acceptanskriterier

Användaren ska på Galaxy S20 kunna göra följande. Varje kriterium verifieras manuellt enligt checklistan i §7.

| # | Kriterium |
| --- | --- |
| A1 | Skapa en session, som i dag, och öppna den från listan. |
| A2 | **Sessionsdetaljen** visar inställningarna, status (pågående eller avslutad), rundorna och en summering (bekräftad totalsumma och om summan är ofullständig). |
| A3 | Starta en runda. Det faktiska antalet skott har det planerade antalet som standardvärde och kan ändras. Bara en runda i taget kan vara ett utkast. |
| A4 | Ta foto eller importera en bild, både före-bild (valfri) och efter-bild. Nekad åtkomst och avbrutet val ger begripliga besked. Bilderna kopieras till appens egen lagring. |
| A5 | Kalibrera efter-bilden genom att trycka på fyra referenspunkter. Tavlans ringar ritas ut över bilden som kontroll. |
| A6 | Markera, flytta och ta bort träffar, ändra träffstorlek, ångra, ange flera skott i samma hål, registrera missar och oklara skott. Poängförslaget uppdateras direkt. |
| A7 | Föreslagna träffar från analys visas som förslag, och osäkra förslag markeras. Utan konfigurerad analystjänst är flödet helt manuellt. Demoförslag finns bara i utvecklingsläge och märks som demo. |
| A8 | Bekräfta rundan. Det kräver att skotten går ihop. Med oklara skott blir rundan bekräftad men ofullständig, och delsumman visas. En bekräftad runda kan inte ändras. |
| A9 | Upprepa för nästa runda. Avsluta sessionen och se resultatet i listan och i detaljen. |
| A10 | Utkast, bilder och bekräftade resultat finns kvar efter omstart. En pågående session kan återupptas. |

## 3. Måltavlan och poäng

**Den riktiga tavlan:**
- Referensbilden i `CLAUDE.md` är en X-Targets-tavla (x-targets.at). Den har tio lika breda ringar med värdena 1–10, ett svart område för 7–10 och en inre ring i tian.
- **Fysiska mått, linjebredd, regeln för linjeträffar och tillverkarens specifikation saknas.** En produktbild är ingen kalibreringskälla (`CLAUDE.md`).
- Riktig poängräkning för tavlan är därför **inte aktiverad**.

**Demotavlan `demo-synthetic-v1`:**
- Syntetisk geometri med samma struktur: tio ringar med värdena 1–10 och radien `(11 − värde) × 10 mm`, alltså 10 mm för tian och 100 mm för ettan.
- Ingen inre ring.
- Den märks som **Demo target** överallt där poäng visas: "Scores use synthetic demo geometry and are not valid for your real target".

**Det som behövs för att aktivera den riktiga tavlan:**
1. ytterradien för varje poängzon i millimeter, eller ett tillverkardokument med motsvarande värden
2. hur tryckta linjer räknas (linjens bredd, och om ytterkanten eller mitten är gränsen)
3. om den inre ringen påverkar poängen
4. tavlans fysiska storlek
5. källan till nominell träffdiameter per kaliber (öppen fråga 3 i `CLAUDE.md`).

**Koordinatkontrakt:**

| System | Definition |
| --- | --- |
| Bild | Pixlar i efter-bildens lagrade fil. Origo uppe till vänster, x åt höger och y nedåt. Bredd och höjd kommer från bildväljaren. |
| Tavla | Millimeter i tavlans plan. Origo i centrum, x åt höger och y nedåt. |
| Skärm | Bildpixlar × skala × zoom + panorering. Bara i editorn, aldrig lagrat. |

- **Kalibrering:** Användaren trycker där den yttersta poängringen korsar sifferaxlarna, i ordningen överst, höger, nederst och vänster. Punkterna motsvarar `(0, −R)`, `(R, 0)`, `(0, R)` och `(−R, 0)`, där R är tavlans kalibreringsradie.
- **Homografi:** De fyra punkterna ger en homografi från bild till tavla. Den hanterar perspektiv, och bildens skala används aldrig som mått.
- **Kontroll:** En kalibrering som ger en icke-konvex fyrhörning eller en degenererad lösning avvisas.

**Poängregeln `contact-highest-v1`:**
- Ett skott med centrumavståndet `d` och träffdiametern `D` berör zonen med ytterradien `R` när `d − D/2 ≤ R + ε`.
- Det högsta värde som berörs gäller. Om ingen zon berörs blir värdet 0 ("outside rings").
- `ε = 1e-9 mm` hanterar bara flyttalsbrus och är ingen poängtolerans.

**Träffdiametern:**
- Den anges per runda i millimeter (1–30) och kan ändras.
- Standardvärdet är 9,0 mm. Det är en **antagen demosiffra**, och kaliberetiketten ger ingen diameter.

## 4. Data

**Migration 2**, som bara lägger till (migration 1 ändras inte):
- `sessions.finished_at_utc`, som får vara NULL: NULL betyder pågående, och en tid betyder avslutad.
- `rounds`:
  - id, session, löpnummer (unikt per session), state (`draft` eller `confirmed`)
  - faktiskt antal skott, deklarerade missar, oklara skott
  - tavla, träffdiameter, kalibrering (JSON som valideras vid läsning)
  - tider
  - `confirmed_json`: den fasta ögonblicksbilden vid bekräftelse.
- `round_photos`: rundan, rollen (`before` eller `after`), filnamnet i appens lagring, bredd, höjd och tid.
- `round_marks`: id, rundan, bildkoordinater, antal skott i samma hål, källan (`manual`, `suggested` eller `suggestedEdited`), osäkerhet och förslagets id.
- `analysis_attempts`: id, rundan, status, källan (`service` eller `demo`), algoritmversionen, felkoden och förslagen (JSON).

**Regler:**
- **Bekräftade rundor ändras aldrig.** Alla skrivningar kräver `state = 'draft'`.
- Poängen sparas i ögonblicksbilden tillsammans med tavlans och regelns version. Inget räknas om i efterhand.
- **Bildfiler:**
  - Filen kopieras först, och raden skrivs efteråt.
  - Om skrivningen misslyckas raderas kopian.
  - När en bild ersätts raderas den gamla kopian efter att raden har skrivits.
  - Originalet i telefonens bibliotek rörs aldrig.

## 5. Bildanalys

- **Kontrakt:** `contracts/analysis.openapi.yaml`. App-klienten finns i `src/services/analysis/`.
  - Begäran skickas som multipart med `roundId`, `attemptId`, `mode`, `targetId`, efter-bild och valfri före-bild.
  - Svaret har status, algoritmversion, bildens storlek, förslag med bildkoordinater och konfidens 0–1, samt varningar.
  - Svaret valideras vid körning.
  - Felen klassas som `notConfigured`, `network`, `timeout`, `rejected`, `serverError` och `invalidResponse`, och sena svar ignoreras (`stale`).
- **Konfiguration:** `EXPO_PUBLIC_ANALYSIS_URL`. Det är bara en adress, ingen hemlighet. Utan den är analysen avstängd och flödet manuellt.
- **Ingen tjänst och ingen server byggs.** `CLAUDE.md` säger att foton inte får skickas till en tjänst förrän ägaren har valt den, och ingen tjänst är vald. Det är en verklig extern blockerare.
- **Demoförslag:**
  - De finns bara i utvecklingsläge (`__DEV__`).
  - De sparas med källan `demo` och märks överallt som "Demo suggestions – not real analysis".
  - De placeras i tavlans koordinater och omvandlas till bilden via kalibreringen.

## 6. Delar (en branch per del)

| Branch | Innehåll |
| --- | --- |
| `feature/mvp-domain` | Planen, tavlan, homografin, poängregeln, skottredovisningen och rundans regler, med tester |
| `feature/mvp-persistence` | Migration 2, repository för rundor, bildlagring (`expo-file-system`) och test med fake |
| `feature/mvp-rounds-ui` | Sessionsdetalj, klickbara kort, rundskärm, foto och import (`expo-image-picker`) samt avslutad session |
| `feature/mvp-editor` | Kalibrering, träffeditor, zoom och panorering, ångra och bekräftelse |
| `feature/mvp-analysis` | Kontrakt, klient, validering, demoförslag och analysförsök |
| `feature/mvp-docs` | README, PLAN, S20-checklistan och slutstatus |

**Nya direkta beroenden** (bara versioner från SDK 58:s `bundledNativeModules.json`, båda finns i Expo Go):
- `expo-image-picker ~58.0.10`: kamera och bildbibliotek med hantering av behörigheter i en modul.
- `expo-file-system ~58.0.12`: kopiering till appens beständiga lagring, kontroll av att en fil finns och radering av egna kopior.

`expo-camera` behövs inte, eftersom systemkameran via bildväljaren räcker för stillbilder. Inga gestbibliotek används. Zoom och panorering byggs med React Natives `PanResponder` och knappar.

## 7. Verifiering

Automatiskt (Jest):
- homografin
- poänggränserna med beröring
- skottredovisningen
- validering av rader och analyssvar
- klientens felklassning
- repository med fake
- editorns reducer och ångra.

Det verifierar **inte** UI på telefonen. S20-checklistan finns i `docs/device-tests/mvp.md`.

## 8. Resultat (2026-10-28)

**Integrerat i lokal `main`** (fast-forward per branch, inget pushat):

| Branch | Commit | Innehåll |
| --- | --- | --- |
| `feature/mvp-domain` | `0de867d` | Plan, demotavla, homografi, poängregel och skottredovisning |
| `feature/mvp-persistence` | `898b6ec` | Migration 2, rund-repository och bildlagring (`expo-file-system`) |
| `feature/mvp-rounds-ui` | `f203e38` | Sessionsdetalj, klickbara kort, rundskärm, foton (`expo-image-picker`) och avslut |
| `feature/mvp-editor` | `efb086c` | Kalibrering, editor, zoom och panorering, ångra |
| `feature/mvp-analysis` | `5341236` | OpenAPI-kontrakt, klient, validering, analysförsök och demoförslag |
| `fix/editor-touch-origin` | `9a2bb9e` | Beröringar mäts i samma koordinatsystem som duken |
| `feature/mvp-docs` | se git log | README, `.env.example`, checklistan och den här statusen |

**Kontroller per del:**
- `format:check`, `lint`, `typecheck` och `npm test -- --runInBand` gav exit 0. Totalt 40 sviter och 611 tester.
- När beroenden lades till kördes även `npx expo install --check` ("Dependencies are up to date") och `npx expo-doctor` (20 av 20).
- `npx expo export --platform android` gick igenom för varje del.
- Release-bundlen innehåller inte demoknappen, eftersom `__DEV__`-koden tas bort i produktionsbygget.

**Kriterierna A1–A10:** Allt är implementerat. Det är **inte verifierat på S20**, och ingen punkt i `docs/device-tests/mvp.md` är körd.

**Avvikelser och val:**
- **Zoom:** Den görs med `PanResponder` (nyp, drag och knappar) i stället för gestbibliotek, så att inga nya beroenden behövs.
- **Hålets diameter** ändras på rundskärmen, inte i editorn. Annars skulle två skärmar ändra samma värde samtidigt.
- **Ångra** finns bara så länge editorn är öppen. Varje ändring sparas direkt.
- **`useFocusLoad`:** En liten gemensam hook för att läsa data vid fokus, som används av tre skärmar.
- **Främmande nycklar** är deklarerade, men `PRAGMA foreign_keys` aktiveras inte. Transaktioner körs på en egen anslutning där pragman inte gäller. Repositoryt kontrollerar därför sambanden själv.

**Externa blockerare:**
1. **Verifierad specifikation för tavlan** (§3). Utan den är all poäng demopoäng.
2. **Val av analystjänst eller algoritm och en servermiljö.** `CLAUDE.md` förbjuder att foton skickas innan ägaren har valt tjänst. Därför finns ingen server.
3. **Körning på S20.**

**Kända begränsningar:**
- Editorns bildyta går inte att använda med TalkBack. Missar och oklara skott går att registrera utan den.
- `getPendingResultAsync` (Android som dödar aktiviteten under kameran) hanteras inte.
- Orienteringen kontrolleras genom att jämföra bildens proportioner. En avvikelse varnar men rättas inte.
- Fotokopior som blir kvar om appen kraschar mellan kopiering och skrivning städas inte automatiskt.
- iOS är overifierat.

## 9. Fas 2: mot en användbar MVP (2026-10-28)

**Ägarens underlag:** Grundflödet fungerar på S20. Det är inte ett godkännande av U1–U17. Nytt mandat: riktiga funktioner före dokumentation, samma arbetssätt med branch, granskning och lokal merge, inget pushat.

### 9.1 Luckor i flödet (genomgång av koden)

| # | Lucka | Följd |
| --- | --- | --- |
| L1 | Kopian är den råa filen från väljaren, med EXIF-orientering och plats. Koordinaterna antar att varje visare tillämpar orienteringen likadant, och en uppladdning skulle ta med platsdata. | Förskjutna markeringar, platsdata i analysen |
| L2 | `getPendingResultAsync` hanteras inte. | Ett foto tappas om Android avslutar appen under kameran |
| L3 | Övergivna fotokopior städas aldrig, och alla databaser delar en mapp. | Lagringen växer, och en städning skulle kunna radera testdatabasens bilder |
| L4 | Ingen analysserver finns. | Inga riktiga förslag |
| L5 | Ett sent svar kontrolleras mot senaste försöket men inte mot fotot. Ett byte av efter-bild under analysen kan ge förslag på fel bild. | Felplacerade förslag |
| L6 | Förslag räknas som träffar direkt. | Ingen skillnad mellan förslag och bekräftad träff |
| L7 | Analysstatus finns bara i minnet och försvinner när skärmen lämnas. Ett avbrutet försök syns inte. | Oklar status, inget naturligt återförsök |
| L8 | Håldiametern är tyst 9 mm för varje ny runda. | Ett antagande som inte syns |
| L9 | Summeringarna skiljer inte demopoäng från verklig poäng, och oklara skott syns inte i listan. | Demopoäng kan blandas med verkliga |
| L10 | Editorn kan öppnas medan analysen pågår, och då skriver editorn över förslagen. | Förslag som tappas |

### 9.2 Delar (en branch per del)

| Branch | Innehåll |
| --- | --- |
| `feature/photo-reliability` | L1–L3. Migration 3 (originalkopia och påbörjat bildval). Rättvänd JPEG utan metadata via `expo-image-manipulator` (SDK 58, finns i Expo Go), där den normaliserade bildens pixlar är koordinatsystemet. Återställning efter att appen avslutats. En bildmapp per databas och städning av kopior som ingen rad pekar på och som är äldre än 1 h. Tester mot riktig SQLite (`node:sqlite`). |
| `feature/analysis-server` | L4. Python, FastAPI och OpenCV i `services/analysis`. Validering av format och storlek, registrering före jämförelse, kalibreringen som valfritt underlag, kontraktet utökat med kalibrering. Tester med syntetiska bilder och riktiga HTTP-anrop. |
| `feature/analysis-review` | L5–L7 och L10. Migration 4 (försöket knyts till sina bildfiler, förslag kräver godkännande). Senaste försöket visas med återförsök. HTTP till lokalt nätverk tillåts i utvecklingsläge. Editorn låses under analysen. |
| `feature/target-and-diameter` | L8–L9. Undersökning av tavlan och en mätmall. Diameterns källa (antagen eller vald) sparas och förs vidare inom sessionen. Demopoäng och verklig poäng hålls isär i summeringarna, och oklara skott visas. |
| `feature/mvp-docs-2` | README, start av servern och nätverket till S20, S20-checklistan och resultatet. |

**Nytt beroende:** `expo-image-manipulator ~58.0.15`. Det behövs för att faktiskt rotera pixlarna och ta bort metadata. Paketet ingår inte i stacken i `CLAUDE.md` och tas med under ägarens mandat för självständigt MVP-arbete. Beslutet redovisas i slutrapporten.

## 10. Resultat av fas 2 (2026-10-28)

**Integrerat i lokal `main`** (fast-forward per branch, inget pushat):

| Branch | Commit | Innehåll |
| --- | --- | --- |
| `feature/photo-reliability` | `f15b436`, `38c269b` | Planen för fas 2 (§9), migration 3, rättvända kopior utan metadata, återställning efter att appen avslutats, en bildmapp per databas, städning, SQLite-tester |
| `feature/analysis-server` | `0850203` | `services/analysis` (FastAPI och OpenCV), kontrakt 1.1, syntetiska tester, `docs/evaluation.md` |
| `feature/analysis-review` | `96fbc0f` | Migration 4, förslag som måste godkännas, försök som knyts till bildfiler, sparad status med återförsök, LAN i utvecklingsläge |
| `feature/target-and-diameter` | `bec1aeb` | Migration 5, diameterns källa, demopoäng skilda från verklig poäng, oklara skott i summeringarna, `docs/target-calibration.md` |
| `feature/analysis-ci` | `7244d28` | Serverns kontroller i CI (`setup-python` v7.0.0 fäst på SHA) |
| `fix/analysis-status-while-running` | `84efc72` | Statusen visar pågående analys |
| `feature/mvp-docs-2` | se git log | README, S20-checklistan, utvärderingen på svenska och den här statusen |

**Kontroller på den integrerade `main`:**
- **App:** `format:check`, `lint` och `typecheck` gav exit 0. `npm test -- --runInBand` gav 46 sviter och 672 tester. `npx expo install --check` var OK, `expo-doctor` gav 20/20, och `expo export --platform android` gav 1437 moduler. `npm audit` är oförändrad: 3 high och 11 low.
- **Server:** `ruff format --check`, `ruff check` och `mypy --strict` var OK. Pytest gav 26 tester. Samma steg i en ny virtuell miljö från `requirements-lock.txt` gick igenom.
- **Riktiga HTTP-anrop mot uvicorn lokalt:**
  - Läget med före- och efter-bild gav 5 av 5 hål på 0,8 s. Läget med en bild gav 5 kandidater.
  - HEIC gav 415. Före-bild som saknades gav 400. 40 MB gav 413, både med `Content-Length` och med chunked.
  - Appens `parseAnalysisResponse` godtog serverns svar i båda lägena.
- **CI-jobbet för servern har inte körts på GitHub**, eftersom inget är pushat.

**Vad som nu är verkligt och vad som är demo:**
- **Verkligt:**
  - orientering och metadata
  - återställning och städning
  - analysserver som läser bildinnehållet med registrering
  - granskning av förslag och sena svar
  - status med återförsök
  - diameterns källa
  - separata summeringar.
- **Fortfarande demo:**
  - tavlans geometri, och därmed all poäng
  - demoförslagen i utvecklingsläge.
- **Heuristiskt och bara syntetiskt testat:** träffdetektionen.

**Avvikelser och val:**
- **Analysen kräver kalibrering** i båda lägena. Utan den kom väggen och papperets kant med i jämförelsen. Det gav 17 missade hål av 30 i läget med före- och efter-bild på syntetiska bilder.
- **Läget med en bild letar inte i sifferkolumnerna**, eftersom tryckta siffror ser ut som hål. Hål där markeras för hand.
- **HEIC tas inte emot av servern**, eftersom OpenCV inte kan avkoda formatet. Appen skickar alltid sin JPEG-kopia.
- **Servern har ingen inloggning.** Den är bara avsedd för ett betrott lokalt nätverk eller USB, och får inte exponeras eller driftsättas som den är.
- **Bilder som sparades före migration 3** kan inte analyseras förrän de tas eller väljs igen. Editorn jämför bara deras proportioner.
- **Bildkopior i testläget från före fas 2** ligger i den vanliga mappen och räknas där som övergivna. De städas efter en timme. Bara testdata berörs.

**Kvar:**
- S20-checklistan V1–V18 i `docs/device-tests/mvp.md`.
- Riktiga bilder enligt `docs/evaluation.md`.
- Tavelmåtten enligt `docs/target-calibration.md`.
- Beslut om kalibrar och håldiameter.
