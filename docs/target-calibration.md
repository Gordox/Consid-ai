# Måltavlan: identifiering, underlag och mätmall

Status 2026-10-28: Tavlan är **trolig men inte verifierad**. Poängen räknas på demogeometrin `demo-synthetic-v1` och märks som demo, tills punkterna i avsnitt 4 är uppmätta.

## 1. Vad som har identifierats

**Referensbilden** (`CLAUDE.md`, Amazon `71IV53NCzgL`):
- Tavlan har logotypen och adressen **www.X-Targets.at**.
- Den har tio ringar med värdena 1–10.
- Ett svart område täcker ringarna 7–10.
- Tian har en inre ring.
- Siffrorna 1–9 står på den lodräta och den vågräta axeln. Tian har ingen siffra.
- Det finns diagonala korta streck mellan ringarna 5 och 6, i 45°-riktningarna.
- Pappret ser gräddfärgat ut.
- Bildens proportioner är 1500 × 1420 px, alltså ungefär 55 : 52.

**Tillverkarens sajt:** x-targets.at har en produkt som heter *Standard Target XLS – 200 g/m² chamois, 52 x 55 cm, slitted*. Sidan anger inga ringmått och ingen standard. Den hämtades 2026-10-28.

**Standarden som layouten motsvarar:** ISSF-tavlan *25m Präzision und 50m Pistolenscheibe*, regel 6.3.4.5. Källan är ISSF:s regler, utgåva 2013 (tredje tryckningen 06/2016), sidan 241, i den tyska versionen från Österreichischer Schützenbund (zielsport.at, `Scheiben-FP.pdf`).

| Uppgift enligt ISSF 6.3.4.5 | Värde |
| --- | --- |
| Ringdiametrar 10 → 1 | 50, 100, 150, 200, 250, 300, 350, 400, 450, 500 mm |
| Toleranser | 10: ±0,2 · 9: ±0,4 · 8: ±0,5 · 7–4: ±1,0 · 3–1: ±2,0 mm |
| Innertia | 25 mm (±0,2) |
| Svart område | ringarna 7–10, 200 mm (±1,0) |
| Linjebredd | 0,2–0,5 mm |
| Synlig tavelstorlek, minst | bredd 550 mm, höjd 520–550 mm |
| Siffror | 1–9 på vågräta och lodräta axlar, cirka 10 mm höga och 1 mm breda. Tian har ingen siffra. |

**Det som talar för ISSF-måtten:**
- Ringarnas struktur och det svarta området för 7–10 stämmer.
- Innertian stämmer.
- Siffrornas placering stämmer.
- Produktens storlek, 52 × 55 cm, stämmer med ISSF:s minsta tavelstorlek.

**Varför det inte räcker:**
- Tillverkaren säger inte att tavlan följer ISSF.
- Referensbilden har diagonala streck som ISSF-bilden saknar.
- Det är inte säkert att den tavla du använder är just XLS-modellen i full storlek. Tavlor finns i flera storlekar.

Inga millimetermått har härletts från produktbildens pixlar.

## 2. Vad som redan gäller i appen

- **Poängregel `contact-highest-v1`:**
  - Ett hål som rör en gräns får det högre värdet. Det gäller i appen för alla tavlor.
  - Gränsen för en zon är dess ytterradie. Hålets kant (centrum + diameter/2) jämförs mot den.
- **Kalibreringen** görs på ytterkanten av den yttersta poängringen, där den korsar sifferaxlarna.
- **Hålets diameter** sparas per runda tillsammans med var värdet kommer ifrån:
  - *antagen* (9,0 mm som standard), eller
  - *vald av dig*. Ditt val förs vidare till nästa runda i samma session.
- **Kaliberetiketten används aldrig för att räkna fram en diameter.**

## 3. Beslut som återstår för dig

1. **Är tavlan en ISSF 25/50 m pistoltavla i full skala?**
   - Svarar mätningen i avsnitt 4 ja: lägg in ISSF-måtten som `issf-25m-50m-pistol-v1`, med mätningen och ISSF-källan som underlag.
   - Svarar den nej: lägg in dina uppmätta mått som tavlans egen definition.
2. **Linjen.**
   - Räknas ringlinjen till det högre värdet, så att gränsen är linjens ytterkant? Det är det vanliga i ISSF:s poängräkning, men regeltexten här ovan säger det inte uttryckligen, så du behöver bekräfta det.
   - Annars ska gränsen vara linjens mitt.
3. **Innertian.** Ska den bara visas, eller räknas som X eller tiebreak? Appen räknar den inte i dag.
4. **Håldiameter per kaliber.**
   - Vilka kalibrar använder du?
   - Varifrån ska den nominella diametern komma? Kulans nominella diameter, eller ett uppmätt hål?
   - Tills det är bestämt sätter du diametern själv per session.

## 4. Mätmall

**Utrustning:**
- stållinjal eller skjutmått med millimeterskala, helst 0,5 mm eller finare
- en oanvänd tavla, plant på ett bord.

Mät genom centrum, både vågrätt och lodrätt, och ange båda värdena. Diametern är avståndet mellan ringlinjens ytterkanter, om inget annat står.

| # | Mått | Vågrätt (mm) | Lodrätt (mm) |
| --- | --- | --- | --- |
| M1 | Papperets bredd × höjd | | |
| M2 | Ring 1, ytterkant till ytterkant | | |
| M3 | Ring 5, ytterkant | | |
| M4 | Svarta området, kant till kant (ring 7) | | |
| M5 | Ring 9, ytterkant | | |
| M6 | Ring 10, ytterkant | | |
| M7 | Innertian, ytterkant | | |
| M8 | Linjebredd på en svart linje på ljust papper (ring 3) | | – |
| M9 | Linjebredd på en ljus linje i svart område (ring 9) | | – |
| M10 | Avstånd från centrum till mitten av siffran "1" på höger axel | | – |

**Foton** (S20, rakt framifrån, gott ljus):
- **F1:** Hela tavlan med linjalen lagd vågrätt genom centrum.
- **F2:** Närbild på tian och nian med linjalen.
- **F3:** Närbild på de diagonala strecken mellan ring 5 och 6, med linjalen.
- **F4:** Baksidan och kanten av tavlan, om det står något tryckt där (modell, standard, storlek).

**Kontroll mot ISSF:**
- M2 ≈ 500 mm, M4 ≈ 200 mm, M6 ≈ 50 mm och M7 ≈ 25 mm, inom toleranserna i avsnitt 1, tyder på att tavlan är en ISSF-tavla i full skala.
- Om alla mått är en gemensam faktor av ISSF-måtten, till exempel 0,5, är tavlan nedskalad. Då gäller de uppmätta måtten.

## 5. Vad som händer när måtten finns

1. En ny tavla läggs in i `apps/mobile/src/domain/target/targetDefinition.ts`:
   - ett nytt id
   - de verifierade zonradierna
   - kalibreringsradien, alltså ring 1:s ytterradie
   - `isDemo: false`
   - en hänvisning till mätningen.
2. Nya rundor använder den nya tavlan. Bekräftade demorundor ändras aldrig, och deras poäng räknas inte om.
3. Summeringar och listor håller demopoäng och verklig poäng isär. Det är redan byggt.
4. Gränsfallen testas mot de nya måtten: inuti, exakt kontakt och precis utanför.
