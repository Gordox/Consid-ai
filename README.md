# Target Practice

[![CI](https://github.com/Gordox/Consid-ai/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Gordox/Consid-ai/actions/workflows/ci.yml)

En Android-app (React Native/Expo) för att logga skjutträning mot papperstavla: du fotograferar tavlan, markerar eller får förslag på träffar och sparar bekräftade rundor, så att du slipper föra poäng för hand.

**Nedladdning:** [GitHub Releases](https://github.com/Gordox/Consid-ai/releases) (personlig alfa, prerelease)
**Källkod:** <https://github.com/Gordox/Consid-ai>

> **Personlig alfa.** Poängen är **demopoäng** tills tavlans mått är verifierade. Bildanalysen är bara mätt på syntetiska bilder; dess precision på riktiga foton är inte känd. Anteckningar ingår inte i alfan ([beslut](docs/decisions/2026-10-29-notes-deferred.md)).

## Vad det gör

Du skapar en session med vapen, kaliber, avstånd och planerat antal skott, och tar sedan runda för runda ett foto av tavlan (gärna också ett före skjutningen). Du justerar fyra punkter på ytterringen, markerar träffarna själv eller låter en lokal analysserver föreslå dem, och granskar varje förslag innan något räknas. Bekräftade rundor sparas lokalt på telefonen med foton och resultat, och sessionen visar summeringen.

## Kom igång

### Installera Android-APK

För testare, utan Expo Go, Node eller Metro:

1. Ladda ned `target-practice-alpha-<version>.apk` från den senaste prereleasen under [Releases](https://github.com/Gordox/Consid-ai/releases) direkt i telefonen, eller för över filen med USB.
2. Öppna filen. Om Android frågar, tillåt installation från appen du öppnade den med (webbläsaren eller filhanteraren).
3. Kamera och bilder efterfrågas först när du använder dem.

Allt om installation, uppdatering, behörigheter och felsökning för testare står i [installationsguiden](Assigments/Assigment%204/README.md).

**Uppdatering:** installera en nyare APK från samma releaser ovanpå den gamla. Det fungerar bara med samma applikations-id (`com.gordox.targetpractice`) och samma signering, och då behålls dina data. **Avinstallation raderar appens lokala data** (sessioner, rundor och foton).

### Krav

**Mobilappen (utveckling):**
- Node.js 26 (`apps/mobile/.nvmrc`, `engines` i `apps/mobile/package.json`) och npm.
- Expo SDK 58 (React Native 0.88). Appen körs i **Expo Go** för SDK 58 på telefonen; ingen development build behövs.
- Telefon och dator på samma betrodda nätverk.
- Bara för att bygga en APK lokalt: JDK 17 och Android SDK. Releasebygget görs annars i GitHub Actions.

**Analysservern:**
- Python 3.14 (`services/analysis/pyproject.toml` kräver `>=3.14,<3.15`; verifierat med 3.14.2).
- Inga systempaket; OpenCV installeras som wheel.

### Installation

```bash
git clone https://github.com/Gordox/Consid-ai.git
cd Consid-ai
```

Mobilappen, från `apps/mobile`:

```bash
cd apps/mobile
npm ci
```

Analysservern, från `services/analysis` (första gången):

```bash
cd services/analysis
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -c requirements-lock.txt -e '.[dev]'
```

### Konfiguration

| Variabel | Fil | Används av | Behövs |
| --- | --- | --- | --- |
| `EXPO_PUBLIC_ANALYSIS_URL` | `apps/mobile/.env.local` (mall: `apps/mobile/.env.example`, ignoreras av Git) | Mobilappen, när JS-bundlen byggs | Nej. Utan den är analysen avstängd och du markerar träffar själv. |
| `ANALYSIS_LOG_LEVEL` | Miljön där servern startas | Analysservern | Nej. `DEBUG`, `INFO` (standard), `WARNING` eller `ERROR`. |

Skapa appens fil från mallen och skriv in din dators adress:

```bash
cd apps/mobile
cp .env.example .env.local
# Redigera .env.local:
# EXPO_PUBLIC_ANALYSIS_URL=http://<datorns-LAN-adress>:8000
```

- Analysadressen är **ingen hemlighet** och får inte innehålla någon. Allt med prefixet `EXPO_PUBLIC_` byggs in i appen och kan läsas av alla som har den.
- Appen godtar HTTPS överallt. **Vanlig HTTP godtas bara i utvecklingsläge** (Expo Go) och bara till `localhost`, `127.0.0.1` eller en privat nätverksadress (10.x, 172.16–31.x, 192.168.x). En adress som inte godtas stänger av analysen, och appen säger varför.
- Adressen läses när JS-bundlen byggs. Starta om `npx expo start` efter en ändring, och använd `npx expo start --clear` om appen fortfarande visar den gamla.

**Release-APK:n** byggs i CI utan `.env.local` och har **ingen analysadress**: analysen är avstängd och appen visar "Analysis unavailable". En ändring i `.env.local` på datorn påverkar aldrig en redan installerad APK, eftersom adressen byggs in vid byggtillfället. En annan adress kräver ett nytt APK-bygge, och eftersom releasebyggen kräver HTTPS och Android blockerar klartext-HTTP i release kan en release-APK inte nå den lokala HTTP-servern. Analys mot den lokala servern görs i utvecklingsläge.

### Kör projektet

**Analysservern** (en egen terminal, från `services/analysis`):

```bash
cd services/analysis
source .venv/bin/activate
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

`--host 0.0.0.0` gör servern nåbar för telefonen. Servern har ingen inloggning: kör den bara på ett betrott nätverk.

1. Hitta datorns LAN-adress, på macOS till exempel `ipconfig getifaddr en0`.
2. Öppna `http://<datorns-LAN-adress>:8000/health` i telefonens webbläsare. Den ska visa `{"status":"ok"}`.
3. Svara ja om macOS frågar om Python får ta emot inkommande anslutningar.

**Mobilappen** (en annan terminal, från `apps/mobile`):

```bash
cd apps/mobile
npx expo start
```

Skanna QR-koden med Expo Go på telefonen. Ändringar i koden laddas om automatiskt; tryck `r` i terminalen för att ladda om helt. Ändringar i `.env.local` kräver omstart av `npx expo start`, och ändringar i `app.json`, `app.config.js` eller `plugins/` kräver ett nytt APK-bygge för att nå en installerad APK.

> **Bildanalysen körs för närvarande endast via en lokalt startad server på en dator.** Den körs inte på telefonen och någon publik analystjänst ingår inte. Telefonen måste kunna nå datorns server på det betrodda lokala nätverket. Utan servern fungerar det manuella flödet fortfarande.

## Arkitektur

Mobilappen är en Expo Router-app där skärmarna i `app/` är tunna och delegerar till `src/features`. Poäng, skottredovisning, kalibrering och validering ligger som rena funktioner i `src/domain`, utan beroende till React Native, databas eller nätverk. `src/persistence` lagrar sessioner, rundor och resultat i SQLite med versionerade migrationer och transaktioner, medan fotona kopieras till appens egen mapp och normaliseras (rättvända, utan platsdata) innan de visas eller analyseras. Analysservern är en separat FastAPI-tjänst som tar emot den normaliserade bilden och kalibreringen enligt `contracts/analysis.openapi.yaml` och returnerar förslag som appen alltid låter användaren granska.

```text
apps/mobile/
  app/                  # Expo Router-skärmar
  src/domain/           # poäng, kalibrering, regler
  src/persistence/      # SQLite, migrationer, repositories
  src/features/         # skärmar och flöden (sessioner, rundor, editor, analys, kamera)
  src/services/         # fotolagring, bildväljare, analysklient
  plugins/              # config plugin för release-signering
  tests/
services/analysis/
  app/                  # FastAPI: api, imaging, detection, schemas, config
  tests/
contracts/              # OpenAPI för analysen
docs/                   # beslut, design, telefonchecklistor, utvärdering
.github/workflows/      # CI och APK-release
```

## Teknisk stack

| Komponent | Teknik | Anledning |
| --- | --- | --- |
| Mobilapp | React Native 0.88, Expo SDK 58, TypeScript (strict) | En kodbas för Android och iOS; Expo Go för snabb test på S20 |
| Navigering | Expo Router | Filbaserade rutter, standard i Expo |
| Kamera och bilder | expo-camera, expo-image-picker, expo-image-manipulator | Egen kameravy och bibliotek; rättvända kopior utan platsdata |
| Lokal lagring | expo-sqlite, expo-file-system | Hållbara utkast och resultat över omstarter; foton utanför databasen |
| Bildanalys | Python 3.14, FastAPI, OpenCV | Registrering och hålsökning i en liten, typad HTTP-tjänst |
| Tester | Jest (jest-expo), `node:sqlite`, pytest | Domän, SQL och kontrakt testas utan telefon |
| Kodkvalitet | ESLint, Prettier, TypeScript; ruff, mypy | Samma kontroller lokalt och i CI |
| CI/CD | GitHub Actions, GitHub Releases | Kontroller på PR och `main`; signerad APK publiceras som prerelease |

## Begränsningar

- **Demopoäng.** Appen har bara den syntetiska tavlan `demo-synthetic-v1`. Den riktiga tavlans mått är inte verifierade ([docs/target-calibration.md](docs/target-calibration.md)), så poängen är märkta som demo och är inga riktiga resultat.
- **Omätt precision.** Analysen är heuristisk bildbehandling (OpenCV), bara mätt på syntetiska bilder ([docs/evaluation.md](docs/evaluation.md)). Ett lyckat anrop säger ingenting om hur rätt förslagen är på riktiga foton. Varje förslag måste godkännas.
- **Lokal server.** Analysen kräver den lokala servern och utvecklingsläge; release-APK:n har ingen analys. Servern saknar inloggning och får inte exponeras utanför ett betrott nätverk.
- **Enhetsverifiering.** Ägaren har provat det manuella flödet och analysintegrationen på Galaxy S20 som helhet; de enskilda kontrollerna i [docs/device-tests/mvp.md](docs/device-tests/mvp.md) är inte rapporterade var för sig. iOS är inte testat.
- **Anteckningar** ingår inte i alfan.
- En fristående APK har **separat appdata** från Expo Go. Sessioner från Expo Go flyttas inte över.

## Tester och CI/CD

Från `apps/mobile`:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test -- --runInBand
```

Från `services/analysis`, med miljön aktiverad:

```bash
ruff format --check app tests
ruff check app tests
mypy
python -m pytest -q
```

Vissa persistenstester kör appens SQL på Nodes inbyggda SQLite (`node:sqlite`), inte telefonens. De ersätter inte kontroller på telefon.

[`.github/workflows/ci.yml`](.github/workflows/ci.yml):

| Jobb | När | Vad |
| --- | --- | --- |
| `checks` | PR mot `main` och push till `main` | Appens formatering, lint, typer, tester och en Android-export av JS-bundlen. Inga hemligheter. |
| `analysis` | PR mot `main` och push till `main` | Serverns ruff, mypy och pytest. |
| `apk` | Push till `main` när appen eller arbetsflödet ändrats | Genererar Android-projektet, bygger en signerad release-APK, kontrollerar certifikat, paket-id och version. Läsrätt. |
| `release` | Efter `apk` | Publicerar samma filer som prerelease (`v<version>`), skriver aldrig över en befintlig release och kontrollerar nedladdningen utan inloggning. Enda jobbet med skrivrätt. |

Versionen är `<version i app.json>-alpha.<körningsnummer>` och `versionCode` är körningsnumret. Signeringen kräver repository-hemligheterna `TP_UPLOAD_KEYSTORE_BASE64`, `TP_UPLOAD_STORE_PASSWORD`, `TP_UPLOAD_KEY_ALIAS` och `TP_UPLOAD_KEY_PASSWORD`, och variabeln `TP_SIGNING_CERT_SHA256` (certifikatets offentliga fingeravtryck). Nyckeln finns inte i repot.

Kör manuellt när beroenden ändras (beror på Expos onlinetjänster): `npx expo install --check` och `npx expo-doctor`.

## Felsökning

| Problem | Åtgärd |
| --- | --- |
| Telefonen når inte `/health` | Samma Wi-Fi som datorn? Rätt adress (`ipconfig getifaddr en0`) och port `8000`? Startade du servern med `--host 0.0.0.0`? Tillåt Python i macOS brandvägg. |
| "Analysis unavailable" i Expo Go | `.env.local` saknas eller är tom. Skapa den och starta om `npx expo start --clear`. |
| "This build's analysis address isn't allowed" | Adressen bryter mot reglerna ovan, till exempel HTTP i ett releasebygge eller en publik HTTP-adress. |
| "Couldn't reach the analysis service" | Servern körs inte eller nås inte. Kontrollera `/health` från telefonen; foton och markeringar finns kvar, tryck **Try again**. |
| Demopoäng visas | Avsiktligt tills tavlan är verifierad. |

## Data och integritet

- Sessioner, rundor, markeringar och resultat sparas lokalt i SQLite. Fotona kopieras till appens egen mapp: en oförändrad kopia (kan innehålla plats, lämnar aldrig telefonen) och en rättvänd JPEG utan metadata. Originalen i telefonens bibliotek ändras aldrig.
- Inget skickas någonstans om ingen analysadress är satt **och** du trycker **Analyse photos**. Bara den rättvända kopian skickas.
- Avbrott och återställning: [docs/photo-recovery.md](docs/photo-recovery.md).

## Utvecklat med

Claude Code (agentdriven utveckling) som del av kursen Next-Generation Software Development with AI.

## Licens

Ingen licens är vald ännu.
