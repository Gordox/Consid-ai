# Evaluation of hit suggestions

Status 2026-10-28: **evaluated only on synthetic images. No real photo has been analysed.**
Nothing here shows that the analysis works on real photos.

## Synthetic results

Source: `services/analysis/tests/synthetic.py`.

**What the images contain:**
- A ten-ring target with the black area for 7–10 and numbers on the axes.
- Six old holes covered by stickers that match the background, with visible edges.
- Five new torn holes, 36 px wide in the photo.
- Before and after photos, each with its own perspective, lighting gradient, blur, noise and
  JPEG compression.
- Calibration taps with ±3 px jitter.

New holes are kept off the number columns.

**Results:**

| Mode | Rounds | New holes | Found | False suggestions | Time per photo (M-series Mac) |
| --- | --- | --- | --- | --- | --- |
| Paired | 10 | 50 | 50 | 2 | ~0.7 s |
| Single | 10 | 50 | 47 | 4 | ~0.5 s |

**Also verified:**
- Two overlapping holes become one uncertain suggestion.
- No new holes gives `succeeded` with no candidates.
- A before photo without the target gives `registrationFailed`.
- A JPEG with EXIF orientation 6 is analysed upright.

The automated tests require at least 90 % found and 90 % correct in paired mode, and 85 %
found and 80 % correct in single mode, on 6 synthetic rounds. These thresholds only guard
against regressions. They are not acceptance criteria.

## What the synthetic images do not cover

- Real paper texture, torn fibres and holes that do not show the backing clearly.
- Real stickers: shine, curled edges, and holes through stickers.
- Shadows from the holes themselves, uneven light, glare on glossy stickers, and motion blur.
- Before and after photos taken far apart, or with different zoom.
- The real target's printing, colours and number placement.

## Photos needed from the S20

Take them with the S20 as JPEG, with the whole target in the frame, from roughly the same spot
before and after.

1. **5–10 rounds as before/after pairs**, preferably from at least two separate sessions.
   Analysis in single-photo mode uses the same after photos.
2. **At least one of each:**
   - holes in the white and in the black area
   - a hole through a sticker
   - two overlapping holes
   - a hole touching a ring line
   - a hole in the number columns
   - an angled photo (about 30°)
   - shadow or glare
   - a slightly blurred photo
3. **The true answer for each round:** the number of shots, and where each hole is (its ring
   value, or a screenshot from the app with the holes marked by hand).

The photos stay on the computer (`services/analysis/evaluation-photos/` is in `.gitignore`)
and are not committed. Split them into tuning photos and evaluation photos by session.

## To measure once real photos exist

For each mode on the same after photos:
- found and correct share against the hand-checked answer
- rejection rate (`registrationFailed` / `unusableImage`)
- how often the score from accepted suggestions differs from the hand-checked score
- correction time in the app
- time per analysis.

Acceptance thresholds are proposed from these numbers. None are agreed yet.
