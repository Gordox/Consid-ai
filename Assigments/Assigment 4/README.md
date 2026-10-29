# Target Practice – installationsguide för testare

Personlig alfa för Android. Du behöver inte Expo Go, Node, Metro eller någon dator för att använda appen.

## Ladda ned och installera

1. Öppna den senaste prereleasen på <https://github.com/Gordox/Consid-ai/releases> i telefonens webbläsare.
2. Ladda ned `target-practice-alpha-<version>.apk`. Du kan också ladda ned den på en dator och föra över den till telefonen med USB.
3. Kontrollera gärna filen mot `SHA256SUMS` från samma release.
4. Öppna APK-filen. Om Android säger att installation från okända källor är blockerad: välj **Inställningar** och tillåt **Installera okända appar** för webbläsaren eller filhanteraren du öppnade filen med. Gå tillbaka och tryck **Installera**.
5. Om Play Protect varnar för en okänd utvecklare: välj att installera ändå. Appen är inte publicerad i Play Butik.

**Version, versionCode och commit** står i releasens beskrivning. Den installerade versionen ser du under **Inställningar → Appar → Target Practice**.

## Behörigheter

- **Kamera:** frågas första gången du väljer **Camera**. Nekar du kan du öppna Inställningar från appen eller välja bilder ur biblioteket i stället.
- **Bilder:** Android öppnar sin egen bildväljare när du väljer **Library**.
- Appen använder ingen mikrofon och ingen plats.

## Vad som fungerar utan nätverk

Allt manuellt fungerar offline, även i flygplansläge: sessioner, rundor, kamera och bibliotek, justering av tavlan, manuella träffar, granskning, bekräftelse och historik. Allt sparas bara på telefonen.

## Bildanalys

Bildanalysen körs för närvarande endast via en lokalt startad server på en dator. Den körs inte på telefonen och någon publik analystjänst ingår inte. Telefonen måste kunna nå datorns server på det betrodda lokala nätverket. Utan servern fungerar det manuella flödet fortfarande.

**Det här releasebygget har ingen analysadress.** Rundan visar "Analysis unavailable" och du markerar träffarna själv med **Mark hits manually**. Adressen byggs in när APK:n byggs och kan inte ändras i appen; en annan adress kräver ett nytt bygge. Analys mot den lokala servern provas i utvecklingsläge enligt projektets [README](../../README.md).

## Uppdatera och avinstallera

- **Uppdatera:** installera en nyare APK från samma releaser ovanpå den gamla. Det fungerar bara när applikations-id (`com.gordox.targetpractice`) och signering är desamma, och då finns dina sessioner kvar.
- **Avinstallera:** raderar appens lokala data, alltså alla sessioner, rundor och foton. Det går inte att ångra.
- Den här appen har **separat data från Expo Go**. Sessioner du skapat i Expo Go flyttas inte över.

## Kända begränsningar

- Poängen är **demopoäng** tills tavlans mått är verifierade. De är inga riktiga resultat.
- Analysens precision på riktiga foton är inte mätt.
- Anteckningar ingår inte i alfan.
- Appen är bara provad på Samsung Galaxy S20.

## Kort testflöde

1. Starta appen med flygplansläge på.
2. **New session**: fyll i vapen, kaliber, avstånd och skott per runda, spara.
3. **Start round** → **Add photos** → ta en efterbild med **Camera** eller välj ur **Library**.
4. **Align target**: placera fyra punkter på ytterringen och tryck **Use alignment**.
5. **Mark hits manually**: lägg till träffarna, tryck **Review round**, ange missar och **Confirm round**.
6. Stäng appen helt och öppna den igen. Sessionen och rundan ska finnas kvar.

## Felsökning

| Problem | Gör så här |
| --- | --- |
| APK:n går inte att installera | Tillåt installation från källan (steg 4). "Appen installerades inte" kan betyda att en version med annan signering redan finns, till exempel ett eget bygge; då måste den avinstalleras först, vilket raderar dess data. |
| Kameran visar ingen bild | Tillåt kameran under **Inställningar → Appar → Target Practice → Behörigheter**, eller använd **Library**. |
| "Analysis unavailable" | Förväntat i det här bygget: markera träffarna själv. |
| Demopoäng visas | Avsiktligt tills tavlan är verifierad. |
