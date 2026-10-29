# Demo: Target Practice (högst 3 minuter)

**Repetition och faktisk tidsåtgång är din uppgift.** Upplägget nedan är inte provat; tiderna är planerade, inte uppmätta.

## Förberedelser

- Release-APK:n installerad på S20, eller Expo Go om du visar analysen.
- En förberedd session ("Demo") med en bekräftad runda, och ett foto av tavlan i telefonens bibliotek, så att ingen tid går åt till att skjuta eller fota.
- Skärmspegling av telefonen (till exempel scrcpy, Samsung DeX eller kamera över telefonen), provad i lokalen.

**Om du vill visa lokal serveranalys** (kräver utvecklingsläge, inte release-APK:n):
1. Dator och telefon på samma betrodda Wi-Fi. Gästnät blockerar ofta trafik mellan enheter.
2. `apps/mobile/.env.local` med `EXPO_PUBLIC_ANALYSIS_URL=http://<datorns-LAN-adress>:8000`.
3. Servern startad med `python -m uvicorn app.main:app --host 0.0.0.0 --port 8000` i `services/analysis`, och `npx expo start --clear` i `apps/mobile`.
4. Kontrollera `http://<datorns-LAN-adress>:8000/health` i telefonens webbläsare före presentationen.

**Reserv:** fungerar inte nätverket visar du det manuella flödet i release-APK:n (**Mark hits manually**). Det är samma flöde utan förslag.

## 0:00–1:40 Appens kärnflöde (live)

| Tid | Visa | Säg |
| --- | --- | --- |
| 0:00–0:15 | Sessionslistan | "En app för att logga skjutträning mot papperstavla, utan att föra poäng för hand." |
| 0:15–0:35 | Öppna "Demo", **Start round**, **Add photos** → **Library** | Fotot kopieras och rättvänds utan platsdata. |
| 0:35–0:55 | **Align target**: fyra punkter på ytterringen | Kalibreringen gör poängen oberoende av vinkeln. |
| 0:55–1:20 | **Analyse photos** (eller **Mark hits manually**), sedan **Review hits**: godkänn, flytta, ta bort | Förslag räknas aldrig förrän du godkänt dem. |
| 1:20–1:40 | **Review round** → **Confirm round** → sessionens summering | "Poängen är demopoäng tills tavlans mått är verifierade." |

## 1:40–2:25 Hur Claude hjälpte: tangentbordet som dolde fälten

- **Problem:** på S20 dolde tangentbordet de nedersta fälten i formuläret för ny session, och de gick inte att skrolla fram (`docs/bugs/keyboard-covers-lower-form-fields.md`).
- **Vad Claude gjorde:** formulerade hypoteser (H1: ytan krymper inte; H2: fältet skrollas inte fram; H3: Expo Gos manifest), lade in tillfällig mätning i utvecklingsläge som loggade höjder utan formulärvärden, och lät mig köra den på telefonen.
- **Resultat:** mätningen stödde H1. Rättningen var `KeyboardAvoidingView` med `behavior="padding"`; diagnostiken togs bort och sluttestet på S20 gick igenom. Rotorsaken på plattformsnivå (H3) är fortfarande öppen, och det står i rapporten.
- **Poängen:** Claude gissade inte en fix. Felet ringades in med mätning på riktig enhet, och det som inte är bevisat är dokumenterat som obevisat.

Alternativt exempel från samma vecka: analysen nådde aldrig servern. Med tre korta test i DevTools ringade vi in att Expo SDK 58:s `fetch` vägrar React Natives filbilagor; rättningen fick ett regressionstest.

## 2:25–3:00 Vad jag gör annorlunda nästa gång

- Bygga och installera en fristående APK tidigt och prova på telefonen efter varje steg, i stället för att samla telefontester till slutet.
- Få fram tavlans verkliga mått och riktiga testfoton med facit innan analysen byggs, så att precisionen kan mätas.
- Pusha oftare så att CI kör på varje steg, i stället för många lokala commits.
