# Beslut: gränsträffar, innertia, håldiameter och demomärkning

Datum: 2026-10-28. Beslutat av: ägaren.

## Beslut

1. **En träff som berör gränsen mellan två poängzoner räknas till det högre värdet.**
   - En träff som rör gränsen mellan 6 och 7 ger 7.
   - Det gäller redan i appen som regeln `contact-highest-v1`.
2. **Innertian ger inga extra poäng och ingen särskild statistik**, tills vidare.
   - Tian räknas som 10 oavsett om innertian berörs.
3. **Håldiametern är ett uttryckligt antagande som du bekräftar eller ändrar.**
   - Den härleds aldrig automatiskt från kalibertexten.
4. **Demomärkningen finns kvar** tills tavelspecifikationen är verifierad.

## Hur besluten tillämpas

**Gränsträff:**
- Ett skott med centrumavståndet `d` och diametern `D` berör zonen med ytterradien `R` när `d − D/2 ≤ R`.
  - Den högsta zonen som berörs gäller.
  - `ε = 1e-9 mm` tar bara bort flyttalsbrus och är ingen tolerans.
- **Den tryckta ringlinjen räknas som gräns.**
  - En zons ytterradie är därför ytterkanten på dess ringlinje.
  - En träff som rör linjen får det högre värdet.
  - Mätmallen (`docs/target-calibration.md` §4) mäter ytterkanterna.

**Innertian:**
- Den är inte en zon i tavlans definition.
- Den påverkar inte poäng, summeringar eller bekräftade resultat.

**Håldiametern:**
- En ny session börjar med 9,0 mm, märkt `Assumed, not set`, med kaliberetiketten bredvid som upplysning.
- Om du ändrar eller bekräftar värdet sparas det som `userSet` och förs vidare till nästa runda i sessionen.
- Ett bekräftat resultat sparar diametern och dess källa. Om diametern var ett antagande står det i resultatet.

**Demomärkning:**
- Poäng på `demo-synthetic-v1` märks som demo överallt.
- Demopoäng summeras aldrig ihop med poäng på en verifierad tavla.

## Följder

- Bekräftade rundor räknas aldrig om när regler eller tavlor ändras.
- En verifierad tavla läggs in som en ny tavelversion. Demorundor förblir demo.
