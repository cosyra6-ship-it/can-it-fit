# Vision AI integration

The UI is deliberately usable without a key. Replace the local verdict in `frontend/app.js` with a request to `POST /api/analyze` when a vision provider is chosen. The API should return `item`, `space`, `has_reference`, `verdict` (`can_fit`, `maybe`, or `wont_fit`), and `explanation`.

Required prompt constraints: identify uncertainty; never infer exact measurements with no reference; say `maybe` when perspective, occlusion, or a missing reference prevents confidence.
