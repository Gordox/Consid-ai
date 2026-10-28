# Detaljplan steg 8: CI

> **Status (2026-10-27):** Planen är godkänd med besluten Ö1–Ö4 (§6). **8a:** `.github/workflows/ci.yml` är skriven och lokalt verifierad i en ren klon (§8). **8b:** README, `PLAN.md` och den här planen är uppdaterade. **8c:** Arbetsflödet är **inte verifierat i GitHub Actions** än. Steg 8 räknas inte som verifierat förrän den första körningen har lyckats.
> **Utgångsläge:** `main` vid `2316871`, sammanslagningen av PR #1 (steg 6–7b), synkroniserad med `origin/main`.
> **Branch:** `feature/ci` från `main` (`2316871`). Ingen push eller sammanslagning görs utan ägarens besked.

## 1. Mål och avgränsning

CI ska köra **samma kontroller som README redan beskriver**, i en ren miljö, vid varje PR mot `main` och varje push till `main`.

**Ingår:**
- installation med lockfil (`npm ci`)
- `format:check`, `lint`, `typecheck` och tester.

**Ingår inte:**
- deployment, byggen (Android, iOS eller EAS), publicering eller enhetsjobb
- nya testverktyg, testberoenden eller linters
- utbyggnad av steg 7 (pausat, se `implementation/step-7-verification.md` §11)
- kontroller mot iOS eller Android.

Ett grönt CI-resultat betyder att de automatiska kontrollerna går igenom. Det betyder **inte** att kontrollerna på S20 eller iOS har gått igenom, eller att layouten är verifierad.

## 2. Förutsättningar (kontrollerade 2026-10-27)

| Område | Observation |
| --- | --- |
| Node | `apps/mobile/.nvmrc` innehåller `26`. `package.json` har `"engines": { "node": "^26.0.0" }`. Lokalt används Node 26.12.1 och npm 11.20.0. |
| Pakethanterare | npm. Det finns bara en lockfil, `apps/mobile/package-lock.json`. Inget `packageManager`-fält finns. |
| Arbetskatalog | Allt ligger i `apps/mobile`. Roten har ingen `package.json`. Det finns ingen `.github/` i dag. |
| Scripts | `format:check` = `prettier --check .`, `lint` = `expo lint` (ESLint 9 med `eslint-config-expo`), `typecheck` = `tsc --noEmit` och `test` = `jest` (`jest-expo`, `passWithNoTests: false`). |
| Prettier | `.prettierignore` utesluter `node_modules/`, `.expo/`, `dist/` och `package-lock.json`. Bara `apps/mobile` kontrolleras. Markdown i roten (`PLAN.md`, `docs/`, `implementation/`) omfattas inte. |
| Tester | 25 sviter och 482 tester. De är rena Node-tester utan native-kod, nätverk, databas eller enhet. |
| Installationsskript | npm 11 kör inte installationsskripten för `@parcel/watcher` och `unrs-resolver` utan godkännande. Lint och tester fungerar ändå lokalt (`PLAN.md`, Antaganden). Det är **inte verifierat** att det gäller i en ren CI-miljö. Det kontrolleras i 8a. |

## 3. Föreslaget arbetsflöde

**Fil:** `.github/workflows/ci.yml`. Det är ett enda jobb på `ubuntu-latest`.

| Del | Förslag | Motivering |
| --- | --- | --- |
| Utlösare | `pull_request` mot `main` och `push` till `main` | PR:er kontrolleras före sammanslagning, och `main` kontrolleras efter |
| Rättigheter | `permissions: contents: read` | Jobbet behöver bara läsa koden |
| Samtidighet | `concurrency` per ref, med `cancel-in-progress: true` | En äldre körning för samma PR avbryts |
| Tidsgräns | `timeout-minutes: 15` | Ett hängande jobb ska inte köra i timmar. Lokalt tar kontrollerna under en minut, utöver installationen. |
| Arbetskatalog | `defaults.run.working-directory: apps/mobile` | Alla scripts finns där |
| Utcheckning | `actions/checkout` | – |
| Node | `actions/setup-node` med `node-version-file: apps/mobile/.nvmrc`, `cache: npm` och `cache-dependency-path: apps/mobile/package-lock.json` | Samma major-version som lokalt. Cachen är inbyggd i `setup-node` och är inget nytt verktyg. |
| Installation | `npm ci` | Följer lockfilen exakt och misslyckas om den inte stämmer med `package.json` |
| Kontroller | `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test -- --runInBand`, i den ordningen och som separata steg | Samma kommandon som i README, och ett misslyckat steg syns för sig |
| Hemligheter | Inga | Inga tjänster anropas |

**Versioner av actions:**
- `actions/checkout` och `actions/setup-node` pinnas till den aktuella major-versionen enligt GitHubs officiella dokumentation.
- Versionerna kontrolleras när arbetsflödet skrivs i 8a. Inga versioner antas i förväg.
- Om de ska pinnas med SHA avgörs i Ö3.

**Inte med i CI** (Ö1):
- **`npx expo install --check` och `npx expo-doctor`:** De frågar Expos tjänster om aktuella versioner. När Expo publicerar en ny patch kan CI bli rött utan att koden har ändrats, vilket hände i steg 5a. De körs fortsatt manuellt före och efter ändringar av beroenden.
- **`git diff --check`:** Det är inget script i projektet. Det skulle dessutom flagga Markdown-undantaget nedan. Det körs fortsatt manuellt före commit.

## 4. Undantag och beslut som dokumenteras

**Markdown-undantag för `git diff --check` (ägarbeslut 2026-10-27):**
- `git diff --check origin/main..d242124` gav fyra anmärkningar.
- Alla fyra finns i `Assigments/Assigment 3/upg.md`, på rad 3, 12, 17 och 20. Varje rad slutar med **exakt två mellanslag** efter text, utan tabbar och utan CRLF. Det är avsiktliga radbrytningar i Markdown.
- Ägaren har accepterat **just de fyra anmärkningarna**. Filen är oförändrad, och inga Git-inställningar är ändrade.
- Alla andra anmärkningar från `git diff --check` är fortfarande fel. Hela kontrollen ska därför inte beskrivas som godkänd när undantaget förekommer.
- CI påverkas inte, eftersom `git diff --check` inte ingår i CI.

**Sparade vapenprofiler (ägarbeslut 2026-10-27, tidigare dokumenterat bara i `implementation/step-2-domain-validation.md`):**
- Vapentyp är en fast lista (B2).
- Namn och kaliber är fritext per session och sparas i sessionsraden som en **historisk kopia**.
- Sparade vapenprofiler, som beskrivs i `CLAUDE.md`, blir ett **eget steg efter steg 0–8**.
- **Historiska sessioner behåller sina egna inställningar.** Att skapa, ändra eller ta bort en profil får aldrig ändra en redan sparad session.
- Ordning enligt ägaren: först CI (steg 8), sedan design och detaljplan för vapenprofiler.
- Poängdiametern i profilen tas inte med förrän källan till nominella diametrar är beslutad (öppen fråga 3 i `CLAUDE.md`).

## 5. Delsteg

| Delsteg | Filer | Ändring | Verifiering | Klart när |
| --- | --- | --- | --- | --- |
| **8a** | `.github/workflows/ci.yml` | Arbetsflödet enligt §3 | (1) De aktuella versionerna av actions kontrolleras i GitHubs dokumentation. (2) Lokalt: en ren klon i scratchpad, med `npm ci` och de fyra kontrollerna i följd från `apps/mobile`, med Node 26. Det visar att installationen från lockfilen fungerar utan befintlig `node_modules` och utan godkända installationsskript. (3) YAML-syntax med `python3 -c 'import yaml…'` om PyYAML finns, annars med Prettier, som läser YAML. | Den lokala ekvivalenta körningen ger exit 0 för alla steg |
| **8b** | `README.md` (avsnittet Checks), `PLAN.md` (status för steg 8, steg 8-avsnittet, vapenprofiler och Markdown-undantaget), denna plan | En mening i README om att CI kör samma fyra kontroller vid PR och push till `main`. Status och faktiska resultat. | Dokumentationskontroller och `git diff --check`, med undantaget ovan | Dokumentationen beskriver bara det som faktiskt finns |
| **8c** | – | Ägaren pushar branchen eller ber mig göra det, och öppnar en PR. Den första körningen i GitHub Actions blir den verkliga verifieringen. | Resultatet från GitHub Actions för PR:n, som ägaren rapporterar eller som jag läser om `gh` finns | CI är grönt på PR:n. Om det är rött redovisas felet innan något ändras. |

**Nya beroenden:** inga i projektet. Arbetsflödet använder bara `actions/checkout` och `actions/setup-node` från GitHub.

**Risker:**
- **Node 26 i `setup-node`:** Att `.nvmrc` med `26` ger en Node 26-version i GitHub Actions kontrolleras i 8c.
- **Installationsskript i en ren miljö:** Kontrolleras i 8a. Om `npm ci` eller lint misslyckas redovisas det, och inga skript godkänns och inga beroenden uppgraderas utan beslut.
- **Ubuntu jämfört med macOS:** Jest och ESLint är inte plattformsberoende i det här projektet. En skillnad syns först i 8c.

## 6. Beslut (ägaren, 2026-10-27)

| # | Beslut |
| --- | --- |
| Ö1 | `npx expo install --check` och `npx expo-doctor` ligger **utanför CI** och körs manuellt vid ändringar av beroenden. **Avvikelse från den ursprungliga planen i `PLAN.md`**, som tog med `expo install --check` i CI. Skälet är att båda beror på Expos tjänster och kan bli röda vid en ny Expo-patch utan att koden har ändrats (steg 5a). |
| Ö2 | Utlösare: `pull_request` mot `main` och `push` till `main`. Inget schema och **inte** `pull_request_target`. |
| Ö3 | Actions pinnas med verifierad fullständig commit-SHA, med en kommentar om motsvarande releaseversion. Kontrollerat mot respektive officiellt repository (§8). |
| Ö4 | CI blir ett krav för sammanslagning efter att den första körningen i GitHub har verifierats i 8c. Ägaren får instruktioner då. |

## 7. Nästa delsteg

8c: commit, push av `feature/ci`, PR mot `main` och verifiering av den första körningen i GitHub Actions. Ägaren slår ihop PR:n. Därefter får ägaren instruktioner för att göra CI till ett krav för sammanslagning (Ö4).

## 8. Resultat för 8a (2026-10-27)

**Arbetsflödet** (`.github/workflows/ci.yml`):
- Ett jobb, `checks`, på `ubuntu-latest` med `timeout-minutes: 15`, `permissions: contents: read` och `working-directory: apps/mobile`.
- Utlösare: `pull_request` och `push`, båda bara för `main`.
- **Samtidighet:**
  - Gruppen är `<workflow>-<PR-nummer eller ref>`, så olika PR:er och brancher hålls isär.
  - `cancel-in-progress` gäller bara för `pull_request`. En äldre körning för samma PR avbryts, men körningar på `main` avbryts aldrig.
- **Steg:**
  1. utcheckning
  2. Node från `apps/mobile/.nvmrc`, med npm-cache och `cache-dependency-path: apps/mobile/package-lock.json`
  3. visning av Node- och npm-version
  4. `npm ci`
  5. `format:check`
  6. `lint`
  7. `typecheck`
  8. `npm test -- --runInBand`.
- **`persist-credentials: false`** vid utcheckningen. Jobbet skriver aldrig till Git, så token sparas inte i Git-konfigurationen.

**Versioner av actions** (kontrollerade 2026-10-27 mot de officiella repositoryna):

| Action | Senaste release (`/releases/latest`) | Commit-SHA |
| --- | --- | --- |
| `actions/checkout` | v7.0.1 (2026-07-20, inte prerelease) | `3d3c42e5aac5ba805825da76410c181273ba90b1` |
| `actions/setup-node` | v7.1.0 (2026-10-08, inte prerelease) | `949feb2413d6458794dcd2491c4babbbce0c15c1` |

- SHA:erna är kontrollerade på två sätt: med `git ls-remote --tags` mot `github.com/actions/<namn>.git`, där taggarna pekar direkt på en commit, och med GitHubs API (`/commits/<tag>`). Båda gav samma SHA.
- Indata kontrollerades i `action.yml` vid just dessa SHA:er:
  - `setup-node`: `node-version-file`, `cache` och `cache-dependency-path` finns
  - `checkout`: `persist-credentials` finns.
- Båda kör på `node24`.

**Lokal verifiering** (inte GitHub Actions):
- **Ren klon:** `git clone --no-local --branch feature/ci` till scratchpad.
- **Rätt kodversion:** Klonens `HEAD` är `2316871`, samma som repots `HEAD`. Lockfilens blob i klonen (`97ef88d…`) är densamma som i `HEAD:apps/mobile/package-lock.json`. Det fanns ingen `node_modules` före installationen.
- **Ej committade filer:** Planfilerna och arbetsflödet ingick inte i klonen och påverkar inte kontrollerna. De är oförändrade i arbetskatalogen.
- **Versioner:** Node v26.12.1 och npm 11.20.0, enligt `node --version` och `npm --version` i klonen. `.nvmrc` innehåller `26`.

| Steg | Resultat |
| --- | --- |
| `npm ci` | exit 0. 1317 paket installerade på cirka 7 s, med lokal npm-cache. |
| `npm run format:check` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm test -- --runInBand` | exit 0. 25 sviter, 482 av 482 godkända. |
| Klonens arbetskatalog efter körningen | Oförändrad. `git status` var tom. |

**Syntax:** YAML-filen tolkas av PyYAML till de avsedda utlösarna (inget `pull_request_target`), rättigheterna och stegen. Prettier godkänner formatet. `actionlint` finns inte och har inte installerats.

**Varningar från `npm ci`** (redovisade, inget ändrat):
- **Installationsskript:** `npm warn install-scripts`: tre paket har installationsskript som inte omfattas av `allowScripts`: `@parcel/watcher@2.6.0`, `fsevents@2.3.3` och `unrs-resolver@1.12.2`. Inga skript är godkända och inga säkerhetsinställningar är ändrade. Lint och tester går igenom ändå, alltså samma läge som tidigare.
- **Föråldrade paket:** 11 varningar av typen `npm warn deprecated` (bland annat `glob@7.2.3` och `glob@10.5.0`), från indirekta beroenden.
- **`npm audit`:** **3 high severity vulnerabilities**. Det är inte utrett eller åtgärdat här. `npm audit` ingår inte i CI, och inga beroenden har uppgraderats (ägarbeslut: inga breda uppgraderingar för nya varningar). Det bör tas upp som en egen fråga.

**Skillnader mot GitHub Actions** (kontrolleras i 8c):
- **Node-version:** `setup-node` väljer den senaste 26.x-versionen på runnern, så den kan skilja sig från lokala 26.12.1. Det loggas i steget "Show Node and npm versions".
- **Plattform:** Ubuntu i stället för macOS. `fsevents` installeras inte på Linux.
- **Cache:** Runnern har ingen lokal npm-cache vid första körningen.
- **Ingen körning i GitHub Actions** är gjord. Den riktiga verifieringen återstår till 8c.

## 9. Separat fråga: `npm audit` (analys 2026-10-28, inget åtgärdat)

`npm audit` från `apps/mobile` ger 3 high och 11 low. Det kördes skrivskyddat: lockfilen var oförändrad och inga beroenden ändrades. `npm audit fix` har inte körts.

**Fakta:**
- **Ett grundfynd:** De tre high-raderna (`zod`, `@expo/cli` och `expo`) beror på **samma advisory**, [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) (CVE-2023-54404). npm räknar den en gång per paket i kedjan.
  - Innehåll: "Zod can exhaust memory while validating oversized constrained collections".
  - Gäller `zod < 4.6.6` och är åtgärdad först i **4.6.6**.
  - CVSS 3.1 7,5 med vektorn `AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H`. Det betyder att bara tillgängligheten påverkas, genom att processen kraschar av brist på minne. Konfidentialitet och integritet påverkas inte.
- **Kedjan:** `expo@58.0.20` → `@expo/cli@58.1.16` → `zod@3.25.76`.
  - `@expo/cli` kräver `zod ^3.25.76`, och det finns ingen åtgärdad 3.x-version.
  - `zod@3.25.76` används också av `eslint-config-expo` → `eslint-plugin-react-hooks@7.1.1`, vars intervall är `^3.25.0 || ^4.0.0`. npm räknar inte den kedjan som berörd, eftersom intervallet tillåter en åtgärdad version.
- **Var `zod` används i `@expo/cli`:** bara i `start/server`, för DevTools-tillägg (`DevToolsPlugin.schema.js` och `createMCPDevToolsExtensionSchema.js`). Den validerar konfigurationen och resultaten från installerade DevTools-plugins och MCP-verktyg i utvecklingsservern.
- **Appens runtime:**
  - Appens källkod importerar inte `zod`. Det utelämnades i B6.
  - Android-bundlen från den senaste exporten innehåller ingen förekomst av strängen `zod`.
  - Fyndet gäller alltså **utvecklingsverktyg**, inte appen på telefonen.
- **CI:**
  - CI kör `npm ci`, Prettier, `expo lint`, `tsc` och Jest mot repots egna filer.
  - Det är inte utrett om `expo lint` laddar DevTools-delen av `@expo/cli`.
  - I CI är indata ändå repots eget innehåll. Den som kan ändra repot kan redan köra godtycklig kod via tester eller scripts. En minneskrasch tillför då ingen ny risk, och CI har bara läsrättigheter.
- **Den rättning npm föreslår är inte användbar:**
  - `npm audit` föreslår `expo@51.0.39` (`isSemVerMajor: true`). Det är en nedgradering av SDK 58 till SDK 51.
  - Den skulle bryta projektets versionsval och kräva en omfattande ändring.
  - Den senaste `@expo/cli` (58.1.16) och den senaste `expo` (58.0.20) är redan installerade och kräver fortfarande `zod ^3`.

**Osäkert:**
- **Om det går att utnyttja under utveckling.** Det kräver att någon får utvecklingsservern att validera en mycket stor array som någon annan styr. Indata kommer från lokalt installerade DevTools-plugins eller MCP-klienter. Projektet har inga sådana plugins installerade, men det är inte kontrollerat om utvecklingsservern tar emot sådan data från nätverket när `expo start` körs på LAN.
- **Följden:** I värsta fall kraschar utvecklingsservern. Inga data läcker och inga ändras enligt CVSS-vektorn.
- Om en framtida patch av `@expo/cli` går över till `zod 4.6.6+` är inte känt.

**Möjliga vägar (beslut krävs, inget görs nu):**
1. **Acceptera och bevaka.** Uppgradera när Expo publicerar en `@expo/cli` med åtgärdad `zod`, och kontrollera vid varje manuell `expo install --check`.
2. **`overrides` som tvingar `zod@4.6.6`.** Det är riskabelt, eftersom `@expo/cli` är skriven för `zod` 3 och API:et ändrades i 4. Det föreslås inte.
3. **Nedgradera Expo enligt `npm audit`.** Det föreslås inte.

**De 11 low-fynden** kommer från `deepmerge`, [GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4) (prototype poisoning, CVSS 5,3). Det går via `@expo/config` och `jest-config`, alltså verktyg för konfiguration och tester. Det är inte utrett närmare.
