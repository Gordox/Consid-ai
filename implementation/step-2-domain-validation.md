# Detaljplan steg 2: domänmodeller, parsning och validering (ren TypeScript)

> **Status:** Godkänd och implementerad. Steg 2 är klart, med commits `6899b9a` (2a) till `c8cee73` (2f) och fixen av Jest-typerna `5822341`. Hermes-beteendet för `normalize` och `Intl` är ännu inte verifierat på Galaxy S20.

> **Numrering (2026-10-27):** Ett nytt steg 4 (UI/UX-design) har lagts till i `PLAN.md`, och tidigare steg 4–7 heter nu steg 5–8. Hänvisningarna till kommande steg i den här planen använder den nya numreringen.

> **Ägarbeslut om vapen (2026-10-27):** Planen behålls. Vapentyp är en fast lista (B2). Namn och kaliber är fritext per session och sparas som en historisk kopia. Sparade vapenprofiler, som beskrivs i `CLAUDE.md`, blir ett eget steg efter steg 0–8. Steg 2 påverkas inte.

## Kontext

Steg 0–1 är klara och sammanslagna med `main`. Arbetet sker på branchen `feature/session-domain-validation`. Steg 2 i `PLAN.md` ska ge en ren, deterministisk och testad domän för sessionsinställningar, som formuläret (steg 5) och radvalideringen (steg 3) sedan bygger på. Ingen UI, SQLite, Expo-integration, ID-generering eller klocka ingår. Inga beroenden, ingen Node-version och inga globala verktyg ändras.

## 1. Förutsättningar (kontrollerade, inga filer ändrade)

| Område | Observation | Följd |
| --- | --- | --- |
| `jest.config.js` | `preset: 'jest-expo'`, `testMatch: <rootDir>/tests/**/*.test.ts`, `passWithNoTests: false` | Domäntester läggs i `apps/mobile/tests/domain/*.test.ts` och hittas automatiskt. TypeScript transformeras av jest-expos Babel. |
| `tsconfig.json` | `strict`, `noUncheckedIndexedAccess`, `include: **/*.ts`, ingen `types`-begränsning | Testerna typkontrolleras, och Jest-globalerna kommer från `@types/jest`. Regex-grupper får typen `string \| undefined` och måste hanteras utan `!`. |
| `eslint.config.js` | Expos regler och `no-explicit-any`/`no-non-null-assertion` som fel. `no-undef` är avstängt för TS. | Testerna lintas. Inga casts behövs om ogiltiga värden testas via `unknown`. |
| Importer | Ingen sökvägsalias är konfigurerad | Relativa importer används och ingen konfiguration ändras. |
| Node 26 (Jest) | `new Date('2026-02-30T00:00:00.000Z')` blir **2026-03-02**. `…T24:00…` blir nästa dag. | Datum måste kontrolleras med strikt format **och** att datumet blir identiskt när det läses in och skrivs ut igen. |
| Node 26 `Intl` | `"europe/stockholm"` godtas, `"+01:00"` godtas, `"Foo/Bar"` och `""` ger `RangeError` | `Intl` räcker inte ensamt, utan formen måste också kontrolleras. |
| Unicode | `trim()` tar bort U+3000. `"é"` har 2 kodpunkter före och 1 efter NFC. `"👍🏽"` är 2 kodpunkter. | Bekräftar regeln om NFC och kodpunkter. |

**Konflikter och justeringar mot `PLAN.md` (nya förslag, inte beslutade):**
1. `createSession.ts` i domänen skulle få samma namn som `features/sessions/createSession.ts` i steg 5. **Förslag:** byt namn till `buildSession.ts`.
2. `Result` var tänkt att ligga i `session.ts`, men steg 3 behöver typen utan att importera sessionstyperna. **Förslag:** egen fil `src/domain/result.ts`.
3. `sessionId.ts` behöver också regler för UTC-tid och tidszon. **Förslag:** byt till `sessionMetadata.ts`.
4. `parseWholeNumber` med `Number.isSafeInteger` ersätts med en kontroll av antalet siffror (se 3d), så att mycket stora tal aldrig konverteras.
5. Hermes på S20 kan bete sig annorlunda än Node för `String.prototype.normalize` och `Intl.DateTimeFormat({ timeZone })`. **Förslag:** lägg till två punkter i S20-checklistan i steg 7. Jest-körningen bevisar bara beteendet i Node.

Inga konflikter med `CLAUDE.md`. Gränser definieras i ett kontrakt, inte som magiska tal. Tid och ID injiceras. Ingen `any`. Förväntade fel returneras explicit.

## 2. Kontrakt (bara signaturer och typer)

```ts
// src/domain/result.ts
export type Result<T, E> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

// src/domain/session/firearmType.ts
export const FIREARM_TYPES = ['pistol', 'revolver', 'rifle', 'other'] as const;
export type FirearmType = (typeof FIREARM_TYPES)[number];
export function isFirearmType(value: unknown): value is FirearmType;

// src/domain/session/sessionLimits.ts
export type IntegerRange = { readonly min: number; readonly max: number };
export const FIREARM_NAME_MAX_CODE_POINTS = 100;
export const CALIBRE_LABEL_MAX_CODE_POINTS = 50;
export const DISTANCE_TENTHS_RANGE: IntegerRange = { min: 1, max: 10_000 }; // 0.1–1000 m
export const PLANNED_SHOTS_PER_ROUND_RANGE: IntegerRange = { min: 1, max: 100 };
export const PLANNED_ROUNDS_RANGE: IntegerRange = { min: 1, max: 100 };

// src/domain/session/parseText.ts
export function normalizeLabel(raw: string): string;      // NFC, sedan trim
export function codePointLength(value: string): number;
export type TextError = 'required' | 'tooLong';
export function parseLabel(raw: string, maxCodePoints: number): Result<string, TextError>;

// src/domain/session/parseNumber.ts
export type WholeNumberError = 'required' | 'invalidNumber' | 'outOfRange';
export type DistanceError = WholeNumberError | 'tooManyDecimals';
export function parseWholeNumber(raw: string, range: IntegerRange): Result<number, WholeNumberError>;
export function parseDistanceMetres(raw: string): Result<number, DistanceError>;
// Regler för redan tolkade tal. Används av checkSessionSettings och av steg 3.
export function isWholeNumberInRange(value: number, range: IntegerRange): boolean;
export function isDistanceMetres(value: number): boolean;

// src/domain/session/session.ts (endast typer)
export type SessionFormInput = {
  readonly firearmName: string;
  readonly firearmType: string | null;
  readonly calibreLabel: string;
  readonly distanceMetres: string;
  readonly plannedShotsPerRound: string;
  readonly plannedRounds: string;
};
export type SessionField = keyof SessionFormInput;
export type SessionSettings = {
  readonly firearmName: string;
  readonly firearmType: FirearmType;
  readonly calibreLabel: string;
  readonly distanceMetres: number;
  readonly plannedShotsPerRound: number;
  readonly plannedRounds: number | null;
};
export type Session = {
  readonly id: string;
  readonly createdAtUtc: string;
  readonly createdTimeZone: string;
  readonly settings: SessionSettings;
};
export type SessionFieldError = 'required' | 'tooLong' | 'invalidNumber' | 'tooManyDecimals' | 'outOfRange' | 'unsupportedValue';
export type SessionFieldErrors = Partial<Record<SessionField, SessionFieldError>>;
// Kan bara uppstå för data som inte kommer från formuläret, t.ex. databasrader i steg 3:
export type SettingsFieldError = SessionFieldError | 'invalidType' | 'notNormalized';
export type SettingsFieldErrors = Partial<Record<SessionField, SettingsFieldError>>;

// src/domain/session/validateSessionInput.ts
export function validateSessionInput(input: SessionFormInput): Result<SessionSettings, SessionFieldErrors>;
export function checkSessionSettings(value: unknown): Result<SessionSettings, SettingsFieldErrors>;

// src/domain/session/sessionMetadata.ts
export function isSessionId(value: unknown): value is string;
export function isUtcTimestamp(value: unknown): value is string;
export function isTimeZone(value: unknown): value is string;

// src/domain/session/buildSession.ts
export type SessionMetadata = { readonly id: string; readonly createdAtUtc: string; readonly createdTimeZone: string };
export type SessionBuildErrors = {
  readonly id?: 'invalidId';
  readonly createdAtUtc?: 'invalidTimestamp';
  readonly createdTimeZone?: 'invalidTimeZone';
  readonly settings?: SettingsFieldErrors;
};
export function buildSession(settings: SessionSettings, metadata: SessionMetadata): Result<Session, SessionBuildErrors>;
```

**Ansvarsfördelning, utan cirkulära importer:**
- **Importerar ingenting:** `result.ts`, `firearmType.ts`, `sessionLimits.ts` och `sessionMetadata.ts`.
- **`parseText.ts` och `parseNumber.ts`** (importerar bara `result` och `sessionLimits`) tolkar *ett* råvärde. De sköter trim, form och intervall och returnerar *ett* fel per fält.
- **`validateSessionInput`** sätter ihop fälten. Den avgör att ett tomt `plannedRounds` blir `null` innan den anropar `parseWholeNumber`, och den samlar alla fältfel. Den har inga egna regler.
- **`checkSessionSettings(unknown)`** kontrollerar redan tolkade värden: typer, att text redan är normaliserad (`value === normalizeLabel(value)`), längder, enum och samma talregler (`isWholeNumberInRange`, `isDistanceMetres`). Den används av `buildSession` och senare av steg 3.
- **`buildSession`** kontrollerar metadata och kör `checkSessionSettings`. Fel samlas, och resultatet är ett nytt objekt.
- Inga klasser, ingen brandad typ och inga hjälpbibliotek. Alla gränser kommer från `sessionLimits.ts`.

## 3. Förtydliganden

**Gällande beslut (oförändrade):**
- NFC och trim, längd i kodpunkter.
- `,` och `.` godtas som decimaltecken, med högst en decimal för distans.
- Inledande nollor tillåts.
- Tomt antal rundor blir `null`.
- Alla fältfel returneras samtidigt.
- Ingen trunkering eller avrundning.

**Nya förslag:**

a. **Trim av talfält:** Ja, med samma `trim()` före tolkningen, så `" 25.5 "` blir 25.5. Blanksteg *inne i* talet ger `invalidNumber`.

b. **Felkoder** (en per fält, i den ordning de kontrolleras):

| Kod | Används när |
| --- | --- |
| `required` | Obligatoriskt fält är tomt efter trim. Vapentyp är `null` eller `""`. |
| `invalidNumber` | Formen är inte ett tillåtet tal. Heltalsfält med decimal (`1.0`, `1,5`). |
| `tooManyDecimals` | Bara distans: korrekt form men två eller fler decimaler (`25,55`, `1.000`, `1.10`). |
| `outOfRange` | Korrekt form men värdet ligger utanför gränsen, även `0` och mycket långa siffersträngar. |
| `tooLong` | Text som är längre än gränsen efter NFC och trim. |
| `unsupportedValue` | Vapentyp som inte finns i `FIREARM_TYPES`. Jämförelsen är skiftlägeskänslig, så `"Pistol"` ger detta fel. |

c. **Distansregex:** Formen kontrolleras med `^(\d+)(?:[.,](\d+))?$`, där `\d` bara matchar ASCII-siffror eftersom `u`-flaggan inte används.
- Ingen träff ger `invalidNumber`.
- En decimaldel med två eller fler siffror ger `tooManyDecimals`.
- Annars beräknas värdet i tiondelar som heltal, kontrolleras mot intervallet och returneras som `tenths / 10`.
- Det betyder att `1.000` ger `tooManyDecimals` och inte tolkas som tusentalsavgränsare. Feltexten "högst en decimal" stämmer för båda tolkningarna.

d. **Långa siffersträngar:** Inledande nollor tas bort. Om fler siffror återstår än i gränsens maxvärde (3 för 100, 4 för 1000) blir resultatet `outOfRange` utan konvertering till `Number`. Därmed blir varken 20-siffriga tal eller tal över `MAX_SAFE_INTEGER` osäkra. Strängen `"000"` blir 0, vilket ger `outOfRange`.

e. **UUID:** Bara kanonisk UUID v4 med gemener godtas: `^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`.
- Versaler, klammerparenteser, avsaknad av bindestreck, nil-UUID och andra versioner avvisas.
- Ingen normalisering görs, så att varianter av samma ID inte kan bli dubbletter.
- Det matchar `expo-crypto` `randomUUID()` i steg 5.

f. **`createdAtUtc`:** Exakt formatet `YYYY-MM-DDTHH:mm:ss.sssZ`, alltså samma form som `toISOString()` ger, kontrolleras med regex.
- Dessutom måste `new Date(value).toISOString() === value` gälla. Det avvisar `2026-02-30`, `2026-04-31`, `T24:00` och `2026-13-01` utan tyst normalisering.
- Skottdagen `2024-02-29` godtas.
- Värden utan millisekunder, med offset eller med mellanslag i stället för `T` avvisas.

g. **`createdTimeZone`:** Ja, tidszonen ska kontrolleras som en giltig zon. Två villkor måste gälla:
- Formen följer `^[A-Za-z][A-Za-z0-9_+\-]*(?:\/[A-Za-z0-9_+\-]+)*$` och är högst 64 tecken. Det avvisar `"+01:00"`, `""` och blanksteg.
- `new Intl.DateTimeFormat('en-US', { timeZone })` kastar inget fel. Det avvisar `"Foo/Bar"`.

Värdet sparas som det angavs, utan kanonisering. Begränsning: tidszonsdata beror på motorn, och Hermes verifieras i steg 7.

h. **`buildSession`:** Funktionen returnerar `Result` med samlade, typade fel och kastar inte. Det följer `CLAUDE.md`: förväntade domänfel returneras explicit. Steg 5 avgör hur ett fel visas.

i. **Typer räcker inte vid körning:** `buildSession` anropar alltid `checkSessionSettings`, som tar emot `unknown`. Ett `SessionSettings`-objekt som har rätt typ men ogiltiga värden (t.ex. `distanceMetres: 0.15`, `plannedRounds: 0`, `firearmName: " x"`) stoppas därför. Ingen brandad typ används.

j. **Mutation:** Inga indata ändras, och alla resultat är nya objekt.

k. **Osynliga tecken:** Text som bara består av t.ex. U+200B eller styrtecken hanteras inte särskilt. Den räknas som 1 kodpunkt och godtas. Det dokumenteras som en känd begränsning och kan ändras senare om du vill.

Inget av förslagen ovan blockerar arbetet, och alla kan ändras.

## 4. Testmatris

Basinmatning `VALID`: `{ firearmName: '  Glock 17 ', firearmType: 'pistol', calibreLabel: '9×19 mm', distanceMetres: '25,5', plannedShotsPerRound: '10', plannedRounds: '' }`. Varje test ändrar ett fält om inget annat anges.

| Område | Indata | Förväntat |
| --- | --- | --- |
| Komplett | `VALID` | `ok`: `{ firearmName: 'Glock 17', firearmType: 'pistol', calibreLabel: '9×19 mm', distanceMetres: 25.5, plannedShotsPerRound: 10, plannedRounds: null }` |
| Vapennamn | `'A'` / 100 × `'a'` / 101 × `'a'` | ok / ok / `tooLong` |
| | `''` / `'   '` / `'　'` | `required` |
| | 100 × `'é'` (200 kodpunkter före NFC) | ok, och värdet är 100 × `'é'` |
| | 100 × `'👍'` / 101 × `'👍'` | ok / `tooLong` |
| | 50 × `'👍🏽'` / 51 × `'👍🏽'` (2 kodpunkter vardera) | ok / `tooLong` |
| Kaliber | 50 / 51 tecken, `''`, `'  '` | ok / `tooLong` / `required` / `required` |
| Distans, giltig | `'0.1'`, `'0,1'`, `'1'`, `'1000'`, `'1000.0'`, `'0001000'`, `' 25.5 '`, `'00000000000000000025'` | 0.1, 0.1, 1, 1000, 1000, 1000, 25.5, 25 |
| Distans, intervall | `'0'`, `'0.0'`, `'000'`, `'1000,1'`, `'1001'`, `'99999999999999999999'` | `outOfRange` |
| Distans, decimaler | `'0.09'`, `'25,55'`, `'1.000'`, `'1.10'` | `tooManyDecimals` |
| Distans, form | `'1 000'`, `'1,000.5'`, `'1e3'`, `'25.5m'`, `'-5'`, `'+5'`, `'.5'`, `'25.'`, `'25 .5'`, `'25.5.5'`, `'Infinity'`, `'NaN'`, `'0x10'`, `'２５'`, `'١٢'` | `invalidNumber` |
| Distans, tom | `''`, `'  '` | `required` |
| Skott/runda | `'1'`, `'100'`, `'007'`, `' 10 '` | 1, 100, 7, 10 |
| | `'0'`, `'101'`, `'9007199254740993'`, 1000 × `'9'` | `outOfRange` |
| | `'1.0'`, `'1,5'`, `'10abc'`, `'1e2'`, `'-1'`, `'+1'`, `'1 0'` | `invalidNumber` |
| | `''`, `'  '` | `required` |
| Rundor | `''`, `'   '` | `null`, aldrig `0` |
| | `'1'`, `'100'` / `'0'`, `'101'` / `'1.0'` | 1, 100 / `outOfRange` / `invalidNumber` |
| Vapentyp | `'pistol'`, `'revolver'`, `'rifle'`, `'other'` | ok |
| | `null`, `''` / `'Pistol'`, `'shotgun'`, `' pistol'` | `required` / `unsupportedValue` |
| Flera fel | Alla fält tomma | `{ firearmName: 'required', firearmType: 'required', calibreLabel: 'required', distanceMetres: 'required', plannedShotsPerRound: 'required' }` och inget fel för `plannedRounds` |
| | Namn med 101 tecken, `'shotgun'`, distans `'25,55'`, skott `'0'`, rundor `'abc'` | exakt fem fel med respektive kod |
| Mutation | `Object.freeze` på `VALID`, jämförs med en kopia efter anrop | kastar inget fel, indata oförändrade, resultatet är ett annat objekt |
| `checkSessionSettings` | Giltiga inställningar | ok |
| | `null`, `'x'`, `[]` | alla sex fält får `invalidType` |
| | `firearmName: ' x'` / `'é'` | `notNormalized` |
| | `distanceMetres: 0.15`, `NaN`, `Infinity`, `'25'` | `tooManyDecimals`, `invalidNumber`, `invalidNumber`, `invalidType` |
| | `plannedRounds: 0`, `1.5`, `undefined` | `outOfRange`, `invalidNumber`, `invalidType` (`null` är ok) |
| | `firearmType: 'shotgun'` | `unsupportedValue` |
| ID | `'3f2504e0-4f89-41d3-9a0c-0305e82c3301'` | giltigt |
| | `''`, versaler, `'{…}'`, utan bindestreck, nil-UUID, v1 `'…-11d3-…'`, variant `'…-41d3-7a0c-…'`, `42` | ogiltigt |
| UTC | `'2026-10-27T13:00:00.000Z'`, `'2024-02-29T00:00:00.000Z'` | giltigt |
| | `'2026-02-30T00:00:00.000Z'`, `'2026-04-31T10:00:00.000Z'`, `'2026-01-01T24:00:00.000Z'`, `'2026-13-01T00:00:00.000Z'`, `'2026-10-27T13:00:00Z'`, `'2026-10-27T14:00:00.000+01:00'`, `'2026-10-27 13:00:00.000Z'`, `'2026-10-27T13:00:00.000'`, `''` | ogiltigt |
| Tidszon | `'Europe/Stockholm'`, `'UTC'`, `'America/Argentina/Buenos_Aires'` | giltig |
| | `''`, `'Foo/Bar'`, `'+01:00'`, `' Europe/Stockholm'`, 65 tecken, `42` | ogiltig |
| `buildSession` | Giltiga inställningar och metadata | `ok`, med samma id, tid och tidszon och inställningar som är lika men i ett nytt objekt |
| | Ogiltigt id, ogiltig tid och ogiltig tidszon samtidigt | alla tre felen i `error` |
| | `distanceMetres: 0.15` med rätt typ | `error.settings.distanceMetres === 'tooManyDecimals'` |

Testerna kontrollerar beteendet utifrån: indata leder till förväntat utdata eller förväntad felkod. De kontrollerar inte regex eller interna funktioner, och de behöver inget nätverk, ingen databas och ingen klocka. `Intl` och `Date` i Node används för tidszon och tid, och det täcker bara Node.

## 5. Implementationsordning

Efter varje delsteg körs `npm run format:check`, `npm run lint`, `npm run typecheck` och `npm test -- --runInBand` i `apps/mobile`. Inget delsteg räknas som klart förrän alla fyra ger exit 0.

| Delsteg | Filer | Ansvar | Tester | Klart när |
| --- | --- | --- | --- | --- |
| 2a. Grundtyper | `src/domain/result.ts`, `src/domain/session/firearmType.ts`, `sessionLimits.ts` | `Result`, vapentyper och alla gränser | `tests/domain/firearmType.test.ts` (fyra giltiga typer, okända värden och icke-strängar) | Testet går igenom, och `npm test` hittar nu tester |
| 2b. Text | `parseText.ts` | `normalizeLabel`, `codePointLength`, `parseLabel` | `tests/domain/parseText.test.ts` (textraderna i matrisen) | Raderna för text och Unicode går igenom |
| 2c. Tal | `parseNumber.ts` | `parseWholeNumber`, `parseDistanceMetres`, `isWholeNumberInRange`, `isDistanceMetres` | `tests/domain/parseNumber.test.ts` (alla talrader) | Alla tal- och formatrader går igenom |
| 2d. Formulärvalidering | `session.ts`, `validateSessionInput.ts` | Typer, `validateSessionInput` och `checkSessionSettings` | `tests/domain/validateSessionInput.test.ts` (komplett inmatning, flera fel, `null` för rundor, mutation) och `tests/domain/checkSessionSettings.test.ts` | Alla fältfel samlas och inga regler är duplicerade |
| 2e. Metadata och session | `sessionMetadata.ts`, `buildSession.ts` | `isSessionId`, `isUtcTimestamp`, `isTimeZone`, `buildSession` | `tests/domain/sessionMetadata.test.ts`, `tests/domain/buildSession.test.ts` | Raderna för ID, UTC, tidszon och `buildSession` går igenom |
| 2f. Dokumentation | `PLAN.md` | Steg 2 uppdateras med de faktiska filnamnen och kontrakten. Statusen sätts till klart. Två punkter läggs till i S20-checklistan i steg 7: att `normalize` och `Intl`-tidszon fungerar i Hermes. | `grep` visar att domänen inte importerar `react-native`, `expo` eller `sqlite` | Alla fyra slutkontroller ger exit 0, och resultaten redovisas med exakta kommandon |

Alla filer under `src/domain/session/` ligger i `apps/mobile/`. Inga commits görs utan att du ber om det.

## Verifiering

```
cd apps/mobile
npm run format:check
npm run lint
npm run typecheck
npm test -- --runInBand
grep -rnE "from '(react|react-native|expo|expo-[a-z-]+)'" src/domain   # ska inte ge några träffar
```

Resultaten redovisas som de faktiskt blev. Hermes-beteendet för `normalize` och `Intl` verifieras inte här, utan på S20 i steg 7.
