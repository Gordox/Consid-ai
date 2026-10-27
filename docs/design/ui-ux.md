# UI/UX-design: sessionslistan och formuläret för ny session

> **Status:** Godkänd av ägaren 2026-10-27. Hör till steg 4 i [`PLAN.md`](../../PLAN.md). Det här är dokumentation. Ingen UI är implementerad.
> **Verifiering:** The UI specified here has not yet been implemented or verified in the running app. Android (Galaxy S20 with Hermes) and iOS remain unverified. Documentation checks and contrast calculations are recorded separately. De 322 befintliga testerna gäller steg 2–3 och täcker inte designen, Lucide och SVG eller native-beteende.
> **Texter:** UI-texterna står på engelska (B2, `CLAUDE.md`). Alla texter kommer antingen från tavlorna eller är beslutade av ägaren (punkterna P1–P4 och U1–U10, 2026-10-27). Ett tidigare utkast påstod felaktigt att alla mina egna förslag var markerade. Det är rättat, och inga texter står kvar som förslag.

## 1. Omfattning

Dokumentet styr två skärmar:
- **Sessionslistan** (startskärmen), som byggs i steg 6.
- **Formuläret för ny session**, som byggs i steg 5.

Dessutom styr det felskärmen vid start, som kopplas in i steg 5.

**Utanför MVP:n (A13, framtida koncept som inte är beslutade):** konto och inloggning, aktivitetstyper och kategorier, anteckningar, inställningar och utseende, bottennavigering, rundor, foto, granskning, poäng och historik. De visas i tavla `04` och delvis i `02` och `05`, men de implementeras inte och påverkar inte datamodellen.

## 2. Designunderlag

| Tavla | Innehåll | Roll |
| --- | --- | --- |
| [`01-foundations.png`](images/01-foundations.png) | Färgtokens, typografi, avstånd, kontrastpåståenden, tillgänglighet och plattformsmått | Grund. Typsnittet Inter ersätts av systemtypsnitt (A7). Ramfärgen för fält ändras (avsnitt 9). |
| [`02-components.png`](images/02-components.png) | Knappar, fält, val, kort, dialoger och ikoner | Komponentbibliotek. Bara de komponenter som används i avsnitt 5–7 ingår i MVP:n. |
| [`03-current-mvp.png`](images/03-current-mvp.png) | Sessionslistan och formuläret i iOS 390 pt och Android 360 dp, plus ett valideringskontrakt | **Normerande för MVP:n**, med avvikelserna i avsnitt 4 |
| [`04-future-features.png`](images/04-future-features.png) | Framtida skärmar | Bara framtida koncept. Inte granskad i detalj (A14). |
| [`05-prototype-flows.png`](images/05-prototype-flows.png) | Navigering och beteende för MVP:n och framtida flöden | **Normerande för MVP:ns flöde**. De framtida flödena är bara koncept. |

Ramarna i tavla `03` kallas här vid sitt namn i tavlan, till exempel *"03 · New session · Save failure"*. Tillstånd som saknas i tavlorna beskrivs i text i avsnitt 7, och de blockerar inte implementationen (Q3).

## 3. Beslut

| # | Beslut |
| --- | --- |
| A1 | Det finns en felskärm vid start med Retry, och databasen återställs eller raderas aldrig automatiskt. En id-konflikt visas som ett tydligt sparfel, utan överskrivning och utan nytt id. |
| A2 | En ogiltig rad visar "Unreadable session record" och id om det finns. Inga ovaliderade värden visas, och felkoderna översätts till begriplig text. |
| A3 | Ingen vapentyp är förvald. Felet "Choose a firearm type." finns kvar. |
| A4 | Listan visar lokalt datum och lokal tid. Layouten tål större systemtext. |
| A5 | `null` visas som "Not planned". Uppgiften döljs aldrig och visas aldrig som 0. |
| A6 | Appen har bara mörkt tema, utan temaväljare. |
| A7 | Systemtypsnitt. Inter kan komma senare. |
| A8 / Q1 | Lucide-ikoner via `lucide-react-native` och `react-native-svg` (avsnitt 10). |
| A9 / Q7 | "New session" finns kvar vid läsfel i listan, men inte på felskärmen vid start. |
| A10 | Tavlornas texter används, utom där de strider mot besluten. |
| A15 | Samma design på båda plattformarna. Vilka plattformsanpassningar som behövs avgörs först efter verifiering, och iOS är overifierat. |
| F1 / Q6 | Sessionen låses vid första försöket. Retry skickar samma objekt, och det finns en dialog för att lämna efter ett sparfel (avsnitt 6). |
| F2 | En bekräftelse visas vid osparade ändringar, för appens bakåtknapp, Androids bakåtknapp och iOS bakåtsvep. |
| F3 / U7 | Inga fel visas före första sparförsöket. `Create session` validerar alltid hela formuläret, värdena behålls och fokus flyttas till det första ogiltiga fältet (`05`). Därefter valideras ett fält på nytt när det ändras, och bara det fältets fel uppdateras: felet tas bort när värdet blir giltigt och behålls eller uppdateras annars. All validering kommer från domänen (`validateSessionInput`). Formuläret har inga egna regler. |
| F4 / U10 | Lokalt datum och lokal tid (A4). Formatet följer enhetens språk och region. `27 Oct 2026, 14:00` är bara ett exempel. |
| F5 | Posterna i listan är inte klickbara och har inga pilar. |
| F6 | Rubriken är `Sessions`. |
| F7 | Formuläret startar med tomma fält och ingen vald typ (A3). |
| Q2 | `expo-system-ui` läggs inte till nu (avsnitt 11). |
| Q4 | Fältramar ska ha minst 3:1 kontrast. Ny token `inputBorder` (avsnitt 9). |

## 4. Avvikelser från tavla 03

| Ram i `03` | Avvikelse | Beslut |
| --- | --- | --- |
| Sessions · Unreadable record retained | Visar "Saved 26 Oct 2026 · Original record retained" | Datumet tas bort. Kortet visar id och orsak (A2, avsnitt 5.3). |
| Sessions · Populated | Bara datum. Rundor som saknas utelämnas. | Datum och tid visas (A4), och `null` visas som "Not planned" (A5). |
| New session · Default | Pistol är förvald | Ingen vald typ (A3) |
| New session · Save failure | Fälten ser redigerbara ut. Texten "Your entries are still here. Try again." | Fälten är låsta, och en förklaring om låsningen visas (F1, avsnitt 7.3) |
| Alla | Typsnittet Inter och ikoner ritade i tavlan | Systemtypsnitt och Lucide (A7, Q1) |
| Alla | Fältram `#3A424B` | `inputBorder` `#68727C` (Q4) |

## 5. Skärm A: sessionslistan

**Header:** stor rubrik `Sessions` och undertexten `Your practice, recorded.` (`03`). Ingen tillbakaknapp.

**Primär knapp:** `New session` med ikonen `plus`, överst under undertexten (`03`). Den syns i alla tillstånd utom vid laddning, där den är inaktiverad, och den syns inte på felskärmen vid start.

**Sidfot:** `Saved locally on this device.` (`03`).

### 5.1 Sessionspost (kort)

Kortet är inte klickbart, har inga pilar och ingen tryckeffekt (F5). Raderna ligger i den här ordningen, och varje rad får radbrytas (A4):
1. vapennamnet som avsnittsrubrik, till exempel `Glock 17`
2. lokalt datum och tid, till exempel `27 Oct 2026, 14:00` (sekundär färg)
3. typ och kaliber, till exempel `Pistol · 9×19 mm`
4. distans och skott per runda, till exempel `25 m · 10 shots / round`
5. planerade rundor, till exempel `5 planned rounds` eller `Not planned` (A5).

**Tillgänglighet:** Kortet läses upp som en grupp, med en etikett som bygger på samma texter. För `null` lyder etiketten `Planned rounds: not planned` (U6, beslutad).

### 5.2 Tillstånd

| Tillstånd | Ram i tavla | Innehåll |
| --- | --- | --- |
| Laddar | `03 · Loading` | `New session` är inaktiverad. Skelettkort visas, och texten `Loading saved sessions…` läses upp. |
| Tom | `03 · Empty` | Ikonen `activity` (dekorativ), rubriken `Start your practice log`, texten `Keep session settings together, from your first round onward.`, knappen `New session` och sidfoten `No account needed. Records stay on this device.` |
| Lista | `03 · Populated` | Kort enligt 5.1, nyast först |
| Ogiltig rad | `03 · Unreadable record retained` med avvikelsen i 4 | Se 5.3 |
| Läsfel (databasen är öppen men listningen misslyckades) | `03 · Read failure` | En banner med ikonen `circle-alert`, `Sessions couldn't be loaded`, och `Your saved records haven't been removed. Try reading them again.` Primärknappen är `Try again`, som läser listan på nytt, och den sekundära knappen är `New session` (Q7). Visas aldrig som en tom lista. |
| Läsfel efter "Leave" (6.3) | samma | Samma som läsfel. Det får aldrig se ut som att sessionen saknas. |
| Större text | `03 · Large text / 130 %` | Text radbryts och sidan skrollar. Inget klipps av. |

### 5.3 Ogiltig rad (A2)

Kortet ligger på sin plats i listan:
- Ikonen `triangle-alert` (dekorativ) och rubriken `Unreadable session record`.
- `ID 3f2504e0` (de första 8 tecknen) när id är giltigt. Hela id:t läses upp av skärmläsaren. Utan giltigt id står `ID unavailable`. (U5) Det förkortade id:t är bara en visuell referens. Internt används alltid hela id:t, även som nyckel i listan, och det förkortade värdet får aldrig användas som unik nyckel.
- En rad per unik orsak, översatt från kolumnfelen (U4, beslutad). Råa felkoder och kolumnnamn visas aldrig:

| Felkod från steg 3 | Text |
| --- | --- |
| `missingColumn`, `invalidType` | `Some saved details are missing or damaged.` |
| `invalidId` | `The record ID is not valid.` |
| `invalidTimestamp` | `The saved date and time are not valid.` |
| `invalidTimeZone` | `The saved time zone is not valid.` |
| `required`, `tooLong`, `notNormalized` | `A saved text detail is not valid.` |
| `invalidNumber`, `tooManyDecimals`, `outOfRange` | `A saved number is not valid.` |
| `unsupportedValue` | `The saved firearm type is not recognised.` |

- Texten `This record can't be opened. Other sessions are still available. The original record is kept.` (från `03`, med ändrad sista mening).
- Knappen `Try reading again`, som läser hela listan på nytt. Inget raderas eller ändras.

Kortet skiljer sig från andra kort genom ikon och text, inte bara genom färg.

## 6. Skärm B: formuläret för ny session

**Header:** knappen `Back` med ikonen `chevron-left` och den stora rubriken `New session` (`03`). Knappen är en egen Lucide-ikonknapp med tillgängligt namn `Back` och en tryckyta på minst 48 dp. Den ersätter plattformens standardpil, så att samma ikonfamilj används överallt.

**Fält i ordning** (`03`). Alla fält är tomma från början (F7).

| Fält | Etikett | Kontroll | Tangentbord |
| --- | --- | --- | --- |
| `firearmName` | `Firearm name` | Textfält | standard |
| `firearmType` | `Firearm type` | Fyra radrader: `Pistol`, `Revolver`, `Rifle`, `Other`. Vald rad har ikonen `check` och accentram, ovald har ikonen `circle`. **Ingen är förvald.** | – |
| `calibreLabel` | `Calibre` | Textfält | standard |
| `distanceMetres` | `Distance (m)` | Textfält | `decimal-pad`, med hjälptexten `Decimal keyboard · comma or point` när det är öppet |
| `plannedShotsPerRound` | `Shots per round` | Textfält bredvid nästa fält | `number-pad` |
| `plannedRounds` | `Planned rounds (optional)` | Textfält | `number-pad` |

**Primärknapp:** `Create session`, längst ned. **Sidfot:** `Saved on this device. No account needed.` (`03`).

**Feltexter.** De flesta kommer från valideringskontraktet och ramarna i `03`. Flera felkoder delar samma text.

| Fält | Felkoder | Text |
| --- | --- | --- |
| Firearm name | `required` | `Enter a firearm name.` |
| | `tooLong` | `Use 100 characters or fewer.` |
| Firearm type | `required`, `unsupportedValue` | `Choose a firearm type.` (A3) |
| Calibre | `required` | `Enter a calibre.` |
| | `tooLong` | `Use 50 characters or fewer.` |
| Distance | `required`, `invalidNumber`, `tooManyDecimals`, `outOfRange` | `Enter 0.1 to 1000 m, with at most one decimal.` |
| Shots per round | `required`, `invalidNumber`, `outOfRange` | `Enter a whole number from 1 to 100.` |
| Planned rounds | `invalidNumber`, `outOfRange` | `Leave empty or enter 1 to 100.` |

Talen i texterna kommer från `sessionLimits.ts` och skrivs inte för hand i koden. Fel visas med ikonen `circle-alert`, text och felram, aldrig med enbart färg. När fel visas och uppdateras följer beslutet F3 / U7 i avsnitt 3. När användaren trycker på `Create session` och något är fel visas bannern `Check your session settings` med texten `Correct the fields below, then create your session.` (`03`).

## 7. Formulärets tillstånd

### 7.1 Översikt

| Tillstånd | Ram | Fält | Primärknapp | Bakåt |
| --- | --- | --- | --- | --- |
| Orört | `03 · Default`, utan förvald typ | Redigerbara | `Create session` | Ingen fråga |
| Ändrat | `03 · Filled` | Redigerbara | `Create session` | Dialogen "Discard" (7.4) |
| Valideringsfel | `03 · Validation error` | Redigerbara | `Create session` | Dialogen "Discard" |
| Sparar | `03 · Saving` | **Låsta** | `Creating session…` med ikonen `refresh-cw`, inaktiverad | Spärrad under ett normalt pågående försök (U8, 7.2) |
| Sparfel | 7.3 (ny) | **Låsta** | `Try saving again` | Dialogen "Leave after failure" (7.5) |
| Id-konflikt | 7.6 (ny) | **Låsta** | `Back to sessions` | Ingen fråga |
| Sparat | – | – | – | Går direkt till listan, som läses om |

**Spärr mot dubbla tryck:** Bara ett sparanrop åt gången får pågå. När första giltiga försöket görs skapas en stabil kopia av hela `Session`-objektet, alltså id, `createdAtUtc`, tidszon och inställningar. Retry skickar exakt den kopian (kontraktet i steg 3).

### 7.2 Sparar

- **Layout:** som `03 · Saving`.
- **Låst:** alla fält, radraderna och bakåtnavigeringen, under ett normalt pågående sparförsök (U8).
- **Långvarigt eller hängande anrop (U8):** Användaren får inte bli permanent inlåst på skärmen. Hanteringen planeras i detaljplanen för steg 5 före implementation, och den ska uppfylla följande:
  - En UI-timeout får inte tolkas som att databasanropet har avbrutits eller att sessionen inte har sparats.
  - Inga parallella sparförsök får startas.
  - Att lokal sparning brukar gå fort är inget argument för spärren.
- **Tillgänglighet:** `Creating session…` läses upp en gång, och knappen har `accessibilityState.busy`.

### 7.3 Sparfel med låsta fält (ny, saknas i tavlorna)

- **Layout:** som `03 · Save failure`. En banner överst, fälten under och primärknappen längst ned.
- **Banner:** ikonen `circle-alert`, rubriken `Couldn't save session` (`03`) och texten `Your details are kept and locked. Retry uses the same session details to avoid creating a duplicate.` (P1, beslutad). Texten beskriver hur återförsöket fungerar och lovar inte att det lyckas. Uppgifterna finns kvar i formuläret, men de överlever inte att appen startas om.
- **Under bannern:** ikonen `lock` och texten `Details locked` (P2, beslutad). Låsningen syns alltså i text och inte bara som nedtonade fält.
- **Fält:** visar de inskickade värdena och är inte redigerbara. De har `accessibilityState.disabled`, och ramen har färgen `disabled` (`#77818B`, 4,13:1 mot surface).
- **Handlingar:** `Try saving again` skickar samma sessionsobjekt. Bakåt öppnar dialogen i 7.5. Inget nytt försök görs automatiskt.
- **Tillgänglighet:** Bannern läses upp som en statusändring, och fokus stannar i formuläret (`05`).

### 7.4 Dialogen "Discard" (F2)

- **Ram:** `02 · Discard unsaved changes?` i komponenttavlan.
- **Visas när:** formuläret har ändrats men aldrig skickats, och användaren går bakåt via appens knapp, Androids bakåtknapp eller iOS bakåtsvep.
- **Rubrik:** `Discard unsaved changes?`
- **Text:** `This draft will be removed. Saved sessions won't change.` (`02`)
- **Knappar:** `Keep editing` (förvald, inte destruktiv, får fokus först) och `Discard changes` (destruktiv stil).
- **Keep editing** stänger dialogen och flyttar fokus tillbaka till `Back` (`05`).
- **Discard changes** går tillbaka till listan.
- **Visas inte** när formuläret är orört eller sessionen är sparad.

### 7.5 Dialogen för att lämna efter sparfel (ny, Q6)

- **Layout:** samma dialogkomponent som 7.4.
- **Rubrik:** `Leave this screen?` (P3, beslutad)
- **Text (ägarens beslut):**
  `We couldn't confirm whether this session was saved. If it was saved, it will appear in Sessions. If it wasn't, leaving will discard these details.`
- **Knappar:** `Stay` (förvald, inte destruktiv, får fokus först) och `Leave` (destruktiv stil).
- **Stay** stänger dialogen. Formuläret är fortfarande låst, och inget nytt sparförsök görs.
- **Leave** går tillbaka till listan, som läses om. Om läsningen misslyckas visas läsfelet (5.2), aldrig en tom lista.

### 7.6 Id-konflikt (ny, A1, Q6)

- **Layout:** som 7.3, men med en annan banner och knapp.
- **Banner:** ikonen `circle-alert`, rubriken `Session not saved` (U1, beslutad) och texten `These details weren't saved because their ID is already used by another record. Nothing was overwritten.` (enligt ägarens krav i Q6)
- **Fält:** låsta. Det finns ingen Retry, inget nytt id skapas automatiskt och inget skrivs över.
- **Handling:** bara primärknappen `Back to sessions`, som går till listan utan att fråga. Bakåt fungerar på samma sätt.
- **Tillgänglighet:** Bannern läses upp, och fokus flyttas till bannern.

### 7.7 Felskärm vid start (ny, A1, Q7)

Visas av rotlayouten i stället för navigeringen när databasen inte kan öppnas eller migreras.

- **Layout:** helskärm i bakgrundsfärgen, utan header och utan bakåtnavigering. Överst ikonen `triangle-alert` (24 dp, dekorativ), därunder rubriken och texten, och primärknappen längst ned.
- **Rubrik:** `Couldn't open saved sessions` (P4, beslutad)
- **Text, beroende på fel:**
  - `MigrationFailedError`, `JournalModeError`, `DatabaseStateError` och andra fel: `We couldn't open your saved sessions. Try again. If the problem continues, restart the app.` (U2, beslutad). Texten lovar ingenting om datans tillstånd, eftersom orsaken inte är känd.
  - `DatabaseVersionTooNewError`: `Your saved sessions were created by a newer version of Target Practice. Update the app to open them. Nothing has been changed.` (U3, beslutad). Påståendet "Nothing has been changed" stämmer, eftersom `migrateDatabase` kontrollerar versionen före alla skrivningar, även före WAL (steg 3). Det är enhetstestat med fake men inte verifierat på enhet.
- **Handling:** bara `Retry`, som kör initieringen och migrationen igen. **Ingen `New session`** (Q7). Appen raderar eller återställer aldrig databasen automatiskt.
- **Tillgänglighet:** Rubriken är markerad som rubrik, och texten läses upp när skärmen visas. Råa felmeddelanden visas aldrig.

## 8. Tema, typografi och avstånd

- **Tema:** bara mörkt (A6). Färgerna kommer från `01`:
  - `background #111315`, `surface #1C2024`, `elevated #272D33`
  - `text #F4F2EF`, `secondary #B5BDC5`, `disabled #77818B`
  - `accent #FF782D`, `onAccent #17130F`, `focus #FFAC7B`
  - `error #FFABA7`, `warning #F3C77B`, `success #8ED9AB`, `info #A5C9EB`
  - `border #3A424B`, men bara för avdelare
  - ny: `inputBorder #68727C` (avsnitt 9).
- **Typografi:** systemtypsnitt (A7) med storlekarna från `01`:
  - sidrubrik 30/600
  - avsnitt 20/600
  - brödtext 16/400
  - etikett 14/500
  - stödtext 12/400.

  Systemets textstorlek respekteras.
- **Avstånd:** 4-punktsbas. Marginal 24, avstånd mellan grupper 24, mellan fält 16, mellan etikett och fält 8 och fint avstånd 4. Hörnradie 8, 12 och 16 (`01`).
- **Tryckytor:** minst 48 dp. Primärknappar är 52 dp (`01`).

## 9. Kontrast (Q4)

Jag har räknat ut värdena med WCAG:s formel för relativ luminans. Tavlans egna siffror är påståenden som jag har kontrollerat.

| Färgpar | Uppmätt | Tavlans påstående | Krav |
| --- | --- | --- | --- |
| text `#F4F2EF` mot background / surface / elevated | 16,66 / 14,67 / 12,45 | 16,7 / 14,7 | 4,5 |
| secondary `#B5BDC5` mot background / surface | 9,80 / 8,62 | 9,8 / 8,6 | 4,5 |
| accent `#FF782D` som text mot background / surface | 7,07 / 6,22 | 7,1 / 6,2 | 4,5 |
| onAccent `#17130F` på accent `#FF782D` (primärknapp) | 7,02 | 7,0 | 4,5 |
| error `#FFABA7` mot surface (text och felram) | 9,08 | 9,1 | 4,5 / 3 |
| **inputBorder `#68727C`** (ny) mot background / surface | **3,80 / 3,35** | – | 3 (WCAG 1.4.11) |
| focus `#FFAC7B` (fokusring) mot background / surface | 10,14 / 8,93 | – | 3 |
| accent `#FF782D` (vald rad, ram) mot background / surface | 7,07 / 6,22 | – | 3, plus ikonen `check` |
| secondary `#B5BDC5` (ikonen `circle` på ovald rad) mot surface | 8,62 | – | 3 |
| disabled `#77818B` (låsta fält, inaktiv text) mot surface | 4,13 | – | undantag, men låsningen beskrivs också i text |
| ~~border `#3A424B` som fältram~~ mot surface | 1,61 | "quiet separator" | **Underkänd som fältram.** Används bara för avdelare. |
| ~~text `#F4F2EF` på accent~~ | 2,36 | – | **Får inte användas** |

`inputBorder #68727C` är en neutral grå som når minst 3:1 mot både fältets fyllning (surface) och sidans bakgrund, och som skiljer sig från `disabled`. Den gäller för aktiva inmatningsfält och ovalda radrader. Fokus, fel och val har egna färger enligt tabellen och markeras alltid också med form eller ikon.

## 10. Ikoner (Q1)

**Paket:** `lucide-react-native` med `react-native-svg`. Implementationen ska använda exportnamnen i kolumnen "Komponent". De finns i typfilen för `lucide-react-native@1.56.0` (`dist/types/lucide-react-native.d.ts`). Iconify-id:na har jag slagit upp i Iconifys API medan dokumentet skrevs. Alla nio fanns. Ikonerna väljs och identifieras med Lucide-uppsättningen på Iconify (<https://icon-sets.iconify.design/lucide/>). Iconify används bara när man väljer ikoner: inga anrop till Iconifys API när appen körs, och inte Iconifys React-webbkomponent. Ikonerna följer med appen och fungerar offline. Bara de ikoner som används importeras, med namngivna importer från `lucide-react-native`. Versionerna står i `PLAN.md`, steg 5.

| Lucide (Iconify-id) | Komponent | Används för | Dekorativ? |
| --- | --- | --- | --- |
| `lucide:plus` | `Plus` | Knappen `New session` | Ja, knappen har text |
| `lucide:activity` | `Activity` | Tom lista | Ja |
| `lucide:circle-alert` | `CircleAlert` | Felbanners och fältfel | Ja, texten bär informationen |
| `lucide:triangle-alert` | `TriangleAlert` | Ogiltig rad och felskärm vid start | Ja |
| `lucide:check` | `Check` | Vald vapentyp | Ja, läget anges med `accessibilityState.checked` |
| `lucide:circle` | `Circle` | Ovald vapentyp | Ja |
| `lucide:refresh-cw` | `RefreshCw` | `Creating session…` | Ja |
| `lucide:lock` | `Lock` | Text om låsta fält | Ja |
| `lucide:chevron-left` | `ChevronLeft` | Knappen `Back` i headern | Nej, knappen har tillgängligt namn `Back` |

- **Storlek och linje (U9, beslutade tokens):** 20 dp i knappar och banners, 16 dp vid fältfel och 24 dp på tom lista och felskärm. Linjetjockleken är alltid 1,7, enligt rutnätet på 24 enheter i `02`. Färgen kommer från tokens (`text`, `secondary`, `onAccent`, `error` eller `warning`).
- **Dekorativa ikoner:** göms för skärmläsare (`accessibilityElementsHidden` och `importantForAccessibility="no-hide-descendants"`).
- **Ikonknappar:** har `accessibilityRole="button"`, ett tillgängligt namn och en tryckyta på minst 48 dp.
- **Ingen ersättning:** emoji eller egenritade tecken används aldrig i stället för ikoner.

**Licens:** Lucide har ISC-licens, *Copyright (c) 2026 Lucide Icons and Contributors*. En del Lucide-ikoner kommer från Feather och har MIT-licens, *Copyright (c) 2013-present Cole Bemis*. Av ikonerna ovan gäller det enligt paketets `LICENSE`, kontrollerat för version 1.56.0:
- `check`, `chevron-left`, `circle`, `lock` och `plus`
- `circle-alert` (tidigare `alert-circle`) och `triangle-alert` (tidigare `alert-triangle`).

Båda licenstexterna ska bevaras när appen distribueras. Det görs i steg 5 med en fil med tredjepartsnotiser.

## 11. Plattformsverifiering (Q2, A15)

`expo-system-ui` läggs inte till. Följande verifieras, och om något test visar ett behov redovisas problemet och en ändring föreslås före installation.

**Android (Galaxy S20, Expo Go):**
- Bakgrunden är mörk vid start, vid skärmbyten och när tangentbordet öppnas, utan vit blinkning.
- Statusfältets ikoner är ljusa och läsbara.
- Navigationsfältet (kant till kant) har läsbara knappar mot den mörka bakgrunden.
- Systemets tangentbord följer telefonens tema, som appen inte kan styra. Det dokumenteras hur det ser ut med ljust systemtema.
- Androids bakåtknapp öppnar rätt dialog enligt 7.1.
- Dialogerna (7.4–7.5) är egna komponenter och följer temat.
- Texten radbryts vid den största systemtexten.

**iOS (overifierat, ingen testenhet ännu):**
- `keyboardAppearance="dark"` ger ett mörkt tangentbord.
- Statusfältet är ljust.
- Bakåtsvep blockeras och öppnar rätt dialog enligt 7.1.
- Rotbakgrunden bakom skärmar och dialoger är mörk.
- Dynamic Type följs.

Tills det har testats på en riktig iOS-enhet påstås ingenting om iOS.

## 12. Tillgänglighet

- **Läsordning:** skärmrubrik, stödtext, fält i visuell ordning, fältfel, primär handling och sekundär handling (`01`).
- **Fokus:**
  - Efter validering flyttas fokus till det första ogiltiga fältet, och felet läses upp (`05`).
  - Efter ett sparfel stannar fokus i formuläret och statusen läses upp.
  - När en dialog stängs flyttas fokus tillbaka till knappen som öppnade den.
  - I bekräftelsedialoger får det icke-destruktiva valet fokus först.
- **Låsta fält:** har `accessibilityState.disabled` och en förklarande text (7.3, 7.6).
- **Tangentbord:** Formuläret skrollar så att fältet med fokus och primärknappen syns ovanför tangentbordet (`03 · Keyboard open`).
- **Rörelse:** ingen animation krävs, och inställningen för reducerad rörelse respekteras.
