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

## 8. Resultat

Fylls i per del.
