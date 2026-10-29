# Detaljplan steg 6: lista sessioner

> **Notis (2026-10-28):** Hänvisningar till `docs/design/ui-ux.md` gäller designdokumentet v1, som har ersatts av v2.1. Listan har nu filter och klickbara kort; listkontrollern är oförändrad. Developer checks-länken är borttagen.

> **Status (2026-10-27):** Godkänd plan med beslut Ö1–Ö3 och förtydliganden (§8). **6a–6c är implementerade, enhetstestade och committade** (`1cec35f`, `680a65c`, `537a0b7`, designbeslut i `7456ec6`). **6d: dokumentationen är uppdaterad** (`PLAN.md`, README och denna plan). Steg 6 är **inte fullständigt verifierat**.
> **Branch:** `feature/session-list`, skapad från `main` (`a1e4761`) 2026-10-27. Ingen push eller sammanslagning görs utan ägarens besked.
> **Verifiering:** M1–M5 och M7–M10 är godkända på Galaxy S20 i Expo Go (ägaren). M5 verifierar att skapade sessioner finns kvar efter fullständig omstart i den testade miljön. **M6 är delvis kontrollerad, inte verifierad.** Node-testerna verifierar inte `Intl` i Hermes (M6). Felinjektion för listan återstår till steg 7. iOS är overifierat. Tangentbordsbuggen i formuläret (steg 5-kod) är dokumenterad och rättad separat (`9f99cf4`, `840e8c7`) och ingår inte i M1–M10.

## 1. Kontext och underlag

Steg 6 ersätter platshållaren på startskärmen med sessionslistan. Det är också första gången som en sparning från steg 5 kan bekräftas på enhet, och första gången det går att se att data finns kvar efter omstart.

**Befintligt som återanvänds:**
- `src/persistence/sessionRepository.ts`:
  - `listSessions(db)`, som returnerar `{ sessions, invalidRows }` sorterat på `created_at_utc DESC, id DESC`
  - ett databasfel kastas och blir aldrig en tom lista.
- `src/persistence/sessionRow.ts`: `InvalidSessionRow = { id: string | null; errors: Partial<Record<SessionColumn, SessionRowError>> }`. `id` är satt bara när det är ett giltigt sessions-id, och inga radvärden lämnas ut.
- `src/features/startup/*`: `DatabaseGate` och `useSessionStore()`, som ger `{ db, coordinator }`. Startfel hanteras där och ändras inte i steg 6.
- `src/features/sessions/saveCoordinator.ts`: `getState()` och `subscribe()` med tillstånden `idle` och `saving` (inklusive `slow`).
- `src/features/sessions/firearmTypeLabels.ts`.
- `src/components/*` och `tokens.ts`: `Screen`, `Button` (med ikon och `secondary`), `Banner`, `Icon`, `colors`, `typography`, `spacing`, `radius` och `sizes`.
- `app/index.tsx`: platshållaren, som har fokus på rubriken när skärmen visas (`useFocusEffect`).
- Design: `docs/design/ui-ux.md` §5 (A2, A4, A5, F5, F6, Q7, U4–U6, U10).

**Inga nya beroenden.** `FlatList`, `Intl` och `useFocusEffect` finns redan i React Native och `expo-router`.

## 2. Filer och ansvar

| Fil | Ny eller ändrad | Ansvar |
| --- | --- | --- |
| `src/features/sessions/formatSession.ts` | Ny, ren | Raderna på ett sessionskort och etiketten för skärmläsare. Formatering av datum och tid kan få locale och tidszon inskickade för tester. |
| `src/features/sessions/invalidRowPresentation.ts` | Ny, ren | Kort id, `ID unavailable` och unika orsaker från felkoderna enligt `ui-ux.md` §5.3. Listnyckeln för ogiltiga rader. |
| `src/features/sessions/sessionListController.ts` | Ny, ramverksfri | Läsningar: högst en läsning åt gången plus högst en efterföljande, så att ett äldre resultat aldrig skriver över ett nyare. Tillstånden, omladdning när koordinatorn går från `saving` till `idle`, och `dispose`. |
| `src/features/sessions/SessionList.tsx` | Ny | Skärmen: header, banners, `FlatList`, tomt läge, laddning och sidfot. Kopplar kontrollern till `useFocusEffect` och `useSyncExternalStore`. |
| `src/features/sessions/SessionCard.tsx` | Ny | Kort för en giltig session. Det är inte klickbart och läses upp som en grupp. |
| `src/features/sessions/InvalidSessionCard.tsx` | Ny | Kort för en ogiltig rad, med `TriangleAlert`, id, orsaker och `Try reading again`. |
| `app/index.tsx` | Ändrad | Blir en tunn route som renderar `SessionList`. Fokus på rubriken behålls. |
| `PLAN.md`, `README.md`, `docs/design/ui-ux.md` (bara vid beslut Ö1–Ö3) | Ändrade i 6e | Status och faktiska kontrakt |
| Tester | Nya | `tests/features/sessions/formatSession.test.ts`, `invalidRowPresentation.test.ts`, `sessionListController.test.ts` |

`listSessions` och persistenskontraktet ändras inte, om Ö1 avgörs enligt förslaget. Det blir ingen ny generell listkomponent. Laddningsskelettet ritas i `SessionList.tsx` med vanliga vyer.

## 3. Sessionslistan

**Header** (`ui-ux.md` §5): rubriken `Sessions` och undertexten `Your practice, recorded.`. Därefter `New session` med ikonen `Plus`, som går till `/sessions/new`. Ingen tillbakaknapp. Sidfoten är `Saved locally on this device.`

**`New session` är alltid aktiv när listan visas,** även under första laddningen (ägarbeslut 2026-10-27, som ersätter "inaktiverad vid laddning" i tavla `03`). Listan visas bara när `DatabaseGate` är redo, så formuläret kan öppnas utan att vänta på en pågående läsning.

**Sessionskort** (`ui-ux.md` §5.1):
1. Vapennamn som avsnittsrubrik.
2. Lokalt datum och tid i sekundär färg. Värdet kommer från `formatCreatedAt(createdAtUtc)`, som anropar `new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })`.
   - Locale och tidszon följer enheten (U10). Kontrollerat i Node: `en-GB` ger `27 Oct 2026, 14:00`, och `sv-SE` ger `27 okt. 2026 14:00`.
   - Tidszonen som sparades i sessionen används inte för visning.
   - Att Hermes på S20 ger samma resultat är overifierat.
3. `Pistol · 9×19 mm`, från `FIREARM_TYPE_LABELS` och kalibern.
4. `25 m · 10 shots / round`. Distansen visas som `String(distanceMetres)`, så `25.5 m` får punkt, i linje med UI:t på engelska.
5. `5 planned rounds`, eller `Not planned` när värdet är `null` (A5). Värdet döljs aldrig och visas aldrig som 0.

**Singular (Ö3, beslutad):** `1 planned round` och `1 shot / round`. Alla andra antal står i plural.

**Tillgänglighet:**
- Kortet är `accessible` med en etikett byggd av samma texter. För `null` lyder etiketten `Planned rounds: not planned` (U6).
- Kortet har ingen `onPress`, ingen tryckeffekt och inga pilar (F5).

**Ordning:** som `listSessions` returnerar den, alltså nyast först. Ingen sortering i klienten.

**Nyckel för giltiga sessioner:** hela `session.id` (U5).

## 4. Tillstånd och fel

**Kontrollerns tillstånd:**

| Tillstånd | Visning |
| --- | --- |
| `initialLoading` (inga resultat än) | Skelettkort. `New session` är **aktiv**. Skärmläsaren läser upp `Loading saved sessions…` (§5.2). |
| `loaded` med sessioner och/eller ogiltiga rader | Kort och sidfot |
| `loaded` utan sessioner och ogiltiga rader | Tomt läge enligt §5.2: ikonen `Activity`, `Start your practice log`, texten, `New session` och `No account needed. Records stay on this device.` Bara när läsningen **lyckades** och båda listorna är tomma. |
| `initialFailed` (första läsningen misslyckades) | Bannern `Sessions couldn't be loaded` / `Your saved records haven't been removed. Try reading them again.` Primärknappen `Try again` och den sekundära knappen `New session` (Q7). Inget tomt läge och inga kort. |
| `loaded` + `refreshing` | De senaste korten visas kvar. Inget skelett. `New session` är aktiv. |
| `loaded` + `refreshFailed` (omladdningen misslyckades) | De senaste korten visas kvar, med felbannern `Sessions couldn't be refreshed` / `Showing the sessions loaded earlier. Try again.` och knappen `Try again` (Ö2, beslutad). Det får inte se ut som att listan är tom eller aktuell. Texten påstår inget om att posterna finns kvar, eftersom ett läsfel inte ger den informationen. |

**Ett läsfel blir aldrig en tom lista.** Tomt läge visas bara efter en lyckad läsning med noll rader.

**Giltiga och ogiltiga rader i samma resultat:** Båda visas. Ogiltiga rader visas med `InvalidSessionCard` (§5.3):
- **Id:** `ID ` och de första 8 tecknen av `row.id` när det är satt. Annars `ID unavailable`. Skärmläsaren läser upp hela id:t.
- **Orsaker:** unika texter från tabellen i §5.3, i tabellens ordning. Inga kolumnnamn, felkoder, datum eller andra värden visas.
- **Text och knapp:** `This record can't be opened. Other sessions are still available. The original record is kept.` och `Try reading again`, som kör samma omladdning som Retry.

**Placering av ogiltiga rader (Ö1, beslutad):** Ogiltiga rader visas samlade **efter** de giltiga sessionerna, i den ordning `listSessions` returnerar dem. Persistenskontraktet behålls, och `ui-ux.md` §5.3 är uppdaterad.
- Skälet: `listSessions` returnerar `sessions` och `invalidRows` separat.
- Ordningen bygger dessutom på `created_at_utc`, som kan vara just det ogiltiga fältet.

**Nycklar för ogiltiga rader utan att ändra kontraktet:**
- Med id: `invalid:<hela id>`.
- Utan id: `invalid-position:<index i invalidRows>`.
- **Unika även vid samma id:** Om två ogiltiga rader skulle ha samma tillgängliga id, eller en grundnyckel redan används, får den senare suffixet `#2`, `#3` och så vidare. Det hanteras inom ett resultat, utan nytt persistenskontrakt.
- Prefixen gör att en ogiltig nyckel aldrig kan krocka med en giltig sessions id.

**Begränsning:** Positionsnyckeln är en **reservlösning, inte en stabil identitet** mellan omladdningar. Om ordningen eller antalet ogiltiga rader ändras kan samma nyckel peka på en annan rad. Det accepteras, eftersom korten saknar eget tillstånd och bara visar texter från det aktuella resultatet.

**Startfel:** Startfel hanteras fortsatt av `DatabaseGate` med felskärmen 7.7. Listan monteras bara när databasen är redo.

## 5. Uppdatering och navigering

**När listan läses:**

| Händelse | Mekanism |
| --- | --- |
| Första gången skärmen visas | `useFocusEffect` anropar `controller.load()` |
| Användaren återvänder från formuläret (efter sparning, Discard, Leave eller Back) | `useFocusEffect` anropar `load()` igen |
| `Try again` eller `Try reading again` | `load()` |
| En tidigare långsam sparning blir klar efter att användaren har återvänt | Kontrollern prenumererar på `coordinator`. När tillståndet går från `saving` till `idle` **medan listan är i fokus** anropas `load()`. |

Det blir ingen polling.

**Bara i fokus:** Kontrollern håller reda på om listan är i fokus (`setFocused(true/false)` från `useFocusEffect`). Händelser medan listan inte är i fokus, till exempel en sparning som avslutas medan formuläret visas, startar ingen läsning. När användaren kommer tillbaka läses listan om ändå. Om en sparning avslutas medan listan visas uppdateras den direkt.

**Ingen överlappning och inga gamla resultat:**
- Högst en läsning pågår åt gången.
- **Flera begäranden slås ihop:** Hur många begäranden som än kommer under en pågående läsning, ger de tillsammans **högst en** väntande omladdning, som startar när läsningen är klar.
- Varje läsning har ett löpnummer, och bara resultatet från den senast startade används. Ett äldre resultat skriver alltså aldrig över ett nyare.

**Avmontering, `dispose` och `resume`:**
- `dispose()` avslutar prenumerationen på koordinatorn, tar bort en väntande omladdning och ökar löpnumret. En läsning som pågår får fortsätta, eftersom den inte kan avbrytas, men dess resultat ignoreras.
- `resume()` (vid Fast Refresh) prenumererar på nytt. Ett sent resultat från en läsning som startade före `dispose` används inte heller efter `resume`, eftersom löpnumret har ändrats.
- Nästa fokus startar en ny läsning. Om den gamla läsningen fortfarande pågår, väntar den nya tills den är klar, så att läsningarna aldrig överlappar.

**Fokus:** Rubriken `Sessions` får skärmläsarens fokus när skärmen visas, som i dag. Det gäller även efter Leave och Discard.

**Gräns mot steg 5:** Formuläret ändras inte. Dialogens text "If it was saved, it will appear in Sessions" stämmer nu, eftersom listan läses när användaren kommer tillbaka och igen när koordinatorn blir klar.

## 6. Verifiering

**Automatiska tester (rena moduler, ingen rendering):**
- **`formatSession`:**
  - datum och tid med inskickad `en-GB` och `Europe/Stockholm`, både vintertid (`27 Oct 2026, 14:00`) och sommartid (`1 Jul 2026, 15:00`)
  - distans med och utan decimal
  - typ och kaliber
  - `Not planned` för `null`
  - singularformerna (efter beslut om Ö3)
  - etiketten för skärmläsare, inklusive `Planned rounds: not planned`.
- **`invalidRowPresentation`:**
  - varje felkod ger rätt text
  - unika orsaker i fast ordning
  - kort id och `ID unavailable`
  - resultatet innehåller inga felkoder, kolumnnamn eller värden (`JSON.stringify`)
  - nycklarna har prefix och är unika inom ett resultat, även när två rader har samma id eller båda saknar id.
- **`sessionListController`**, med en inskickad fake `listSessions` och deferred-promises:
  - första läsningen ger `loaded`
  - ett fel ger `initialFailed` och aldrig ett tomt resultat
  - tom lista bara efter lyckad läsning
  - giltiga och ogiltiga rader i samma resultat
  - en misslyckad omladdning behåller tidigare resultat och sätter `refreshFailed`
  - Retry
  - högst en läsning åt gången, och flera begäranden ger högst en väntande omladdning
  - ett äldre resultat skriver aldrig över ett nyare
  - övergången `saving` till `idle` i den riktiga koordinatorn utlöser en omladdning när listan är i fokus, men inte när den inte är i fokus och inte om koordinatorn bara är ledig
  - inga resultat efter `dispose`, inte heller efter `resume` för en läsning som startade före `dispose`.
- **Gräns för Node-testerna:** Datum och tid testas med uttrycklig locale och tidszon i Node. Det **verifierar inte Hermes** på enheten (M5).

**Gräns:** Testerna bevisar inte att `SessionList` är rätt kopplad till `useFocusEffect`, `FlatList` eller skärmläsaren. Det kontrolleras manuellt.

**Manuellt på Galaxy S20 med Hermes (Expo Go).** Alla punkter är **ej genomförda**.

| # | Handling | Förväntat resultat | Resultat |
| --- | --- | --- | --- |
| M1 | Starta appen. Om databasen redan har sessioner från steg 5, se förväntat resultat. Annars visas tomt läge. | Med tom databas: rubriken `Sessions`, `Your practice, recorded.`, ikonen `activity`, `Start your practice log`, texten, `New session` och `No account needed. Records stay on this device.`, utan felbanner. Med befintliga sessioner från steg 5: de visas som kort, vilket också bekräftar sparningen från steg 5. `New session` går att trycka på direkt. | OK (ägaren, Galaxy S20, 2026-10-27) |
| M2 | `New session`: Firearm name `Glock 17`, Pistol, Calibre `9×19 mm`, Distance `25,5`, Shots `10`, Planned rounds tomt. Tryck `Create session`. | Appen går tillbaka till listan. Överst visas ett kort med `Glock 17`, aktuell lokal tid, `Pistol · 9×19 mm`, `25.5 m · 10 shots / round` och `Not planned`. Inget dubblettkort. | OK (ägaren, Galaxy S20, 2026-10-27) |
| M3 | Skapa `CZ 457`, Rifle, `.22 LR`, `50`, Shots `1`, Rounds `5`. Skapa sedan `S&W 686`, Revolver, `.38 Special`, `15`, Shots `6`, Rounds `1`. | Ordningen är S&W 686, CZ 457 och Glock 17, nyast först. CZ 457 visar `50 m · 1 shot / round` och `5 planned rounds`. S&W 686 visar `15 m · 6 shots / round` och `1 planned round`. | OK (ägaren, Galaxy S20, 2026-10-27) |
| M4 | Öppna `New session`, skriv något, tryck `Back` och välj `Discard changes`. Öppna sedan `New session` igen och tryck `Back` utan att ändra något. | Båda gångerna går appen tillbaka till listan med samma tre kort. Inga nya kort, och ingen felbanner. | OK (ägaren, Galaxy S20, 2026-10-27) |
| M5 | Avsluta appen helt: svep bort Expo Go från listan över senaste appar, eller välj Tvinga stopp i appinställningarna. Starta Expo Go och projektet igen. | Samma tre sessioner visas med samma uppgifter och i samma ordning. Det är första verifieringen av persistens på enhet. | OK (ägaren, Galaxy S20, 2026-10-27) |
| M6 | Kontrollera tiden på korten mot klockan. Byt 24-timmarsformat eller språk på telefonen. Byt sedan tidszon manuellt, till exempel till London, och gå till formuläret och tillbaka så att listan läses om. Återställ inställningarna efteråt. | Tiden stämmer med telefonens klocka och följer 12- eller 24-timmarsformat och språk (`Intl` i Hermes). Efter bytet av tidszon flyttas den visade tiden med skillnaden mellan zonerna. | **Delvis kontrollerad – inte verifierad.** Ägaren svarade "ok, tror jag" utan att ange vilka inställningar som ändrades. Måste upprepas med ett uttryckligt byte av tidszon, 12- och 24-timmarsformat och språk. |
| M7 | Tryck på flera sessionskort. | Inget händer: ingen navigering och ingen tryckeffekt. Inga pilar visas. | OK (ägaren, Galaxy S20, 2026-10-27) |
| M8 | Slå på TalkBack, öppna appen och svep åt höger genom listan. Öppna formuläret och gå tillbaka. | Fokus börjar på rubriken `Sessions`, både vid start och vid återkomst. `New session` läses som knapp. Varje kort läses **en gång** som en grupp, till exempel `Glock 17, 27 Oct 2026, 14:00, Pistol, 9×19 mm, 25.5 m, 10 shots per round, Planned rounds: not planned`. Korten läses inte som knappar, och raderna läses inte upp igen var för sig. | OK (ägaren, Galaxy S20, 2026-10-27) |
| M9 | Sätt största teckenstorlek och största skärmzoom i telefonens visningsinställningar. Skrolla genom listan. | Alla texter radbryts, och inget klipps eller överlappar. Det går att skrolla till sidfoten `Saved locally on this device.` `New session` går att nå och trycka på. | OK (ägaren, Galaxy S20, 2026-10-27) |
| M10 | Skapa sessioner tills listan är längre än skärmen, minst sex. Skrolla upp och ner. Växla mellan listan och formuläret flera gånger. | Skrollningen är jämn, sidfoten nås och inga kort visas dubbelt. Bakgrunden är mörk utan vit blinkning, och statusfältet är ljust. Ikonen `activity` syntes i M1, om databasen var tom. | OK (ägaren, Galaxy S20, 2026-10-27) |

**Återstår till steg 7 (felinjektion):**
- läsfel med Retry, och en misslyckad omladdning med kvarvarande kort
- ogiltiga rader i en riktig databas
- omladdning efter en långsam sparning
- felskärmen vid start.

**iOS:** overifierat.

## 7. Delsteg

Efter varje delsteg körs `npm run format:check`, `npm run lint`, `npm run typecheck` och `npm test -- --runInBand` från `apps/mobile`. Varje delsteg committas innan nästa påbörjas.

| Delsteg | Filer | Ändring | Verifiering | Klart när |
| --- | --- | --- | --- | --- |
| 6a | `formatSession.ts`, `invalidRowPresentation.ts` och tester | Kortets rader, datum och tid, etikett för skärmläsare, presentation av ogiltiga rader och nycklar | De rena testerna i §6 | Alla texter stämmer med `ui-ux.md` och besluten om Ö1–Ö3 |
| 6b | `sessionListController.ts` och test | Läsningar, tillstånd, omladdning efter sparning och `dispose` och `resume` | Kontrollertesterna i §6 | Inga överlappande läsningar, inga gamla resultat och aldrig tom lista vid fel |
| 6c | `SessionCard.tsx`, `InvalidSessionCard.tsx`, `SessionList.tsx`, `app/index.tsx` | Skärmen, `FlatList` med nycklar, tomt läge, skelett, banners, fokus och sidfot | De fyra kontrollerna och en Android-export, där ikonen `activity` nu ska ingå. Därefter M1–M10 på S20. | Kontrollerna ger exit 0. M1–M10 är ifyllda med faktiska resultat. |
| 6d | `PLAN.md`, `README.md`, `docs/design/ui-ux.md` (Ö1–Ö3), denna plan | Faktiska kontrakt, status och resultaten av M1–M10 | Dokumentationskontroller | Status: "Implementerat och enhetstestat. Persistens på S20 verifierad om M4 gick igenom. Felflöden återstår (steg 7). iOS overifierat." |

## 8. Beslut (2026-10-27)

- **Ö1:** Ogiltiga rader visas samlade efter de giltiga sessionerna. Persistenskontraktet behålls, och `ui-ux.md` §5.3 är uppdaterad.
- **Ö2:** `Sessions couldn't be refreshed` / `Showing the sessions loaded earlier. Try again.` med knappen `Try again`. Ingen text om att poster inte har tagits bort.
- **Ö3:** `1 planned round` och `1 shot / round`. Plural för alla andra antal.
- **Förtydliganden:**
  - `New session` är aktiv under första laddningen.
  - Positionsnycklar är en reservlösning och unika även vid samma id.
  - Läsningar startar bara i fokus.
  - Flera begäranden ger högst en väntande omladdning.
  - Sena resultat ignoreras efter `dispose` och `resume`.

Inga öppna frågor återstår.

## 9. Fynd vid S20-testet av 6c

**Bugg i formuläret (steg 5-kod):** Tangentbordet döljer de nedersta fälten. Buggen är dokumenterad separat i [`docs/bugs/keyboard-covers-lower-form-fields.md`](../docs/bugs/keyboard-covers-lower-form-fields.md).
- M1–M10 gäller sessionslistan. **Att listtesterna gick igenom betyder inte att formulärets tangentbordshantering är godkänd.**
- Buggen är inte åtgärdad. Den används som felsökningsövning i hemuppgift 3.
