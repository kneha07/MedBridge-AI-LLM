# MedBridge frontend

React 19 + Vite. Talks to the FastAPI backend (see the [main README](../README.md)); the API address is the `API` constant in `src/api.js` (`http://localhost:8000`).

```bash
npm install
npm run dev      # http://localhost:5173 (the backend must be running on port 8000)
npm run build    # production build into dist/
npm run lint     # ESLint
```

## Layout

| File | What it is |
|---|---|
| `src/App.jsx` | Top-level state: sign-in, the tab bar, which screen is showing, polling of a running request |
| `src/api.js` | `apiFetch`, which adds the bearer token; the session lives in `sessionStorage` |
| `components/SignIn.jsx` | Sign-in and create-account page (`/#create` opens the sign-up form) |
| `components/Landing.jsx` | Home page with the animated workflow preview |
| `components/WorkflowForm.jsx` | New-request form, grouped into four sections, with voice dictation (`MicButton.jsx`, `speech.js`) |
| `components/ProgressView.jsx` | Progress bar, step timeline, FHIR message viewers, confirmation number |
| `components/ReviewPanels.jsx` | Review checklist and approval card, audit trail, past-requests list |
| `components/ChatPanel.jsx`, `CitationDrawer.jsx` | Policy chatbot and the drawer that shows a cited passage |
| `components/TeamPanel.jsx` | Reviewer-only list of accounts, with promote/demote |
| `components/DemoHeader.jsx`, `Logo.jsx`, `Icon.jsx` | Header with the signed-in user, logo, line icons |
| `src/index.css` | Global styles, the page backdrop, and the CSS for the landing page, sign-in, tab bar and form |

## Notes

- There are no frontend tests. The backend has unit tests; the screens were checked by running the app and taking screenshots at desktop and 390 px widths.
- `AgentProgress.jsx`, `VerticalSelector.jsx`, `AuthForm.jsx` and `ResultCard.jsx` are not used by the app. They are left over from the hackathon version and can be deleted. All five remaining ESLint errors are in the first two of them.
- Starting a new request only resets the screen. It does not delete saved requests (an earlier version did).
