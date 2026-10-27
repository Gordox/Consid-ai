# Bugg: tangentbordet döljer de nedersta fälten i formuläret

> **Status:** **Åtgärdad för det testade flödet** (2026-10-27). Rättningen är godkänd av ägaren, och sluttestet utan diagnostik gick igenom på S20 i Expo Go. **Mekanismen i H1 stöds av mätning** i Expo Go på S20. **Den bakomliggande plattformsorsaken är inte fastställd** (H3 öppen). Egen Android-build, iOS och andra tangentbord är overifierade. Används som felsökningsövning i hemuppgift 3. Används som felsökningsövning i hemuppgift 3.

## Observation

- **Rapporterad:** 2026-10-27 av ägaren under manuell testning efter steg 6c (sessionslistan).
- **Miljö:** Samsung Galaxy S20, Android, Expo Go, Hermes. Appen kördes med `npx expo start`.
- **Skärm:** Formuläret för ny session (`app/sessions/new.tsx` och `src/features/sessions/SessionForm.tsx`), byggt i steg 5d.
- **Steg:** Öppna `New session` och tryck i `Shots per round` eller `Planned rounds (optional)`.
- **Förväntat:** Innehållet skjuts upp så att fältet man skriver i, och helst `Create session`, alltid syns ovanför tangentbordet (`docs/design/ui-ux.md` §12, `03 · Keyboard open`).
- **Faktiskt:** Fälten döljs av tangentbordet.

## Det som inte är känt

- När felet introducerades. Formuläret byggdes i steg 5d. S20-kontrollen av 5d rapporterades som "ser ut att funka bra" utan att det angavs om punkten om tangentbordet gicks igenom.
- Om de övre fälten, till exempel `Distance (m)`, också påverkas.
- Om det går att skrolla fram fältet manuellt medan tangentbordet är öppet.
- Om felet uppstår i en egen Android-build (development build) eller bara i Expo Go.
- Vilken Android-version S20 kör och om tangentbordet är Samsung Keyboard eller Gboard.

## Avgränsning

- Testerna M1–M10 för sessionslistan gick igenom (steg 6c). **De säger inget om formulärets tangentbordshantering.**
- De automatiska testerna renderar inte komponenter och kan inte upptäcka felet.

## Observationer, andra testet (ägaren, Galaxy S20, Expo Go, 2026-10-27)

| Element | Syns automatiskt när tangentbordet öppnas | Kan skrollas fram helt manuellt med tangentbordet öppet |
| --- | --- | --- |
| `Planned rounds (optional)` | Nej | Nej |
| `Shots per round` | Nej | Nej |
| `Distance (m)` | Ja, men täcks delvis | Nej, täcks delvis |
| `Create session` | – | Nej |

- **Enhet:** Android- och One UI-version är inte kända. Tangentbordet är telefonens standardtangentbord, troligen Samsung Keyboard (ej bekräftat). Expo Go-versionen är inte känd.
- **Kod:** `SessionForm.tsx` är oförändrad sedan steg 5d (`6a5d3e7`), och `app.json` och beroendena är oförändrade sedan 5a. Felet är alltså troligen inte en regression från steg 6.

## Hypoteser

| # | Hypotes | Status |
| --- | --- | --- |
| H1 | Fönstret, och därmed `ScrollView`, krymper inte när tangentbordet visas. `KeyboardAvoidingView` med `behavior` `undefined` renderar en vanlig `View` på Android i React Native 0.88 och gör ingen anpassning. Innehåll under tangentbordets överkant kan inte nås. | **Vald för undersökning.** Stärkt av observationerna men inte verifierad. |
| H2 | Fönstret krymper, men fältet med fokus skrollas inte fram automatiskt. | Mindre sannolik. Den talar emot observationen att inget kan skrollas fram manuellt, men den är inte definitivt utesluten. |
| H3 | Beteendet styrs av Expo Gos manifest (`windowSoftInputMode`) och skiljer sig i en egen Android-build. | Öppen. Den kräver en development build, och Android SDK och `adb` saknas i dag. |

**Motivering till valet av H1 (ägaren):** De nedersta fälten och `Create session` går inte att skrolla fram manuellt med tangentbordet öppet. Det stämmer med ett skrollområde som inte krymper. Det stärker H1, men det bevisar ännu inte att fönstret eller `ScrollView` behåller sin höjd.

**H1 och rotorsaken:** Även om mätningen visar oförändrad höjd fastställer det bara mekanismen, alltså att ytan inte krymper. Det visar inte **varför**: om det beror på kant till kant i SDK 58, Expo Gos manifest eller något annat. Det kräver separat avgränsning (H3).

## Diagnostik för H1 (tillfällig)

- **Var:** `src/features/sessions/keyboardDiagnostics.ts`, som `SessionForm.tsx` anropar. Diagnostiken körs bara i utvecklingsläge (`__DEV__`). Loggraderna börjar med `[KBDIAG]` och innehåller inga formulärvärden.
- **Vad som mäts:** höjd och position i fönstret för `KeyboardAvoidingView` och `ScrollView`, tangentbordets höjd och överkant, raden med `Shots per round` och `Planned rounds`, samt fönster- och skärmhöjd.
- **Status:** Körd av ägaren 2026-10-27 före och under E1. Resultaten står nedan.
- **Borttagen** 2026-10-27 tillsammans med rättningen (`keyboardDiagnostics.ts` raderad, och raderna i `SessionForm.tsx` borttagna).

## Mätresultat för H1 (Expo Go, Galaxy S20, 2026-10-27)

Två körningar gav identiska värden. Fältet var `Planned rounds (optional)`. Alla värden är i dp.

| Mått | Före tangentbordet | Efter `keyboardDidShow` |
| --- | --- | --- |
| `windowHeight` / `screenHeight` | 778,1 / 853,3 | 778,1 / 853,3 |
| `KeyboardAvoidingView`, höjd (`onLayout`) | 778,1 | oförändrad, ingen ny layouthändelse |
| `ScrollView`, höjd (`onLayout` och `measureInWindow`) | 778,1 (top 0, bottom 778,1) | 778,1 (top 0, bottom 778,1) |
| Raden `Shots per round` / `Planned rounds` (`measureInWindow`) | top 672,5, bottom 769,1 | top 672,5, bottom 769,1 |
| Tangentbordet (`keyboardDidShow`) | – | höjd 255,5, överkant (`screenY`) 549,9 |
| Innehållets höjd i `ScrollView` | 893,9 | 893,9 |

**Tolkning:**
- **Mekanismen i H1 stöds av mätningen.** Varken `KeyboardAvoidingView`, `ScrollView` eller fönstret krymper när tangentbordet visas.
- **H2:s antagande om en krympande skrollyta motsägs** av samma mätning. Det gäller i Expo Go på S20.
- **Skrollningen räcker inte:** Innehållet kan skrollas högst cirka 115,8 (893,9 − 778,1). Det är mindre än vad som behövs för att få fältraden ovanför tangentbordets överkant. Efter att tangentbordet stängts i första körningen loggades raden på top 556,8, vilket stämmer med att den var skrollad så långt det gick.
- **`Create session`** är verifierad genom **manuell observation**: den gick inte att skrolla fram med tangentbordet öppet. Den mättes inte. **Fältraden har dessutom mätts.**

**Koordinater:**
- `keyboardTop` är i skärmkoordinater och `measureInWindow` i fönsterkoordinater. Fönstret är 75,2 lägre än skärmen, vilket troligen motsvarar statusfältet (27,2) och navigationsfältet.
- **Exakta överlappningsmått ska därför inte beskrivas som säkert fastställda.** Slutsatsen att fältraden och skrollytans nederkant ligger under tangentbordets överkant håller dock för båda tänkbara nollpunkterna.

**Fortfarande öppet:**
- **H3 och plattformsorsaken.** Mätningen visar inte varför ytan inte krymper. Kant till kant i SDK 58, Expo Gos `windowSoftInputMode` och andra orsaker är inte avgränsade.
- **Egen build:** En development build är inte testad, och Android-verktyg installeras inte nu (ägarbeslut 2026-10-27).

## Experiment E1: `behavior="padding"` även på Android (tillfälligt, inte en godkänd rättning)

- **Ändring:** I `SessionForm.tsx` sätts `KeyboardAvoidingView` till `behavior="padding"` på alla plattformar. iOS hade redan `padding`, så beteendet där är oförändrat. Automatisk skrollning, offsets och övrig layout är oförändrade. Diagnostiken ligger kvar.
- **Status:** Testat av ägaren 2026-10-27. Resultatet står nedan.

### Resultat av E1 (Expo Go, Galaxy S20, fältet `Planned rounds`)

**Manuell observation (ägaren):**

| Fråga | Svar |
| --- | --- |
| 1. Syns fältet automatiskt när tangentbordet öppnas? | Ja |
| 2. Kan hela fältet skrollas fram manuellt? | Ja |
| 3. Kan `Create session` skrollas fram? | Ja |
| 4. Återställs layouten utan extra tomrum när tangentbordet stängs? | Ja |

**Mätning (`[KBDIAG]`):**

| Mått | Före E1 | Med E1 |
| --- | --- | --- |
| `ScrollView`-höjd med tangentbordet öppet | 778,1, oförändrad | 522,7, ny layouthändelse vid `keyboardDidShow` |
| Minskning | 0 | 255,4, nästan exakt tangentbordets höjd 255,5 |
| Skrollytans nederkant i fönsterkoordinater | 778,1 | 522,7 |
| `ScrollView`-höjd efter att tangentbordet stängts | 778,1 | 778,1 |
| Innehållets höjd | 893,9 | 893,9, ingen ny storlek och inget tomrum |

**Koordinaterna avgjorda:** Tangentbordets överkant är 549,9 i skärmkoordinater. Minus statusfältet på 27,2, som är `KeyboardAvoidingView`s `y`, blir det 522,7, samma värde som skrollytans nya nederkant. Fönstrets nollpunkt ligger alltså 27,2 under skärmens överkant. Med den omräkningen låg fältraden i H1-mätningen (672,5–769,1) helt under tangentbordets överkant (522,7).

**Fältraden 540,8 jämfört med skrollytan 522,7:**
- **Vid mättillfället,** 300 ms efter `keyboardDidShow`, låg fältradens nederkant (540,8) **18,1 under** skrollytans synliga nederkant (522,7). Raden är 96,5 hög och består av etikett, mellanrum och inmatningsfält med minst 48 i höjd. Ungefär de nedersta 18 av inmatningsfältet låg alltså utanför den synliga ytan, bakom tangentbordets överkant, **vid just det tillfället**.
- **Det mätningen inte visar:** Skrollpositionen (`contentOffset`) loggades inte, och ingen mätning gjordes senare. Det går därför inte att säga om Android skrollade fältet med fokus ytterligare efter mätningen, eller om den nedersta delen av fältet förblev dold.
- **Ägaren verifierade manuellt** att fältet syntes (fråga 1) och att **hela** fältet och `Create session` gick att skrolla fram (frågorna 2 och 3). Det är verifierat **efter manuell skrollning**.
- **Slutsats vid mättillfället:** Att fältet blir **helt** synligt automatiskt gick inte att säga utifrån mätningen.

**Ny manuell observation (ägaren, upprepat test, Expo Go på S20, 2026-10-27):** `Planned rounds` syns **helt, inklusive nederkanten, efter ungefär två sekunder utan manuell skrollning.** Mätningen efter 300 ms var en **tidigare ögonblicksbild** och visar inte slutläget. Den automatiska skrollningen sköts av plattformen och inte av appens egen kod.

**Inte verifierat med E1:** `Distance (m)`, `Shots per round` och övriga fält, felvisning med tangentbordet öppet, största systemtext, TalkBack, andra tangentbord, en **egen Android-build** och **iOS**.

### Vad E1 säger om hypoteserna

| # | Slutsats |
| --- | --- |
| H1 | **Ytterligare stöd.** Utan anpassning krymper ytan inte, och när `KeyboardAvoidingView` lägger till padding som motsvarar tangentbordets höjd försvinner symtomet. Den saknade anpassningen var alltså det som gjorde att innehållet hamnade bakom tangentbordet i Expo Go på S20. **Varför** fönstret inte krymper av sig självt är inte fastställt. |
| H2 | **Inte orsaken** i Expo Go på S20, eftersom ytan inte krympte utan E1. Med E1 skrollades `Planned rounds` fram helt automatiskt inom cirka två sekunder (manuell observation). För övriga fält är det inte testat. |
| H3 | **Öppen.** E1 säger inget om en egen build. Om fönstret där krymper via `adjustResize` (standardvärdet `resize` i app config) kan `padding` ge dubbel anpassning, alltså tomrum ovanför tangentbordet. Det är den viktigaste kvarstående risken. |

## Rättning (godkänd av ägaren 2026-10-27)

- **Ändring:** I `src/features/sessions/SessionForm.tsx` sätts `KeyboardAvoidingView` till `behavior="padding"` på alla plattformar. Tidigare var det `padding` på iOS och `undefined` på Android. En kommentar förklarar varför och hänvisar till den här rapporten. `Platform` har tagits bort ur importen, eftersom den inte längre används.
- **Inte ändrat:** Ingen egen logik för automatisk skrollning, inga offsets och ingen övrig layout. Den tillfälliga diagnostiken och experimentkommentaren är borttagna.
- **Verifierat:** Det testade flödet med `Planned rounds` i Expo Go på Galaxy S20, med diagnostiken kvar (E1 och det upprepade testet). Fältet syns helt efter cirka två sekunder, fältet och `Create session` kan skrollas fram och layouten återställs utan tomrum.
- **Sluttest utan diagnostik (ägaren, Expo Go, Galaxy S20, 2026-10-27): godkänt.**
  - Inga `[KBDIAG]`-loggar visas, så diagnostiken är borta.
  - `Planned rounds` syns helt automatiskt.
  - `Create session` går att skrolla fram med tangentbordet öppet.
  - Inget extra tomrum ligger kvar efter att tangentbordet stängts.
- **Inte verifierat:**
  - `Distance (m)`, `Shots per round`, `Firearm name` och `Calibre`
  - felvisning med tangentbordet öppet
  - största systemtext och TalkBack med tangentbordet öppet
  - **andra tangentbord** än standardtangentbordet
  - **en egen Android-build**: risken för dubbel anpassning om fönstret där krymper via `adjustResize` (H3)
  - **iOS**, där beteendet är oförändrat men otestat.

  Inga av dessa är markerade som godkända utan ett uttryckligt testresultat.

## Ny observation i testläge (steg 7b, 2026-10-27)

**Observation (ägaren, Expo Go, Galaxy S20):**
- I testläget (`Test mode`-bannern, UI-testdatabasen) döljer tangentbordet återigen de nedersta fälten i formuläret.
- I normalläge fungerar rättningen fortfarande i det testade flödet.
- Vilka fält som påverkas och hur mycket som döljs är inte mätt.

**Fakta från koden:**
- **Samma formulär:** `app/sessions/new.tsx` renderar samma `SessionForm` i båda lägena. `SessionForm.tsx` är oförändrad sedan `840e8c7`, med `KeyboardAvoidingView behavior="padding"` och `keyboardVerticalOffset` 0.
- **Skillnaden är layouten ovanför formuläret.** I testläge renderar `DatabaseGate` en kolumn:
  - `TestModeBanner`, med `SafeAreaView edges={['top']}`, bannern och 12 dp utfyllnad nedtill
  - under den en `View` med `flex: 1`, som innehåller navigeringen och därmed formuläret.

  I normalläge finns ingen banner, och formulärets `SafeAreaView` börjar högst upp i fönstret.
- **Hur `KeyboardAvoidingView` räknar** (React Native 0.88, `KeyboardAvoidingView.js`):
  - Utfyllnaden är `max(frame.y + frame.height − keyboardY, 0)`.
  - `frame` kommer från `onLayout`, som ger positionen **relativt föräldern**, inte fönstret.
  - `keyboardY` är tangentbordets överkant i **skärmkoordinater** minus `keyboardVerticalOffset`.
  - Beräkningen stämmer alltså bara när förälderns överkant sammanfaller med fönstrets.
- **I normalläge stämde det:** Föräldern är formulärets `SafeAreaView` högst upp i fönstret, och mätningen i E1 visade att utfyllnaden (255,4) motsvarade tangentbordets höjd (255,5).

**Hypotes H4 (inte verifierad):**
- I testläge ligger formulärets `SafeAreaView` lägre, under bannerblocket. `KeyboardAvoidingView` får ändå ett `frame.y` relativt föräldern, och det tar inte med förskjutningen.
- Samtidigt är `frame.height` mindre med bannerblockets höjd. Den beräknade utfyllnaden blir därför för liten med ungefär bannerblockets höjd, och lika mycket av formulärets nederkant hamnar bakom tangentbordet.
- **Stöd:** Ägaren såg inget extra tomrum under bannern med tangentbordet stängt. Det tyder på att formulärets `SafeAreaView` inte fick någon egen inset för statusfältet i testläge, men det är inte mätt.
- **Uppskattning:** Bannerblockets höjd, alltså statusfältet, bannerns innehåll och 12 dp, är troligen mer än 100 dp, mot marginalen på cirka 18 dp i E1. Det är en uppskattning, inte ett mått.

**Vad H4 skulle betyda:**
- Felet uppstår när formuläret inte börjar högst upp i fönstret.
- I dag gäller det bara testläget, som bara finns i utveckling. Normalläget och produktionslayouten påverkas inte.
- Rättningen i `840e8c7` förutsätter alltså att formuläret börjar högst upp i fönstret. Det är en begränsning som behöver dokumenteras oavsett hur testläget hanteras.

**Inte undersökt:** andra förklaringar, till exempel om bannerns `SafeAreaView` ändrar fönstrets inset för hela appen, eller om Android hanterar en ny layouthändelse annorlunda när föräldern ändrar storlek.

**Föreslaget nästa test:** se den separata analysen till ägaren. Ingen kod är ändrad.

### Diagnostik för H4 (tillfällig, körd och borttagen 2026-10-27)

- **Var:**
  - `src/features/sessions/keyboardDiagnostics.ts`
  - anrop i `SessionForm.tsx`, extra `onLayout` på `KeyboardAvoidingView` och `ScrollView`
  - anrop i `TestModeBanner.tsx`, `onLayout` på bannerblocket.
- **Begränsningar:**
  - Körs bara i `__DEV__`.
  - Loggraderna börjar med `[KBDIAG] mode=<normal|test> at=<mättillfälle>`.
  - Inga formulärvärden loggas.
  - `keyboardVerticalOffset`, utfyllnaden, bannerns placering och skrollningen är oförändrade.
  - `KeyboardAvoidingView` kör sin egen layouthantering före den extra lyssnaren.
- **Koordinatsystem i loggarna:**

  | Namn i loggen | Mäts relativt |
  | --- | --- |
  | `…Parent` (`onLayout`) | föräldern |
  | `…Window` (`measureInWindow`) | appens fönster |
  | `keyboardScreen` | skärmen |

  De jämförs inte direkt utan omräkning.
- **Mättillfällen:**
  - `mounted+500ms`
  - `keyboardDidShow`
  - `didShow+300ms` och `didShow+2000ms`
  - `didHide+300ms`
  - varje `onLayout`.
- Tas bort när mätningen är införd.

### Mätresultat för H4 (ägaren, Expo Go, Galaxy S20, 2026-10-27)

Samma textstorlek, samma tangentbord och samma fält (`Planned rounds`) i båda körningarna. Alla värden är i dp.

**Manuell observation:**

| Fråga | Normalläge | Testläge |
| --- | --- | --- |
| Syns `Planned rounds` helt utan manuell skrollning? | Ja | **Nej** |
| Kan `Create session` skrollas fram? | Ja | Ja |

**Mätning:**

| Mått | Koordinatsystem | Normalläge | Testläge |
| --- | --- | --- | --- |
| `windowHeight` / `screenHeight` | – | 778,1 / 853,3 | 778,1 / 853,3 |
| Bannerblocket (`onLayout`) | föräldern | – | y 0, höjd 135,5 (108,3 före safe area-inset) |
| Bannerblocket (`measureInWindow`) | fönstret | – | y −27,2, höjd 135,5 |
| `KeyboardAvoidingView` (`onLayout`) | föräldern, formulärets `SafeAreaView` | y 27,2, höjd 778,1 | y 27,2, höjd 642,7 |
| `KeyboardAvoidingView` (`measureInWindow`) | fönstret | **saknas (`null`)** | **saknas (`null`)** |
| `ScrollView` före tangentbordet (`onLayout` / `measureInWindow`) | föräldern / fönstret | höjd 778,1 / y 0 | höjd 642,7 / y 135,5 |
| `ScrollView` med tangentbordet öppet (300 ms och 2000 ms) | föräldern / fönstret | höjd 522,7 / y 0 | höjd 522,7 / y 135,5 |
| Höjdminskning, det vill säga utfyllnad | – | 255,4 | **120,0** |
| Tangentbordet (`keyboardDidShow`) | skärmen | överkant 549,9, höjd 255,5 | överkant 549,9, höjd 255,5 |
| `ScrollView` efter att tangentbordet stängts | föräldern | 778,1 | 642,7 |

**Omräkning:**
- Fönstrets nollpunkt ligger 27,2 under skärmens överkant. Bannerblocket börjar högst upp på skärmen och mäts till −27,2 i fönstret. Det stämmer med mätningen i E1.
- I skärmkoordinater ligger alltså `ScrollView`s överkant på 27,2 i normalläge och på 162,7 i testläge.
- **Formelns uträkning**, `frame.y + frame.height − tangentbordets överkant`:
  - normalläge: 27,2 + 778,1 − 549,9 = **255,4**, vilket stämmer med den uppmätta minskningen
  - testläge: 27,2 + 642,7 − 549,9 = **120,0**, vilket också stämmer med den uppmätta minskningen.
- **Den faktiska överlappningen:**
  - `KeyboardAvoidingView`s nederkant i skärmkoordinater blir 135,5 + 27,2 + 642,7 = 805,4 i testläge och 27,2 + 778,1 = 805,3 i normalläge.
  - Överlappningen med tangentbordet är därför cirka 255,5 i båda lägena.
- **Underskottet i testläge** är 255,5 − 120,0 = cirka 135,5. Det är lika med bannerblockets höjd, som också är förälderns förskjutning från skärmens överkant.

**Slutsats:**
- Mätningen **stöder H4**. Utfyllnaden räknas som om formulärets `SafeAreaView` började högst upp på skärmen, och den blir därför för liten med förälderns förskjutning.
- Tangentbordets mått är identiska i båda lägena, och båda lägena återfår sin höjd när tangentbordet stängs.
- **Inte direkt verifierat:** `KeyboardAvoidingView`s egen position i fönstret. Den är härledd från `ScrollView`, som ligger på y 0 inuti den, och från förälderns layout.

**Varför `avoidingViewWindow` saknas (trolig förklaring, inte verifierad):**
- `KeyboardAvoidingView` anropar `props.onLayout(event)` först efter `await this._updateBottomIfNecessary()`, enligt `KeyboardAvoidingView.js` rad 134–151.
- Efter att händelsen har skickats är `event.currentTarget` troligen redan nollställd. Diagnostiken fick då inget mätbart mål och loggade `null`.
- Diagnostiken skiljer inte mellan "ingen referens" och "ingen `measureInWindow`".

**Ny observation från mätningen:**
- Formulärets `SafeAreaView` har en topputfyllnad på 27,2 även i testläge, under bannerblocket, som redan innehåller statusfältets höjd.
- Det ger ett mellanrum på 27,2 mellan bannerblocket och formuläret.
- Ägaren bedömde avståndet som OK i T2. Mätningen visar ändå att statusfältets höjd räknas två gånger i testläge.
- Det påverkar inte tangentbordsberäkningen, eftersom utfyllnaden ingår i `frame.y`.

## Experiment E2: kompensation för innehållets förskjutning (tillfälligt, inte en godkänd rättning)

- **Ändring (2026-10-27):**
  - `DatabaseGate` mäter innehållsytans `y` under bannern med `onLayout`, relativt grindens rotvy.
  - Värdet delas via `ContentOffsetContext` (`src/features/startup/contentOffsetContext.ts`).
  - `SessionForm` skickar det som `keyboardVerticalOffset`.
  - I normalläge används alltid 0, så ett tidigare värde från testläget kan aldrig följa med tillbaka.
  - `behavior="padding"`, safe area, bannerns placering och skrollningen är oförändrade.
- **Diagnostiken** ligger kvar och loggar:
  - `contentOffset.measured`: det uppmätta värdet
  - `keyboardVerticalOffset.used`: det värde formuläret faktiskt skickar, vid montering och vid varje ändring
  - värdet i varje mätning.
- **Antagande, inte verifierat för alla miljöer:** Grindens rotvy börjar högst upp på skärmen.
  - Det stöds i Expo Go på S20 av att bannerblocket, rotvyns första barn, mättes till −27,2 i fönstret. Det motsvarar 0 i skärmkoordinater.
  - Normalläget bygger redan på samma antagande.
  - En egen Android-build (X1) och iOS är overifierade.
- **Förväntat:**
  - **Normalläge:** offset 0. Höjden går från 778,1 till cirka 522,7, alltså som i H4-mätningen.
  - **Testläge:** offset cirka 135,5. Höjden går från 642,7 till cirka 387,2.
  - Värdena är **förväntade resultat, inte exakta krav**. Små skillnader i avrundning underkänner inte experimentet.
- **Korrekt kompensation bevisar inte automatisk skrollning.** Synlighet utan manuell skrollning och möjligheten att skrolla fram fält och knapp observeras separat.
- **Inte ändrat:** frågan om det extra mellanrummet på 27,2 under bannern.
- **Automatiska tester:** De godkända testerna renderar inte layouten. De bevisar inte att layouten eller annat beteende är opåverkat.
- **Resultat (ägaren, Expo Go, Galaxy S20, 2026-10-27):** Visuellt som förväntat i alla tre körningarna, alltså normalläge, testläge och återgång till normalläge.
  - `Planned rounds` syns.
  - Fältet och `Create session` går att nå.
  - Inget extra tomrum finns kvar efter att tangentbordet stängts.
  - **Nya mätvärden har inte rapporterats.** Att den använda offseten är cirka 135,5 i testläge och 0 efter återgången är alltså inte bekräftat med loggar. Det är bara bekräftat att beteendet stämmer visuellt.

## Rättning efter E2 (godkänd av ägaren 2026-10-27, commit `0fec9d9`)

- **Behålls:**
  - `ContentOffsetContext` med den dynamiskt uppmätta offseten från `DatabaseGate`
  - `keyboardVerticalOffset={contentOffsetY}` i `SessionForm`.
  - Offseten är alltid 0 i normalläge.
  - `behavior="padding"` är oförändrad.
- **Borttaget:** `keyboardDiagnostics.ts`, alla anrop till den och alla kommentarer om experimentet.
- **Antagande:** Grindens rotvy börjar högst upp på skärmen. Det stöds av mätningen i Expo Go på S20, men det är inte verifierat för alla miljöer.
- **Verifierat visuellt i Expo Go på S20:** E2-körningarna ovan.
- **Sluttest utan diagnostik (ägaren, Expo Go, Galaxy S20, 2026-10-27): OK på alla fem punkterna.**
  1. Normalläge: `Planned rounds` och `Create session` går att nå.
  2. En ny session sparas och visas i listan.
  3. Inga `[KBDIAG]`-loggar visas.
  4. Testläge: `Planned rounds` och `Create session` går att nå.
  5. Återgången till normalläge fungerar utan kvarvarande tomrum.

  Resultatet gäller bara de här punkterna, alltså fältet `Planned rounds` med standardtangentbordet.
- **Inte verifierat:**
  - andra fält än `Planned rounds` med tangentbordet öppet
  - felvisning, TalkBack och största text med tangentbordet öppet
  - andra tangentbord
  - en egen Android-build (H3, risk för dubbel anpassning)
  - iOS.
- **Oförändrat och öppet:** mellanrummet på 27,2 under bannern i testläge, där statusfältets höjd räknas två gånger. Det finns bara i utvecklingsläge.
