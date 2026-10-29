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
| 2–8 | Pågår |
