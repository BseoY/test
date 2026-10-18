<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- All backend calls go through `getService()` in `src/services` (InterviewService interface); UI never fetches directly, so the mock can be swapped for the FastAPI client.
- The mock service enforces server rules (role checks, read-only drops, notes only to interviewers); keep `src/services/mock.test.ts` in sync with any rule change.
- Excalidraw is only imported inside `src/components/interview/ExcalidrawBoard.tsx`, lazy-loaded client-side, so the canvas library stays swappable and SSR-safe.
