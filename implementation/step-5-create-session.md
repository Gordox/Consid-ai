# Detaljplan steg 5: skapa session

> **Status:** Godkänd 2026-10-27, med ägarens förtydliganden om Ö1, Ö2, initiering och fokus. **5a: Implementerat. Expo-kontrollerna går igenom efter den godkända patchuppdateringen. Ägaren har bekräftat att appen startar i Expo Go på Galaxy S20 (2026-10-27).** **5b: Implementerat och enhetstestat. Ägaren har bekräftat på Galaxy S20 att appen startar mörkt och når platshållaren (2026-10-27). Felskärmen vid start, Retry och native stängning kan bara framkallas med felinjektion i steg 7.** Övriga delsteg är inte påbörjade.
> **Branch:** `feature/create-session` skapas från `docs/ui-ux-design`, så att de godkända dokumenten följer med. Ingen push eller sammanslagning görs nu.
> **Verifiering:** Att formuläret går tillbaka efter en sparning bevisar **inte** att raden finns kvar i databasen. Verklig persistens verifieras i steg 6–7. Android (Galaxy S20 med Hermes) och iOS är overifierade tills kontrollerna har genomförts.

## 1. Kontext och underlag

Steg 5 bygger formuläret för ny session, appens databasstart med felskärm och den gemensamma UI-grund som formuläret behöver. Det följer `docs/design/ui-ux.md` (godkänd), `PLAN.md` steg 5 och kontrakten från steg 2–3.

**Befintlig kod som återanvänds:**
- `src/domain/session/validateSessionInput.ts`: `validateSessionInput`
- `src/domain/session/buildSession.ts`: `buildSession`
- `src/domain/session/sessionLimits.ts`: gränserna
- `src/domain/session/firearmType.ts`: `FIREARM_TYPES`
- `src/persistence/database.ts`: `DATABASE_NAME`, `SessionDatabase`, `asSessionDatabase`, `DatabaseStateError`
- `src/persistence/migrations.ts`: `migrateDatabase` och felklasserna
- `src/persistence/sessionRepository.ts`: `saveSession`, `InvalidSessionError`, `SessionIdConflictError`

**Befintliga routes:** `app/_layout.tsx` (en ren `<Stack />`) och `app/index.tsx` (en ljus platshållare). De 322 testerna gäller steg 2–3 och verifierar inte UI eller native-integration.

## 2. Beroenden (kontrollerade mot Expo SDK 58, installerade i 5a, se avsnitt 10)

| Paket | Version | Installation | Källa |
| --- | --- | --- | --- |
| `expo-crypto` | `~58.0.7` | `npx expo install expo-crypto` | `expo@58.0.19/bundledNativeModules.json` |
| `react-native-svg` | `15.16.0` | `npx expo install react-native-svg` | Samma lista |
| `lucide-react-native` | `1.56.0`, pinnad exakt | `npm install --save-exact lucide-react-native@1.56.0` | npm, publicerad 2026-10-13. Peer-kravet `react-native-svg ^15` uppfylls. |

**Testberoende:** inget nytt (Ö1, beslutat). Kontrollertesterna verifierar logiken och kopplingarna mellan logikens delar, men **bevisar inte att React-komponenterna är korrekt inkopplade**. Det kontrolleras manuellt. `@testing-library/react-native` 14.1.0 (peer `test-renderer ^1`) läggs inte till nu.

## 3. Databasens livscykel: `DatabaseGate` i stället för `SQLiteProvider`

**Skäl (ägaren godkände avvikelsen 2026-10-27).** I expo-sqlite **58.0.14** visar `build/hooks.js`, i `SQLiteProviderNonSuspense` och `openDatabaseWithInitAsync`, tre problem:
1. Leverantören renderar `null` medan databasen laddas, så det går inte att visa ett laddningsläge.
2. `onError` anropas under rendering. Att ändra state där riskerar varningar och loopar.
3. `openDatabaseWithInitAsync` stänger inte anslutningen när `onInit` kastar ett fel, så varje Retry skulle lämna en öppen anslutning kvar.

**Ägarskap:**
- `DatabaseGate` i rotlayouten äger anslutningen. Inga andra delar öppnar eller stänger den.
- `openSessionDatabase` (`src/persistence/openSessionDatabase.ts`) öppnar anslutningen och kör `migrateDatabase(asSessionDatabase(db))`. Om migrationen misslyckas försöker den stänga anslutningen innan felet kastas vidare.
- En lyckad öppning lämnas över till `DatabaseGate`. Den skapar ett **sessionslager**: anslutningen och en ny sparkoordinator, som delas via `SessionStoreContext`.
- Lagret lever lika länge som anslutningen. Det överlever navigering mellan formulär och är ingen global singleton.

**Dubbel initiering och Retry:**
- `DatabaseGate` har tillstånden `loading`, `ready` och `failed`, och varje start har ett generationsnummer.
- En ny start får bara påbörjas från `failed`, genom Retry, eller vid montering. Retry är inaktiverad medan `loading` pågår.
- **Ingen överlappning:** Ett generationsnummer räcker inte ensamt för att hindra parallella initieringar. Livscykeln håller därför referensen till den pågående initieringen (öppning och migrering). En ny start, vid Retry eller när effekten startas om (till exempel i StrictMode eller vid återmontering), väntar tills den föregående har avslutats och dess anslutning har stängts eller lämnats över. Först därefter öppnas en ny anslutning. Öppning och migrering körs aldrig samtidigt i två initieringar.
- Generationsnumret gör att resultat från en äldre initiering aldrig används. Deras anslutning stängs.

**Sen öppning efter avmontering:** Om `DatabaseGate` har avmonterats när öppningen eller migrationen blir klar, stängs den nya anslutningen direkt och ingen state uppdateras.

**Stängning:**
- När `DatabaseGate` avmonteras stängs anslutningen först när koordinatorn inte har något pågående anrop (`whenIdle()`). En anslutning stängs alltså aldrig mitt under en aktiv operation.
- Vid Retry efter `failed` finns ingen aktiv anslutning att stänga.

**Om stängningen misslyckas efter ett migrationsfel:**
- Ursprungsfelet (till exempel `MigrationFailedError`) behålls och visas.
- Stängningsfelet rapporteras separat via en inskickad rapportfunktion. Den loggar felklassen i `__DEV__`, utan värden.
- **Begränsning:** Anslutningen kan då ligga kvar öppen tills appen avslutas. En Retry öppnar en ny anslutning.

**Felskärmen vid start** (`ui-ux.md` 7.7):
- U2-texten vid `MigrationFailedError`, `JournalModeError`, `DatabaseStateError` och övriga fel. U3-texten vid `DatabaseVersionTooNewError`.
- Bara Retry. Ingen `New session`, och databasen raderas eller återställs aldrig.

## 4. Gemensam UI-grund (bara det som används i steg 5)

- **Tema:**
  - `app.json` får `userInterfaceStyle: "dark"` och `backgroundColor: "#111315"`.
  - Rotlayouten får `ThemeProvider` med en anpassad `DarkTheme` från `expo-router`, och `StatusBar style="light"`.
  - `Stack` får `headerShown: false` och `contentStyle` i bakgrundsfärgen.
- **Tokens:** `src/components/tokens.ts` med färger (även `inputBorder #68727C`), typografi, avstånd, radier, ikonstorlekar 16, 20 och 24 dp och linjen 1,7. Tokens används bara av komponenterna nedan.
- **Typsnitt:** systemtypsnitt. `allowFontScaling` är kvar, och texten radbryts i stället för att klippas.
- **Ikoner:** `src/components/Icon.tsx` med namngivna importer av de nio Lucide-ikonerna. Dekorativa ikoner döljs för skärmläsare. Licenserna står i `THIRD_PARTY_NOTICES.md`.

**Komponenter, skapade i det delsteg där de först används:**

| Komponent | Används av | Delsteg |
| --- | --- | --- |
| `Screen` (safe area och bakgrund, valfri skrollning) | Felskärmen vid start, platshållaren, formuläret | 5b |
| `Button` (primär och destruktiv, inaktiverad, upptagen) | Felskärmen (Retry), formuläret, dialogerna | 5b |
| `Icon` | Allt ovan | 5b |
| `TextField` (etikett, fel, låst) | Formuläret | 5d |
| `ChoiceRow` (radio, ingen förvald) | Formuläret | 5d |
| `Banner` (fel och info) | Formuläret | 5d |
| `ScreenHeader` (Back med `ChevronLeft`, 48 dp, namnet `Back`) | Formuläret | 5d |
| `ConfirmDialog` | Formuläret | 5d |

Inga andra komponenter byggs i förväg.

**`ConfirmDialog`, tillgänglighet och plattform:**
- **Grund:** React Natives `Modal` med `transparent` och `animationType="none"`.
- **Androids bakåtknapp:** `onRequestClose` kör det icke-destruktiva valet, alltså `Keep editing` eller `Stay`.
- **Modalt fokus:**
  - Dialogens innehåll har `accessibilityViewIsModal` för iOS.
  - När dialogen öppnas flyttas skärmläsarens fokus till rubriken (`AccessibilityInfo.sendAccessibilityEvent(ref, 'focus')`).
  - Det icke-destruktiva valet står först i läsordningen.
- **Återställt fokus:**
  - Med `Stay` eller `Keep editing` flyttas fokus tillbaka till knappen som öppnade dialogen, om den fortfarande finns.
  - Med `Leave` eller `Discard changes` sköts fokus på destinationsskärmen. Där får skärmrubriken fokus när skärmen visas.
- **Annat:** Ingen animation. Ingen stängning genom tryck utanför dialogen.

## 5. Formuläret

- **Fält, etiketter och tangentbord:** enligt `ui-ux.md` §6.
  - Vapentypen väljs med fyra `ChoiceRow`, och ingen är förvald.
  - Distansen har `decimal-pad`, och heltalsfälten har `number-pad`.
  - Fälten har `returnKeyType` och `onSubmitEditing`, så att man kan gå vidare till nästa fält.
- **Skrollning:** `KeyboardAvoidingView` och `ScrollView` med `keyboardShouldPersistTaps="handled"`. Fältet med fokus och primärknappen ska synas ovanför tangentbordet.
- **Felvisning (U7):**
  - Före första sparförsöket visas inga fel.
  - `Create session` kör alltid `validateSessionInput` på hela formuläret. Vid fel visas bannern `Check your session settings`, och fokus och skrollning flyttas till det första ogiltiga fältet.
  - Efter första försöket körs `validateSessionInput` på hela inmatningen när ett fält ändras. Bara det ändrade fältets fel uppdateras i visningen: det tas bort när värdet är giltigt och behålls eller uppdateras annars.
  - Formuläret har inga egna valideringsregler.
- **Texter:** från `fieldErrorMessages.ts` enligt `ui-ux.md` §6, med talen hämtade från `sessionLimits`.

## 6. Sparflödet

**Ögonblicksbild:**
- Vid första giltiga `Create session` bygger `prepareSession(input, { newId, now, timeZone })` en fullständig `Session` med id, `createdAtUtc`, tidszon och inställningar.
- Ögonblicksbilden lagras i formulärets kontroller.
- Varje Retry skickar **exakt samma objekt**, både samma referens och samma värden.

**Felklassning, skild mellan fel före och efter databasförsöket:**

| Fel | Har ett sparanrop startats? | Säkerhet | Tillstånd |
| --- | --- | --- | --- |
| Fältfel från `validateSessionInput` | Nej | Säkert inget sparat | Valideringsfel |
| Fel i `prepareSession` (tidszon, id eller tid kan inte läsas, `buildSession` misslyckas) | Nej | Säkert inget sparat | Förberedelsefel (T3) |
| `InvalidSessionError` från `saveSession` | Ja, men kontraktet kastar det **före** skrivning | Säkert inget sparat, och samma ögonblicksbild misslyckas igen | **Avvisad** (ny, utan Retry) |
| `SessionIdConflictError` | Ja | Säkert: en annan rad har id:t, och inget skrevs över | Konflikt (utan Retry) |
| `saved` eller `alreadySaved` | Ja | Säkert sparat | Sparat |
| Alla andra fel (`DatabaseStateError`, SQLite-fel och okända fel) | Ja | **Osäkert** | Sparfel (Retry med samma ögonblicksbild) |

`InvalidSessionError` borde inte kunna uppstå efter `prepareSession`, eftersom samma regler körs. Om det ändå händer är det ett programfel, och det får aldrig erbjudas en Retry som säkert misslyckas.

**Tillstånd:**

| Tillstånd | Fält | Tillåtna handlingar | Bakåt | Övergångar |
| --- | --- | --- | --- | --- |
| Orört | Redigerbara | Create session | Lämnar utan fråga | Ogiltig inmatning ger Valideringsfel. Fel i förberedelsen ger Förberedelsefel. Annars Sparar. |
| Ändrat | Redigerbara | Create session | Dialogen "Discard" (7.4) | Som ovan |
| Valideringsfel | Redigerbara | Create session | "Discard" | Som ovan. Fältfel uppdateras enligt U7. |
| Förberedelsefel (T3) | Redigerbara | Create session (bygger om) | "Discard" | Som ovan. Ingen ögonblicksbild finns. |
| Väntar på tidigare sparning (T2) | Redigerbara | Inga, `Create session` är inaktiverad | "Discard" om formuläret är ändrat | När koordinatorn är klar aktiveras Create session |
| Sparar | Låsta | Inga | Spärrad, utan dialog | `saved` eller `alreadySaved` ger Sparat. Konflikt ger Konflikt. `InvalidSessionError` ger Avvisad. Övriga fel ger Sparfel. Efter 10 s Långsam sparning. |
| Långsam sparning (T1) | Låsta | Inga | Dialogen "Leave this screen?" (7.5) | Ett sent resultat ger samma övergångar. Leave går till startskärmen, och anropet fortsätter. |
| Sparfel (P1) | Låsta | Try saving again | Dialogen 7.5 | Retry går till Sparar med samma ögonblicksbild |
| Avvisad (ny) | Låsta | Back to sessions | Lämnar utan fråga | Slutläge |
| Konflikt (7.6) | Låsta | Back to sessions | Lämnar utan fråga | Slutläge |
| Sparat | – | – | – | Spärren stängs av. `router.back()`, eller `router.replace('/')` om det inte finns någon historik. |

**Texter:**
- **T1 (godkänd):** `Still saving` / `This is taking longer than usual. The session may still be saved. You can keep waiting or go back.`
- **T2 (ägarens text):** `A previous save is still in progress. You can save this session when it finishes. If it remains stuck, restart the app. Unsaved details in this form will be lost.`
- **T3 (ägarens text, bara när inget sparanrop har startats):** `Couldn't prepare session` / `We couldn't prepare this session for saving. No save was attempted. Your details are still here. Try again.`
- **Avvisad (Ö2, beslutad):** rubriken `Session not saved` och texten `These details didn't pass the final check. This save attempt did not write anything.` Knappen `Back to sessions`. Texten gäller bara det aktuella försöket och antyder inte att en tidigare sparning av samma session säkert saknas i databasen.

**Koordinatorn (`saveCoordinator`):**
- Den skapas av `DatabaseGate` tillsammans med anslutningen och lever lika länge som den. Den är ingen global singleton.
- Den tillåter **högst ett pågående sparanrop** i hela appen. Ett andra anrop medan ett pågår avvisas, och dess formulär hamnar i "Väntar på tidigare sparning".
- Den publicerar sitt tillstånd: ledig, eller pågående med försöks-id och flaggan för långsam sparning.
- Flaggan sätts efter **10 s**. Det är bara information i UI:t, ingen timeout, och databasanropet fortsätter.
- `whenIdle()` används när `DatabaseGate` ska stänga anslutningen.

**Sena resultat och avmonterade skärmar:**
- Varje formulär prenumererar med försöks-id och avslutar prenumerationen när det avmonteras.
- Bara den kontroller som äger försöket får resultatet och får navigera.
- Ett sent resultat efter Leave visas därför inte, och ett nytt formulär navigerar aldrig bort på grund av det. Felklassen loggas i `__DEV__`, utan värden.

**Om användaren lämnar och öppnar ett nytt formulär:**
- Det gamla anropet fortsätter.
- I det nya formuläret går fälten att redigera, men `Create session` är inaktiverad och T2 visas tills koordinatorn är ledig.
- En sen lyckad sparning syns när listan läses om (steg 6).

**Begränsningar:**
- Ett anrop som aldrig avslutas låser sparning i nya formulär tills appen startas om. En omstart bevarar **inte** osparade värden i formuläret, och T2 säger det.
- Ett sent fel efter Leave meddelas inte. Användaren varnades i dialog 7.5.
- En SQLite-operation kan inte avbrytas från JS.

## 7. Navigering och gränsen mot steg 6

- **Dialogerna:** "Discard" (7.4) och "Leave this screen?" (7.5) är `ConfirmDialog`.
  - `usePreventRemove` från `expo-router` fångar `Back` i headern, Androids bakåtknapp och iOS bakåtsvep.
  - Vid Discard eller Leave skickas `data.action` vidare.
  - Vid Sparat, Konflikt och Avvisad stängs spärren av innan appen navigerar.
- **Efter lyckad sparning:** Appen går tillbaka till startskärmen. I steg 5 är det fortfarande platshållaren i `app/index.tsx`, i mörk stil.
- **Knappen `New session`** läggs till och aktiveras på platshållaren först i **5d**, när routen `app/sessions/new.tsx` finns.
- **Ingen lista eller tillfällig utvecklingsvy:** Lista, tomt läge och läsfel hör till steg 6.

## 8. Verifiering

**Automatiska tester (Jest, rena moduler):**
- **`openSessionDatabase`:**
  - Lyckad öppning och migrering returnerar anslutningen.
  - Ett migrationsfel stänger anslutningen och kastar ursprungsfelet.
  - Om stängningen också misslyckas kastas ändå ursprungsfelet, och stängningsfelet rapporteras.
- **`databaseLifecycle`** (den rena logiken bakom `DatabaseGate`):
  - En andra start under `loading` avvisas.
  - Resultat från äldre generationer ignoreras, och deras anslutning stängs.
  - En öppning som blir klar efter avmontering stängs.
  - Stängningen väntar på `whenIdle()`.
  - Felklassen avgör vilken text som visas.
- **`fieldErrorMessages`, `firearmTypeLabels`, `prepareSession`:** varje kombination av fält och felkod, alla typer har en etikett, samt att id, tid och tidszon tas från de inskickade funktionerna och att ett fel i dem ger förberedelsefel.
- **`sessionFormState`:** varje övergång i tabellen i avsnitt 6, felvisningen enligt U7 och flaggan för ändrat formulär.
- **`saveCoordinator`:** högst ett anrop i taget, flaggan efter 10 s med fake timers utan att anropet avbryts, prenumerationer och sena resultat samt `whenIdle()`.

**Kopplingarna, testade via `sessionFormController`** (formulärlogiken utan React, som komponenten bara kopplar till). Kontrollern testas med en fake `saveSession` med fördröjda promises och den riktiga koordinatorn:

| Krav | Test |
| --- | --- |
| Submit använder rätt ögonblicksbild | `save` anropas med den `Session` som byggdes av inmatning, id, tid och tidszon |
| Dubbeltryck ger ett sparanrop | Två `submit()` i följd ger exakt ett anrop till `save` |
| Retry återanvänder hela ögonblicksbilden | Efter ett avvisat promise skickar `retry()` samma referens och samma värden |
| Ett sent resultat navigerar inte bort ett nytt formulär | Kontroller A startar, lämnar och avmonteras. Kontroller B monteras. När A:s promise blir klart anropas aldrig B:s navigering. |
| Låsningen delas mellan två formulär | När A har ett pågående anrop är B:s `Create session` inaktiverad och visar T2. När anropet är klart aktiveras den. |
| Avvisad och Konflikt saknar Retry | `retry()` gör ingenting i de tillstånden |

**Gräns för de automatiska testerna (Ö1):** Kontrollertesterna bevisar inte att React-komponenterna är korrekt kopplade till kontrollern. Det gäller `usePreventRemove`, fokus, `Modal` och tangentbordet. Det kontrolleras bara manuellt.

**Manuellt på Galaxy S20 med Hermes (Expo Go), i steg 5:**
- **Start:** mörk bakgrund utan vit blinkning, ljust statusfält och läsbart navigationsfält. Laddningen leder till platshållaren.
- **Formuläret:**
  - fält, tangentbord med komma och punkt, och skrollning när tangentbordet är öppet
  - ingen förvald typ
  - inga fel före första försöket, felvisning enligt U7 och fokus på det första felet.
- **Lyckad sparning:** formuläret går tillbaka. Det bevisar **inte** att raden finns kvar.
- **Dubbeltryck:** snabba dubbeltryck på `Create session` ger ett försök.
- **Dialogen "Discard":** via `Back`, via Androids bakåtknapp och via Androids bakåtknapp när dialogen är öppen. Inklusive fokus och TalkBack.
- **Tillgänglighet:** TalkBack läser upp `Back`, typraderna (valt eller inte valt) och felen. Största systemtexten klipps inte.
- **Hermes:** `deviceTimeZone()` ger ett IANA-namn, och NFC-normaliseringen fungerar.

**Återstår till steg 6–7, ej verifierat på enhet i steg 5:**
- att raden finns kvar i databasen (steg 6 och 7)
- Sparfel, Retry, Långsam sparning, Avvisad, Konflikt, Väntar på tidigare sparning och dialog 7.5, som alla kräver felinjektion via testverktyget i steg 7
- felskärmen vid start, som kräver felinjektion (steg 7)
- testplanen för persistens (steg 7).

**iOS (kan inte genomföras, ingen enhet):** `keyboardAppearance`, bakåtsvep med `usePreventRemove`, `accessibilityViewIsModal` och fokus med VoiceOver, Dynamic Type och statusfältet. Allt är overifierat.

## 9. Delsteg

Efter varje delsteg körs `npm run format:check`, `npm run lint`, `npm run typecheck` och `npm test -- --runInBand` från `apps/mobile`. Varje delsteg committas innan nästa påbörjas.

| Delsteg | Filer | Ändring | Verifiering | Klart när |
| --- | --- | --- | --- | --- |
| 5a | `package.json`, `package-lock.json`, `app.json`, `THIRD_PARTY_NOTICES.md`, `src/components/tokens.ts` | Paketen med de valda versionerna, mörkt tema i `app.json`, tokens och licensnotiser | De fyra kontrollerna, `npx expo install --check`, `npx expo-doctor`, `npm ls` för de tre paketen och manuell start i Expo Go | Rätt versioner, alla kontroller ger exit 0, och appen startar på S20 |
| 5b | `src/persistence/openSessionDatabase.ts`, `src/features/startup/*` (`databaseLifecycle.ts`, `DatabaseGate.tsx`, `StartupErrorScreen.tsx`, `sessionStoreContext.ts`), `src/features/sessions/saveCoordinator.ts`, `src/components/Screen.tsx`, `Button.tsx`, `Icon.tsx`, `app/_layout.tsx`, `app/index.tsx` | Databasens livscykel, sessionslagret med koordinatorn, felskärmen, tema i layouten och en mörk platshållare **utan** `New session` | Tester för `openSessionDatabase`, `databaseLifecycle` och `saveCoordinator`. På S20 startar appen mörk, laddar och visar platshållaren. | Testerna går igenom och appen startar på S20 |
| 5c | `src/services/deviceContext.ts`, `src/features/sessions/firearmTypeLabels.ts`, `fieldErrorMessages.ts`, `prepareSession.ts`, `sessionFormState.ts`, `sessionFormController.ts` | Formulärlogiken utan UI | Testerna för logiken och alla sex kopplingstester i avsnitt 8 | Alla tester går igenom |
| 5d | `src/components/TextField.tsx`, `ChoiceRow.tsx`, `Banner.tsx`, `ScreenHeader.tsx`, `ConfirmDialog.tsx`, `src/features/sessions/SessionForm.tsx`, `app/sessions/new.tsx`, `app/index.tsx` | Formuläret, dialogerna, `usePreventRemove`, fokus och skrollning. `New session` på platshållaren aktiveras. | De manuella S20-kontrollerna i avsnitt 8 | Flödet fungerar på S20. Övrigt är markerat som återstående. |
| 5e | `PLAN.md`, `implementation/step-5-create-session.md` | Faktiska kontrakt och status | Dokumentationskontroller | Status: "Implementerat och enhetstestat. S20: lyckat flöde och dialogen Discard verifierade. Persistens och felflöden återstår (steg 6–7). iOS overifierat." |

## 10. Resultat för 5a (2026-10-27, ej committat)

**Ändrade filer:** `package.json`, `package-lock.json`, `app.json` (`userInterfaceStyle: "dark"`, `backgroundColor: "#111315"`), `src/components/tokens.ts` (ny) och `THIRD_PARTY_NOTICES.md` (ny, Lucides `LICENSE` ordagrant).

**Installerade versioner:**
- `expo-crypto@58.0.7`
- `react-native-svg@15.16.0`
- `lucide-react-native@1.56.0` (exakt pinnad)
- efter patchuppdateringen: `expo@58.0.20` och `expo-router@58.0.27`.

**Patchuppdateringen** (godkänd separat):
- **Varför:** Efter installationen i 5a misslyckades `npx expo install --check` och `expo-doctor`. Kontrollerna väntade sig `expo ~58.0.20` och `expo-router ~58.0.27`, men projektet hade 58.0.19 och 58.0.26. Patcharna publicerades 2026-10-27 omkring 16:00 UTC. **Den versionsavvikelsen var kontrollernas konstaterade felorsak.** Att kontrollerna nu går igenom bevisar inte ensamt att 5a fungerar på enhet.
- **Kommando:** `npm install "expo@~58.0.20" "expo-router@~58.0.27"`. Det fanns inga nyare versioner än de godkända, eftersom `latest` var 58.0.20 och 58.0.27.
- **Releasenoter:**
  - `expo-router` 58.0.27 har "No changes in this release".
  - `expo` 58.0.20 innehåller tre saker:
    - Android undviker Kotlin-reflektion vid initiering.
    - `expo/fetch` har en rättning för `Content-Type` med `Blob`.
    - Beroenden är uppdaterade: `expo-modules-core` 58.0.27, `expo-file-system` 58.0.12, `@expo/cli` 58.1.16, `@expo/metro-config` 58.0.18, `babel-preset-expo` 58.0.21, `@expo/fingerprint` 0.21.7 och `expo-modules-cli` 0.3.3.
  - Inget av det rör routing i stack, expo-sqlite eller databasinitiering, så planen påverkas inte.
- **Följdändringar i lockfilen:**
  - Versionsbyten: `expo-modules-core` 58.0.26 → 58.0.27, och `expo-modules-macros` med plattformsbinärer 0.22.0 → 0.24.0, eftersom `expo-modules-core` 58.0.27 pinnar den versionen.
  - `@expo/cli` 58.1.15 → 58.1.16 och `babel-preset-expo` 58.0.20 → 58.0.21.
  - `node-forge` 1.4.1 → 1.4.2. Det är ett indirekt beroende till `@expo/cli`, används bara i utvecklingsverktyget och publicerades samma dag.
  - Övriga rader är omflyttningar från `node_modules/expo/node_modules/…` till toppnivån, med samma versioner. Det gäller till exempel `expo-font` 58.0.10 och `@expo/metro-runtime` 58.0.15. `expo-font` är fortfarande inget direkt beroende.

**Kontroller efter patchuppdateringen** (från `apps/mobile`):

| Kommando | Resultat |
| --- | --- |
| `npm run format:check`, `npm run lint`, `npm run typecheck` | exit 0 |
| `npm test -- --runInBand` | exit 0, 11 testsviter och 322 av 322 tester godkända |
| `npx expo install --check` | exit 0, "Dependencies are up to date" |
| `npx expo-doctor` | exit 0, 20/20 |
| `npm ls` | Inga ogiltiga eller saknade paket |
| `git diff --check` | OK |

npm varnar fortfarande för installationsskripten i `@parcel/watcher`, `fsevents` och `unrs-resolver`. De är inte godkända, och inga säkerhetsinställningar är ändrade. Varningarna blockerar ingen kontroll.

**Kvarstående verifiering:**
- ~~Manuell appstart i Expo Go med de nya paketen.~~ Bekräftat av ägaren 2026-10-27: appen startar på Galaxy S20. Det visar bara att bundlen laddas och att startskärmen visas. Inget mörkt UI, inga ikoner och inga databasanrop används ännu.
- Mörkt UI och rendering av Lucide-ikoner med `react-native-svg` på Android med Hermes. Det kan testas först i 5b, när tokens, temat och ikonerna används.
- iOS är overifierat.

## 11. Beslut om de tidigare öppna frågorna

- **Ö1:** Inga nya testberoenden. Gränsen för vad testerna bevisar står i avsnitt 8.
- **Ö2:** Texten för Avvisad står i avsnitt 6.

Inga öppna frågor återstår inför 5a.
