# Bugg: tangentbordet döljer de nedersta fälten i formuläret

> **Status:** Öppen, inte åtgärdad. Rotorsaken är okänd. Används som felsökningsövning i hemuppgift 3.

## Observation

- **Rapporterad:** 2026-10-27 av ägaren under manuell testning efter steg 6c (sessionslistan).
- **Miljö:** Samsung Galaxy S20, Android, Expo Go, Hermes. Appen kördes med `npx expo start`.
- **Skärm:** Formuläret för ny session (`app/sessions/new.tsx` och `src/features/sessions/SessionForm.tsx`), byggt i steg 5d.
- **Steg:** Öppna `New session` och tryck i `Shots per round` eller `Planned rounds (optional)`.
- **Förväntat:** Innehållet skjuts upp så att fältet man skriver i, och helst `Create session`, alltid syns ovanför tangentbordet (`docs/design/ui-ux.md` §12, `03 · Keyboard open`).
- **Faktiskt:** Fälten döljs av tangentbordet.

## Det som inte är känt

- När felet introducerades. Formuläret byggdes i steg 5d. S20-kontrollen av 5d rapporterades som "ser ut att funka bra" utan att det angavs om punkten om tangentbordet gicks igenom.
- Om de övre fälten, till exempel `Distance (m)`, också påverkas.
- Om det går att skrolla fram fältet manuellt medan tangentbordet är öppet.
- Om felet uppstår i en egen Android-build (development build) eller bara i Expo Go.
- Vilken Android-version S20 kör och om tangentbordet är Samsung Keyboard eller Gboard.

## Avgränsning

- Testerna M1–M10 för sessionslistan gick igenom (steg 6c). **De säger inget om formulärets tangentbordshantering.**
- De automatiska testerna renderar inte komponenter och kan inte upptäcka felet.
