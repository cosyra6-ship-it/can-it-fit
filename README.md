# Can It Fit — Day 1 MVP

Mobile-web prototype for: photograph an item → photograph a destination space → receive a cautious fit decision.

## Run locally

```powershell
npm start
```

Open `http://localhost:3000` on a phone on the same network (replace `localhost` with the computer's LAN IP). Camera capture is supported through the phone browser's file input.

## Project structure

- `frontend/` mobile interface
- `backend/` zero-dependency static development server
- `ai/` vision-AI contract and safety guidance
- `tests/` field-test log for 10 real cases
- `docs/` product notes

## Vision AI

Set `OPENAI_API_KEY` before starting to activate the Responses API vision check; optionally set `OPENAI_VISION_MODEL`. Without a key, the app deliberately returns **MAYBE** rather than pretending it can measure photos.
