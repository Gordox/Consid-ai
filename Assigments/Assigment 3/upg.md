# Hemuppgift 3 – Felsökning med Claude Code

**Problemet och kontexten**  
I min React Native-/Expo-app dolde tangentbordet de nedersta formulärfälten och knappen ”Create session”. De gick inte att skrolla fram. Felet upptäcktes vid manuell testning på Galaxy S20 i Expo Go med Hermes. Jag gav Claude buggbeskrivningen och testmiljön samt bad agenten undersöka kod och konfiguration utan att rätta något. Kodhistoriken visade att formuläret inte hade ändrats under det senaste arbetet med sessionslistan.

**Agentens hypoteser**

1. Skrollytan krymper inte när tangentbordet öppnas, samtidigt som `KeyboardAvoidingView` saknar aktivt beteende på Android.
2. Skrollytan krymper, men fältet med fokus skrollas inte fram automatiskt.
3. Expo Gos konfiguration skiljer sig från en egen Android-build och orsakar beteendet.

**Mitt val och undersökningen**  
Jag valde H1 eftersom varken fälten eller knappen gick att skrolla fram manuellt. Jag lät agenten lägga till tillfällig diagnostik. Mätningen visade att skrollytans höjd var 778,1 dp både före och efter att tangentbordet öppnades. Detta stödde H1 och motsade H2:s antagande om en krympande yta.

Därefter provade vi en enda ändring: `behavior="padding"` även på Android. Ingen egen skrollningslogik lades till. Skrollytan minskade då till 522,7 dp och återställdes när tangentbordet stängdes.

**Vad som faktiskt var fel**  
I den testade miljön anpassades inte skrollytan till tangentbordet, vilket gjorde nederdelen av formuläret oåtkomlig. Padding åtgärdade det testade flödet. Efter att diagnostiken tagits bort verifierade jag att ”Planned rounds” syntes automatiskt, knappen gick att nå och inget extra tomrum blev kvar.

**Vad agenten fick rätt och missade**  
Agenten identifierade den relevanta layoutmekanismen och föreslog användbara mätningar. Däremot var den tidiga kopplingen till kant-till-kant och Expo Gos konfiguration inte verifierad. Agenten drog också en för stark slutsats från en mätning efter 300 ms om fältets synlighet; min senare observation visade att hela fältet syntes efter cirka två sekunder.

Den bakomliggande plattformsorsaken är fortfarande öppen. Egen Android-build, iOS och övriga formulärfall är inte verifierade. De 453 automatiska testerna passerade, men det var testet på telefonen som verifierade rättningen.