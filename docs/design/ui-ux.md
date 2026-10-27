# UI/UX-design: sessionslistan och formuläret för ny session

> **Status:** Utkast, inte godkänt. Skisserna saknas. Hör till steg 4 i [`PLAN.md`](../../PLAN.md).
> UI-texter står på engelska, eftersom appens gränssnitt är på engelska enligt B2 och `CLAUDE.md`. Texterna är **förslag** tills dokumentet är godkänt.

## 1. Syfte och omfattning

Dokumentet beskriver hur de två första skärmarna ska se ut och bete sig innan de byggs:

- **Sessionslistan** (startskärmen), som byggs i steg 6.
- **Formuläret för ny session**, som byggs i steg 5.

**Utanför:**
- rundor, kamera och import
- bildanalys, granskningseditor och poäng
- träningslogg utöver listan
- redigering och borttagning av sessioner
- anteckningar och vapenprofiler
- mörkt läge (`app.json` har `userInterfaceStyle: light`)
- branding och appikon (Open input 4 i `CLAUDE.md`).

## 2. Underlag som redan är beslutat

| Källa | Vad det betyder för UI:t |
| --- | --- |
| B1 | Gränserna för varje fält. Ingen trunkering eller avrundning, så ogiltig inmatning visas som fel. |
| B2 | Vapentyperna Pistol, Revolver, Rifle och Other. Interna värden och visningsetiketter är separata. UI-texten är på engelska. |
| B5 | Distansen godtar både `25,5` och `25.5`. |
| B10 | Bara skapa och lista. Ingen redigering, borttagning eller anteckningar. |
| Steg 2 | Formuläret visar felkoderna från `validateSessionInput`: `required`, `tooLong`, `invalidNumber`, `tooManyDecimals`, `outOfRange` och `unsupportedValue`. Alla fältfel kommer samtidigt. |
| Steg 3 | Sparningen kan ge `saved`, `alreadySaved`, `InvalidSessionError`, `SessionIdConflictError` eller ett databasfel. Listan ger `sessions` och `invalidRows`, och ett läsfel kastas. Retry måste skicka exakt samma `Session`. |
| `CLAUDE.md` | Kontrollerna ska vara användbara på Galaxy S20. Osäkerhet och fel får inte visas med enbart färg. Behörigheter frågas bara när de behövs, men inga behövs i det här steget. |

## 3. Navigering

```text
Sessionslistan  (/)  ──"New session"──▶  Formulär för ny session  (/sessions/new)
        ▲                                         │
        └────────── efter lyckad sparning ────────┘
```

- **Stack-navigering** med Expo Router. Formuläret har en tillbakaknapp i headern och Androids systemknapp för bakåt.
- **Efter `saved` eller `alreadySaved`** går appen tillbaka till listan, och den nya sessionen syns överst.
- **Vad som händer om man går tillbaka utan att spara** är en öppen fråga (F2).
- **Om databasen inte kan öppnas eller migreras** visas en felskärm i stället för listan (tillstånd L6).

## 4. Skärm A: sessionslistan

**Rubrik i headern (förslag):** `Sessions`

**Varje post visar** (från `PLAN.md` steg 6):
- vapennamn
- vapentyp som etikett
- kaliber
- distans, till exempel `25.5 m`
- skott per runda
- planerade rundor, eller `Not planned`
- skapad tid i enhetens lokala tid.

Ordningen är nyast först. Att trycka på en post gör ingenting än, eftersom det inte finns någon detaljvy (F5).

**Primär knapp:** `New session`, alltid synlig, även när listan är tom.

| Id | Tillstånd | Innehåll (förslag) |
| --- | --- | --- |
| L1 | Laddar | En indikator med etiketten `Loading sessions…` för skärmläsare. |
| L2 | Tom | `No sessions yet` och knappen `New session`. |
| L3 | Lista | Poster enligt ovan. |
| L4 | Lista med ogiltiga rader | Ogiltiga rader visas på sin plats i listan som `Unreadable session record`. Raden visar kort id (om det finns) och vilka kolumner som är fel, till exempel `distance_m: tooManyDecimals`. Raden har en ikon och en text, så att den inte märks ut med enbart färg. Inga värden från raden visas. |
| L5 | Läsfel | `Could not load sessions.` och knappen `Retry`. Visas aldrig som en tom lista. |
| L6 | Databasfel vid start | En egen skärm i stället för listan. Texten skiljer på en nyare databasversion (`This data was created by a newer version of the app.`) och en misslyckad migration (`The local database could not be prepared.`). Ingen knapp raderar data. |

## 5. Skärm B: formuläret för ny session

**Rubrik i headern (förslag):** `New session`

**Fält i den här ordningen** (förslag på etiketter och tangentbord):

| # | Fält | Etikett | Kontroll | Tangentbord | Hjälptext (förslag) |
| --- | --- | --- | --- | --- | --- |
| 1 | `firearmName` | `Firearm` | Textfält | standard | `Name of the firearm, max 100 characters` |
| 2 | `firearmType` | `Type` | Fyra segmentknappar: Pistol, Revolver, Rifle, Other | – | – |
| 3 | `calibreLabel` | `Calibre` | Textfält | standard | `For example 9×19 mm, max 50 characters` |
| 4 | `distanceMetres` | `Distance (m)` | Textfält | `decimal-pad` | `0.1–1000 m, at most one decimal` |
| 5 | `plannedShotsPerRound` | `Shots per round` | Textfält | `number-pad` | `1–100` |
| 6 | `plannedRounds` | `Planned rounds (optional)` | Textfält | `number-pad` | `1–100, leave empty if not planned` |

Längst ned finns knappen `Save`.

**Feltexter per felkod (förslag).** Talen kommer från gränskonstanterna i `sessionLimits.ts` och skrivs inte för hand i koden.

| Fält | `required` | `tooLong` | `invalidNumber` | `tooManyDecimals` | `outOfRange` | `unsupportedValue` |
| --- | --- | --- | --- | --- | --- | --- |
| Firearm | `Enter a firearm name.` | `Use at most 100 characters.` | – | – | – | – |
| Type | `Choose a firearm type.` | – | – | – | – | `Choose one of the listed types.` |
| Calibre | `Enter a calibre.` | `Use at most 50 characters.` | – | – | – | – |
| Distance | `Enter a distance.` | – | `Enter a number such as 25 or 25.5.` | `Use at most one decimal.` | `Enter a distance from 0.1 to 1000 m.` | – |
| Shots per round | `Enter the number of shots.` | – | `Enter a whole number.` | – | `Enter a number from 1 to 100.` | – |
| Planned rounds | – (valfritt) | – | `Enter a whole number.` | – | `Enter a number from 1 to 100.` | – |

**Visning av fel:** Felet står direkt under fältet, som text med en ikon och med fältets kant markerad. Det får inte märkas ut med enbart färg. När användaren trycker på `Save` visas alla fältfel samtidigt. När fel ska visas och försvinna medan man skriver är en öppen fråga (F3).

| Id | Tillstånd | Innehåll (förslag) |
| --- | --- | --- |
| F-1 | Tomt formulär | Inga fel visas. `Save` är aktiv. |
| F-2 | Valideringsfel | Fel under varje berört fält. Fokus flyttas till det första felet. |
| F-3 | Sparar | `Save` är inaktiv och visar `Saving…`. Fälten är låsta. Fler tryck ignoreras. |
| F-4 | Sparfel | Ett meddelande ovanför `Save`, `Could not save the session.`, och knappen `Retry`. Inmatningen behålls. Retry skickar samma `Session` (kontraktet i steg 3). |
| F-5 | Id-konflikt | `This session conflicts with one that is already saved.` Inget skrivs över. Vad användaren kan göra sedan är en öppen fråga (F1). |
| F-6 | Sparat | Appen går tillbaka till listan (L3). |

## 6. Tillgänglighet och Galaxy S20

- **Tryckytor:** minst 48 × 48 dp, enligt Androids riktlinje. Det gäller även segmentknapparna.
- **Etiketter:** Varje fält har en synlig etikett och en etikett för skärmläsare, och felet läses upp tillsammans med fältet.
- **Vapentyp:** Segmentknapparna har `accessibilityRole="radio"` och markerat läge. Valt läge syns med form eller ram, inte bara färg.
- **Tangentbord:** Formuläret skrollar så att fältet med fokus och `Save` inte döljs av tangentbordet.
- **Text:** Systemets textstorlek respekteras. Layouten får inte klippa text vid större teckenstorlek.
- **Orientering:** bara stående (`app.json`).
- **Verifiering:** Allt detta kontrolleras manuellt på Galaxy S20 i steg 5–6.

## 7. Bilder som behövs

Ägaren tar fram bilderna och lägger dem i [`images/`](images/). Namngivning och format beskrivs i [`images/README.md`](images/README.md).

| Fil | Visar | Status |
| --- | --- | --- |
| `01-session-list-empty.png` | L2 Tom lista | Saknas |
| `02-session-list.png` | L3 Lista med flera poster | Saknas |
| `03-session-list-invalid-row.png` | L4 Lista med en ogiltig rad | Saknas |
| `04-session-list-load-error.png` | L5 Läsfel | Saknas |
| `05-database-error.png` | L6 Databasfel vid start | Saknas |
| `06-new-session-empty.png` | F-1 Tomt formulär | Saknas |
| `07-new-session-errors.png` | F-2 Valideringsfel på flera fält | Saknas |
| `08-new-session-saving.png` | F-3 Sparar | Saknas |
| `09-new-session-save-failed.png` | F-4 Sparfel med Retry | Saknas |
| `10-new-session-conflict.png` | F-5 Id-konflikt | Saknas |

Om en bild inte behövs, till exempel för att ett tillstånd bara är en textrad, markeras den som uppskjuten i stället för att tas bort.

## 8. Öppna frågor (ägarens beslut)

| # | Fråga | Förslag, inte beslut |
| --- | --- | --- |
| F1 | Användaren ändrar inmatningen efter ett misslyckat sparförsök. Ska nästa `Save` skicka samma `Session` eller en ny? | `Retry` utan ändringar skickar samma `Session`. Efter en ändring bygger `Save` en ny `Session` med nytt id och ny tid. Då kan det inte bli en konflikt med ett försök som kanske sparades trots felet. Nackdelen är att det i sällsynta fall kan bli två sessioner. |
| F2 | Ska appen fråga innan ändringar som inte sparats kastas, när användaren går tillbaka? | Visa en bekräftelse (`Discard this session?`) bara om något fält har ändrats. |
| F3 | När visas fel? | Första gången vid `Save`. Därefter uppdateras felet för ett fält när användaren lämnar det. |
| F4 | Format för datum och tid i listan. | Enhetens lokala format, med datum och tid till minuten, till exempel `27 Oct 2026, 14:00`. |
| F5 | Ska det hända något när man trycker på en post i listan? | Inget i steg 6. En detaljvy kommer med rundor. |
| F6 | Text i rubriken: `Sessions` eller appnamnet `Target Practice`? | `Sessions` i headern. Appnamnet syns som appens namn i systemet. |
| F7 | Ska formulärets standardvärden vara tomma? | Ja, alla fält är tomma och ingen vapentyp är vald. Inga påhittade standardvärden. |
