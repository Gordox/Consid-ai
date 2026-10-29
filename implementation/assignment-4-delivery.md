# Hemuppgift 4: leverans av den personliga alfan

Plan och status för deployment, polering och paketering. Inga nya produktfunktioner, inga breda paketuppgraderingar, ingen appbutik och ingen publik analysserver.

## Utgångsläge (2026-10-29)

- Lokal `main` på `4ccb668`, 55 commits före `origin/main` (`d802586`). Arbetskatalogen ren.
- Repot `Gordox/Consid-ai` är publikt. Default-branch `main`.
- CI (`.github/workflows/ci.yml`) kör formatering, lint, typkontroll och tester för appen och servern. Inga byggen.
- Inget Android-applikations-ID, ingen signeringsnyckel, ingen `eas.json`. Inget Android SDK lokalt; Java 17 finns.
- Ägarbeslut: anteckningar skjuts upp till efter alfan; poängen är demo; analysens precision på riktiga foton är omätt; definitionen av v1.0 ändras inte.

## Byggväg

Fristående, signerad APK byggd i GitHub Actions, utan betald tjänst:

1. `npx expo prebuild --platform android` genererar `android/` (ignoreras av Git, Continuous Native Generation).
2. Ett lokalt config plugin (`apps/mobile/plugins/withReleaseSigning.js`) lägger in en release-signering som läser nyckelns sökväg och lösenord från miljövariabler. Utan dem misslyckas releasebygget i stället för att signeras med debug-nyckeln.
3. `./gradlew assembleRelease` bygger APK:n (React Natives dokumenterade väg; Expos guide för lokala produktionsbyggen beskriver samma signering för AAB).
4. `apksigner` och `aapt2` kontrollerar signaturens certifikat, paket-id och version innan något publiceras.

**Identitet:** applikations-id `com.gordox.targetpractice`. Signeringsnyckeln skapas en gång, sparas utanför repot hos ägaren och läggs som GitHub Secrets. Samma id och nyckel krävs för att uppdatera en installerad APK.

**Version:** `versionName` = `<app.json version>-alpha.<run>` och `versionCode` = workflowkörningens `run_number`, som är unikt och stigande. Taggen är `v<versionName>`. En omkörning får samma nummer, och publiceringen avbryts om taggen redan finns, så en release skrivs aldrig över.

**Analysadress:** releasebygget får ingen analysadress. Appen godtar bara HTTPS utanför utvecklingsläge och Android blockerar klartext-HTTP i release, så en lokal HTTP-server kan inte användas från release-APK:n. Analys mot den lokala servern görs i utvecklingsläge (Expo Go). Ingen nätverksspärr försvagas.

## CI/CD

| Händelse | Jobb |
| --- | --- |
| PR mot `main` | `checks` (app) och `analysis` (server) som tidigare, plus en Android-export av JS-bundlen. Inga hemligheter. |
| Push till `main` | Samma kontroller. Därefter `apk` om appen eller arbetsflödet ändrats: prebuild, signerat bygge, kontroll, artefakt. Därefter `release` (enda jobbet med skrivrätt) som publicerar exakt den byggda artefakten som prerelease. |

## Delsteg och acceptanskriterier

| # | Delsteg | Acceptans |
| --- | --- | --- |
| 1 | Beslut om anteckningar dokumenterat | `CLAUDE.md`, `PLAN.md`, stabiliseringsrapporten och ett beslut säger samma sak. |
| 2 | Polering och säkerhetsgranskning | Fynd med fil, rad, konsekvens och åtgärd; bevisade fel skilda från hypoteser; minst tre åtgärder med commit och test, eller en ärlig redovisning. Inga hemligheter, nycklar, privata foton, databaser eller lokala konfigurationsfiler i versionshanterade filer eller historik. |
| 3 | Releasekonfiguration | Applikations-id, versionering och signering via miljövariabler; releasebygget kräver nyckeln. |
| 4 | CI/CD | PR-kontroller utan hemligheter; push till `main` bygger, kontrollerar och publicerar samma APK; skrivrätt bara i publiceringsjobbet. |
| 5 | Verifiering via normalt mergeflöde | En körning på rätt commit med gröna kontroller, byggd APK och publicerad prerelease; filerna går att ladda ned utan inloggning och stämmer med `SHA256SUMS`. |
| 6 | Dokumentation | README enligt kursens rubriker; testarguide i `Assigments/Assigment 4/README.md`; instruktioner kontrollerade mot koden. |
| 7 | Leveransfiler | `Assigments/Assigment 4/`: APK och `SHA256SUMS` (ignorerade av Git, samma fil som i releasen), `README.md`, `submission.md`, `cv.md`, `demo.md`. |
| 8 | Telefonverifiering | Guide för release-APK:n och för analysfallen i utvecklingsläge. Inget markeras som godkänt utan ägarens resultat. |

## Status

| # | Status |
| --- | --- |
| 1 | Klart |
| 2 | Klart: tre nya åtgärder (`a1a21be`, `cbd5b47`, `3395096`), säkerhetsgranskning utan fynd |
| 3 | Klart (`a3e716d`) |
| 4 | Klart, med två rättningar av certifikatkontrollen (PR #4 `fac71c2`, PR #5 `12ccf21`) |
| 5 | Verifierat: körning 40922300945 på `9465390` publicerade `v0.1.0-alpha.8`; nedladdning utan inloggning stämmer med `SHA256SUMS` |
| 6 | Klart (`80a6bfb`) |
| 7 | Klart: `Assigments/Assigment 4/` |
| 8 | Guiden nedan. **Inget är provat på telefon med release-APK:n.** |

## Telefonguide (S20)

Markera bara det du faktiskt har gjort. Svarsmall per kontroll: `OK / Fel / Ej testat`, plus en kort anteckning.

**Vad du kan observera och vad testerna bevisar:** samtidighetsfallen (sena svar, Cancel mitt i ett svar, revisionskonflikter) bevisas av automatiska tester mot riktig SQLite (`apps/mobile/tests/features/analysis/analysisRun.test.ts`, `tests/persistence/sqliteRounds.test.ts`). På telefonen ser du bara utfallet. Exakt när ett svar kommer i förhållande till Cancel går inte att styra för hand.

### R: release-APK:n (`v0.1.0-alpha.8`)

Ladda ned APK:n från releasen i telefonen. Detta är skilt från Expo Go och från lokala byggen; appen har egen data och visar inga sessioner från Expo Go.

| # | Gör | Förväntat |
| --- | --- | --- |
| R1 | Stäng av Metro på datorn och avsluta Expo Go. Installera APK:n enligt `Assigments/Assigment 4/README.md` och starta appen. | Appen startar utan dator, med tom sessionslista. |
| R2 | Slå på flygplansläge. Ny session → runda → **Camera** (tillåt kameran) → efterbild. Prova också **Library**. | Kamera och bibliotek fungerar offline. |
| R3 | **Align target**, **Mark hits manually** med zoom och dragning, sedan sessionsformuläret med tangentbordet öppet. | Gester och tangentbord fungerar som i Expo Go; fälten döljs inte. |
| R4 | Med ett utkast med bild, justering och markeringar: svep bort appen ur senaste-listan och starta den igen. | Utkastet finns kvar med bild, justering och markeringar. |
| R5 | Öppna analyssteget i rundan. | "Analysis unavailable" och **Mark hits manually**; inget anrop görs. |
| R6 | Granska, bekräfta och öppna sessionen igen. | Bekräftad runda med demopoäng. |

### U: analys i utvecklingsläge (Expo Go mot lokal server)

Release-APK:n har ingen analys, så dessa görs i Expo Go med servern igång.

| # | Gör | Förväntat | Vad som kan observeras |
| --- | --- | --- | --- |
| U1 | Med markeringar i rundan: stoppa servern (Ctrl+C) och tryck **Analyse photos**. | "Couldn't reach the analysis service…"; markeringar och foton finns kvar. Starta servern, tryck **Try again**: förslag eller tydligt besked. | Helt observerbart |
| U2 | Tryck **Analyse photos** och genast **Ctrl+Z** i serverterminalen. Tryck **Cancel analysis**. Kör `fg`. Analysera igen. | Efter Cancel är flödet fritt; det nya försöket fungerar. Svaret från det pausade försöket ändrar inget. | Att det sena svaret ignoreras ser du bara som att inga förslag från det dyker upp; själva regeln bevisas av testerna |
