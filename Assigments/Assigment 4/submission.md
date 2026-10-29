# Hemuppgift 4: Deployment, polering och paketering

Target Practice, personlig alfa för Android.

## Länkar

| | |
| --- | --- |
| Repo | <https://github.com/Gordox/Consid-ai> |
| Release | <https://github.com/Gordox/Consid-ai/releases/tag/v0.1.0-alpha.8> (prerelease) |
| Workflow | <https://github.com/Gordox/Consid-ai/blob/main/.github/workflows/ci.yml> |
| Körning som byggde och publicerade releasen | <https://github.com/Gordox/Consid-ai/actions/runs/40922300945> |
| Testarguide | [README.md](README.md) (bifogad i releasen som `INSTALL.md`) |

## Leveransen

| | |
| --- | --- |
| Version | `0.1.0-alpha.8`, versionCode 8 |
| Applikations-id | `com.gordox.targetpractice` |
| Byggd och verifierad commit | `946539078465d429278231e7817b9cd52f148cf1` (merge av PR #5) |
| APK | `target-practice-alpha-0.1.0-alpha.8.apk` (127 820 820 byte) |
| SHA-256 för APK:n | `cd113e973cb2d35a1f43350d726fbf28b1b4d9a3c9380c57b57e720108623fa2` |
| Signeringscertifikat, SHA-256 | `16104169af17fe39bf8dc5c9571a954b89ab1013ec028866b182e28eb7decba5` |
| Lokal kopia | `Assigments/Assigment 4/target-practice-alpha-0.1.0-alpha.8.apk` och `SHA256SUMS`, nedladdade utan inloggning från releasen (ignoreras av Git) |

## Status per steg

| Steg | Status |
| --- | --- |
| Plan med acceptanskriterier | Klar: `implementation/assignment-4-delivery.md` |
| Polering | Klar: tre nya åtgärder med commit och test (nedan) |
| Säkerhetsgranskning | Klar: inga fynd (nedan) |
| Signerad, fristående APK | Klar och publicerad. Byggd i GitHub Actions, inte provad på telefon av mig. |
| CI/CD | Klar och verifierad i körning 40922300945: kontroller, bygge, publicering och nedladdning utan inloggning |
| README och testarguide | Klar |
| CV-punkt och demo | Klar: [cv.md](cv.md), [demo.md](demo.md). Demon är inte repeterad. |
| Telefonverifiering av release-APK:n | **Väntar på ägaren** |

## CI/CD

**Vad CI verifierar** (PR mot `main` och push till `main`): appens formatering, lint, typkontroll, Jest-tester och Android-export av JS-bundlen; serverns ruff, mypy och pytest. Inga hemligheter behövs.

**Hur APK:n byggs och publiceras** (push till `main` när appen eller arbetsflödet ändrats):
1. `apk`: `expo prebuild`, `gradlew assembleRelease` signerad med nyckeln från GitHub Secrets, kontroll av certifikat (mot variabeln `TP_SIGNING_CERT_SHA256`), paket-id, versionCode och versionName, därefter artefakt med APK, `INSTALL.md` och `SHA256SUMS`. Läsrätt.
2. `release`: hämtar samma artefakt, kontrollerar kontrollsummorna, vägrar om taggen redan finns, publicerar prerelease och laddar sedan ned filerna utan token och kontrollerar dem igen. Enda jobbet med skrivrätt.

Detta är verifierat med en verklig körning, inte bara med gröna tester. Vägen dit krävde två avgränsade rättningar av certifikatkontrollen, båda genom PR (nedan). Körningarna 40903777380 och 40907554812 byggde och signerade APK:n men stoppades av kontrollen, så inget publicerades då. Versionsnummer 4 och 6 används därför inte för någon release.

**Secrets och variabel** (inlagda av Claude från den lokala nyckelfilen, utan att värdena visats): `TP_UPLOAD_KEYSTORE_BASE64`, `TP_UPLOAD_STORE_PASSWORD`, `TP_UPLOAD_KEY_ALIAS`, `TP_UPLOAD_KEY_PASSWORD`; variabeln `TP_SIGNING_CERT_SHA256`. Nyckeln finns hos ägaren i `~/.target-practice-signing/` och måste sparas säkert, annars kan installerade appar inte uppdateras.

## Polering

### Nya åtgärder

| # | Fil och rad | Fynd (bevisat) | Konsekvens | Åtgärd och commit | Verifiering |
| --- | --- | --- | --- | --- | --- |
| P1 | `services/analysis/app/config/settings.py:33` | `ANALYSIS_LOG_LEVEL` skickades okontrollerat till `logging`. Kört: `verbose` ger `ValueError: Unknown level` | Servern startar inte och felet pekar inte på variabeln | Validering mot tillåtna nivåer, tomt blir `INFO`, dokumenterad. `a1a21be` | `tests/test_settings.py` (3 tester, fallerar utan rättningen) |
| P2 | `apps/mobile/src/services/analysis/analysisClient.ts:130` | Alla undantag från `fetch` blev `network` och orsaken kastades. Bevisat i den här omgången: Expos `fetch`-fel syntes som "Couldn't reach" utan spår | Fel i appen ser ut som nätverksfel och kan inte felsökas | Orsaken skickas till körningens felrapport (felklassen i utvecklingsloggen). `cbd5b47` | Nytt test i `analysisClient.test.ts` |
| P3 | `apps/mobile/src/services/analysis/analysisConfig.ts:49` | En adress som reglerna avvisar (till exempel HTTP i release) gav samma text som ingen adress | Den som bygger tror att adressen saknas | Egen text som säger att adressen inte godtas och varför. `3395096` | Tre nya tester i `analysisConfig.test.ts` |

Dessutom, under leveransen: `72cd692` (bildbilagan avvisades av Expo SDK 58:s `fetch`, så ingen analys nådde servern; regressionstest) och `fac71c2` och `12ccf21` via PR #4 och #5 (certifikatkontrollen i CI).

### Fynd som inte är åtgärdade

| Fil och rad | Fynd | Typ | Varför inte åtgärdat |
| --- | --- | --- | --- |
| `apps/mobile/src/features/sessions/StartingPointsSection.tsx:110`, `:146` | Om profiler och mallar inte kan läsas loggas felet bara i utvecklingsläge och sektionen döljs | Bevisat i kod; liten konsekvens, formuläret fungerar | Kräver UI-ändring utan komponenttester; lämnas till efter alfan |
| `apps/mobile/app.json` (`userInterfaceStyle`, `backgroundColor`) | `expo prebuild` varnar att `expo-system-ui` krävs för att stilen ska gälla i ett fristående bygge | Bevisat (byggvarning); synlig effekt på telefonen är en hypotes | Kräver ett nytt beroende |
| APK:ns storlek (cirka 128 MB) | Universell APK med alla processorarkitekturer | Bevisat | Arkitekturfilter är en byggändring som bör provas på telefon först |
| `apps/mobile/src/features/analysis/AnalysisPanel.tsx:38` | Utvecklingsloggen visar bara felklassen, inte meddelandet | Avsiktligt (inga sökvägar eller data i loggen) | Ingen ändring |

### Historiska åtgärder (stabiliseringen före Hemuppgift 4)

| Kategori | Commit | Åtgärd |
| --- | --- | --- |
| Ohanterad indata | `0a90627` | Diametern skrivs in som tal med högst två decimaler, 1–30 mm, validerad i domänen (G-05) |
| Felhantering vid databasanrop | `6116f18` | Revisioner för utkast och bekräftelse från databasen i samma transaktion (G-01, G-06) |
| Felhantering vid filanrop | `253f5ae` | Sena fotoresultat ersätter aldrig nyare bilder; säker radering av kamerans temporära fil (G-03, G-09) |

## Säkerhetsgranskning

- Versionshanterade filer och hela Git-historiken (`git log --all`) genomsökta efter nycklar, tokens, privata nycklar, lösenord, keystore-filer, `.env`-filer, databaser, foton (`.jpg`, `.heic`) och utvärderingsfoton: **inga fynd**. Ägarens LAN-adress förekommer inte. Bilderna i repot är designreferenser och appikoner.
- Exempeladresser (`192.168.1.23` i dokumentation och tester, `<datorns-LAN-adress>` i `.env.example`) är platshållare.
- Signeringsmaterial: ignoreras via `.gitignore` (`*.jks`, `*.keystore`); nyckeln ligger utanför repot och i GitHub Secrets. Lösenorden har inte skrivits ut i loggar eller rapporter.

**Miljövariabler:**

| Variabel | Läses i | Saknas eller ogiltig | Typ |
| --- | --- | --- | --- |
| `EXPO_PUBLIC_ANALYSIS_URL` | `apps/mobile/src/services/analysis/analysisConfig.ts:59`, `:63` | Saknas: analysen av. Avvisad: analysen av med förklaring | Offentlig konfiguration |
| `ANALYSIS_LOG_LEVEL` | `services/analysis/app/config/settings.py:33` | Saknas: `INFO`. Ogiltig: start stoppas med tydligt fel | Offentlig konfiguration |
| `TP_VERSION_CODE`, `TP_VERSION_NAME` | `apps/mobile/app.config.js` | Båda saknas: utvecklingsversion. Ena eller ogiltig: bygget stoppas | Offentlig (byggs i CI) |
| `TP_UPLOAD_STORE_FILE`, `TP_UPLOAD_STORE_PASSWORD`, `TP_UPLOAD_KEY_ALIAS`, `TP_UPLOAD_KEY_PASSWORD` | `apps/mobile/plugins/withReleaseSigning.js` (vid Gradle-bygget) | Releasebygget stoppas; ingen debug-signering | **Hemlighet** (GitHub Secrets) |

## Kontroller

**Automatiska (CI, körning 40922300945 på `9465390`):** app: format, lint, typer, 67 testfiler (833 tester), Android-export; server: ruff, mypy, pytest (29 tester); bygge, signatur, paket-id och version; publicering; nedladdning utan inloggning mot `SHA256SUMS`.

**Manuella, gjorda av Claude:** nedladdning utan inloggning till den lokala leveransmappen och kontroll mot `SHA256SUMS`.

**Manuella, gjorda av ägaren före leveransen** (Expo Go, inte release-APK:n): det manuella flödet och analysintegrationen på S20 som helhet (`docs/device-tests/mvp.md`).

**Manuella, återstår för ägaren:** installation och test av den nedladdade release-APK:n på S20 enligt guiden i `implementation/assignment-4-delivery.md`, samt repetition av demon.

## Kvarstående begränsningar

- Poängen är demopoäng tills tavlans mått är verifierade.
- Analysens precision på riktiga foton är inte mätt.
- Release-APK:n har ingen analys; analysen kräver den lokala servern och utvecklingsläge.
- Anteckningar ingår inte i alfan.
- Release-APK:n är inte provad på telefon när detta skrivs. iOS är inte testat.
- Kursens exakta README-mall fanns inte i repot; README följer rubrikerna i uppgiftsbeskrivningen.
