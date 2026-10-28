# Utvärdering av träffförslag

Status 2026-10-28: **Analysen är bara utvärderad på syntetiska bilder. Inget riktigt foto har analyserats.** Inget här visar att analysen fungerar på riktiga foton.

## Syntetiskt resultat

Källa: `services/analysis/tests/synthetic.py`.

**Vad bilderna innehåller:**
- En tavla med tio ringar, svart område för 7–10 och siffror på axlarna.
- Sex gamla hål täckta med klistermärken i bakgrundens färg, med synliga kanter.
- Fem nya, trasiga hål som är 36 px i bild.
- Före- och efter-bild, var och en med eget perspektiv, ljusgradient, oskärpa, brus och JPEG-komprimering.
- Kalibreringstryck med ±3 px spridning.

De nya hålen hålls borta från sifferkolumnerna.

**Resultat:**

| Läge | Rundor | Nya hål | Hittade | Falska förslag | Tid per bild (Mac med M-serien) |
| --- | --- | --- | --- | --- | --- |
| Före + efter | 10 | 50 | 50 | 2 | ~0,7 s |
| Bara efter | 10 | 50 | 47 | 4 | ~0,5 s |

**Dessutom verifierat:**
- Två överlappande hål blir ett osäkert förslag.
- Inga nya hål ger `succeeded` utan kandidater.
- En före-bild utan tavlan ger `registrationFailed`.
- En JPEG med EXIF-orientering 6 analyseras rättvänd.
- Appens parser godtar serverns riktiga HTTP-svar i båda lägena.

**Gränser i de automatiska testerna** (6 syntetiska rundor):
- Före + efter: minst 90 % hittade och minst 90 % korrekta förslag.
- Bara efter: minst 85 % hittade och minst 80 % korrekta förslag.

Gränserna skyddar bara mot regressioner. De är inga acceptanskriterier.

## Vad de syntetiska bilderna inte täcker

- Riktig papperstextur, trasiga fibrer och hål som inte visar underlaget tydligt.
- Riktiga klistermärken: glans, uppvikta kanter och hål genom märken.
- Hålens egna skuggor, ojämnt ljus, blänk på blanka märken och rörelseoskärpa.
- Före- och efter-bilder tagna långt ifrån varandra eller med olika zoom.
- Den riktiga tavlans tryck, färger och sifferplacering.
- Hål i sifferkolumnerna. Läget med bara efter-bild letar inte där.

## Bilder som behövs från S20

Ta dem med S20 som JPEG, med hela tavlan i bild, från ungefär samma plats före och efter.

1. **5–10 rundor som före/efter-par**, helst från minst två olika sessioner. Läget med bara efter-bild använder samma efter-bilder.
2. **Minst en av varje:**
   - hål i vitt och i svart område
   - hål genom ett klistermärke
   - två överlappande hål
   - hål som rör en ringlinje
   - hål i en sifferkolumn
   - snett tagen bild, cirka 30°
   - skugga eller blänk
   - lätt suddig bild
3. **Facit per runda:** antal skott, och var varje hål sitter (ringvärde eller en skärmdump från appen med hålen markerade för hand).

**Hantering av bilderna:**
- Bilderna stannar på datorn. Mappen `services/analysis/evaluation-photos/` ignoreras av Git, och bilderna committas inte.
- Dela upp dem per session i bilder för justering och bilder för utvärdering.

## Att mäta när riktiga bilder finns

För varje läge, på samma efter-bilder:
- andelen hittade hål och andelen korrekta förslag, mot facit
- andelen avvisade analyser (`registrationFailed` och `unusableImage`)
- hur ofta poängen från godkända förslag skiljer sig från facit
- korrigeringstiden i appen
- tiden per analys.

Acceptansgränser föreslås utifrån de siffrorna. Inga är överenskomna ännu.
