# Analysis service

Local service that suggests new hit locations on a target photo. It implements
`contracts/analysis.openapi.yaml` (`POST /v1/analyses`). It runs on your computer,
stores nothing, and sends photos to no other service.

The suggestions are heuristic image processing (OpenCV), not a trained detector. They
are tested on synthetic images only. How well they work on real photos is not yet known
(see `docs/evaluation.md`). The app always lets you mark, move and delete hits yourself.

## Requirements

- Python 3.14 (verified with 3.14.2). `pyproject.toml` allows only 3.14.
- No system packages. OpenCV comes as a wheel (`opencv-python-headless`).

## Setup

From `services/analysis`:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -c requirements-lock.txt -e '.[dev]'
```

- `pyproject.toml` pins the direct dependencies.
- `requirements-lock.txt` pins every installed version. Regenerate it with
  `python -m pip freeze --exclude-editable > requirements-lock.txt` after changing
  dependencies.

## Run

**Only from this computer, or from the phone over USB:**

```bash
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

**From the S20 on the same Wi-Fi network** (development only, trusted network only):

```bash
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
ipconfig getifaddr en0        # the computer's address, e.g. 192.168.1.23
```

1. Set the address in the app.
   - Create `apps/mobile/.env.local` with this line:

     ```
     EXPO_PUBLIC_ANALYSIS_URL=http://192.168.1.23:8000
     ```

   - Then restart `npx expo start`. Environment variables are read when the bundle is built.
   - The app allows plain HTTP only in development, and only to `localhost`,
     `127.0.0.1` or a private network address (10.x, 172.16–31.x, 192.168.x).
2. If macOS asks whether Python may accept incoming connections, answer yes.
3. Check from the phone's browser that `http://192.168.1.23:8000/health` shows
   `{"status":"ok"}`.

**Over USB instead of Wi-Fi**, if `adb` is installed:

1. Run `adb reverse tcp:8000 tcp:8000`.
2. Use `EXPO_PUBLIC_ANALYSIS_URL=http://127.0.0.1:8000`.

The service has no login. On `0.0.0.0`, anyone on the network can send it photos for
analysis. It keeps nothing, and it limits size and concurrency, but it must not be
exposed outside a trusted network or deployed as it is.

## Checks

```bash
ruff format --check app tests
ruff check app tests
mypy
python -m pytest -q
```

## Limits (`app/config/settings.py`)

| Limit | Value | When it is exceeded |
| --- | --- | --- |
| Photo size | 15 MB per photo (body ≤ 2 × 15 MB + 256 KB) | 413 |
| Formats | JPEG, PNG, WebP, decided by the file content | 415 (HEIC included) |
| Pixels | ≥ 640 px on the short side, ≤ 50 MP | status `unusableImage` |
| Concurrent analyses | 2 | 429 `busy` |
| Processing time | 45 s | 504 `timeout` |

The app's own timeout is 60 s.

## How it works

1. **Decode.** The photo is decoded with its EXIF orientation applied, so coordinates
   refer to the upright photo. The app sends its own upright copy without metadata.
2. **Limit the area.** The calibration points mark the outer scoring ring. Analysis covers
   only that circle plus 6 %, so the wall, clips and the paper's edge never become
   suggestions. Expected hole sizes are 1.5–12 % of the outer ring radius. No millimetre
   dimensions are used.
3. **Analyse.**
   - **Paired** (`opencv-paired-diff-v1`):
     1. SIFT features and MAGSAC give a homography from before to after.
     2. ECC refines the homography.
     3. The aligned photos must correlate at ≥ 0.8. Otherwise the result is
        `registrationFailed`, and the photos are never compared unaligned.
     4. The absolute difference is taken after matching the local brightness of the two
        photos.
   - **Single** (`opencv-single-morph-v1`):
     - Black-hat finds dark holes on light paper. Top-hat finds light holes on the black area.
     - The edge of the black area is ignored.
     - The number columns on the axes are not searched, because printed digits look like
       holes. Holes there must be marked by hand.
     - Sticker edges are always reported as a risk.
4. **Find candidates.**
   - Structures thinner than about 0.7 of the smallest hole are removed (ring lines,
     digit strokes, sticker edges, residual misalignment).
   - Roughly round blobs above a robust threshold become candidates.
   - Close blobs are merged into one uncertain candidate, which may be overlapping holes.
5. **Reject implausible results.**
   - Paired: more than 40 candidates, or more than 3 % of the area changed, gives
     `registrationFailed`.
   - Single: the same limits give `unusableImage`.
   - No suggestions are invented in either case.

Logs contain only the request id, mode, status, candidate count and time. They never
contain photo bytes or metadata.
