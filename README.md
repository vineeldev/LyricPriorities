# Lyric Q3 Priorities — Timeline

Partner-facing timeline of the Asana "Lyric Q3 Priorities" board, plotted on the
Target / Hard / Contractual custom date fields.

## Structure

- `index.html` — the dashboard. Loads with an embedded snapshot, then pulls live
  data from `/api/tasks` on page load and whenever "Refresh from Asana" is clicked.
- `api/tasks.js` — Vercel serverless function. Calls the Asana REST API with a
  Personal Access Token and returns the project tasks (paginated, normalized).

## Deploy

1. Push this folder to a GitHub repo.
2. In Vercel: Add New Project -> import the repo. No build settings needed
   (static file + `/api` functions are auto-detected).
3. Create an Asana Personal Access Token:
   Asana -> Settings -> Apps -> Manage developer console -> Personal access tokens.
4. In Vercel: Project -> Settings -> Environment Variables ->
   add `ASANA_PAT` = your token (all environments). Redeploy.
5. Open the deployment URL. The status text in the header should read
   "Live · updated <time>". If it says the live pull is unavailable, check the
   env var and redeploy.

## Notes

- The token stays server-side only. Do not put it in `index.html`.
- Responses are edge-cached for 60 seconds, so a refresh right after an Asana
  edit can lag up to a minute.
- The page is public to anyone with the URL. For internal financial data,
  turn on Vercel Deployment Protection (or put it behind SSO/password) before
  sharing beyond the team.
- Live data uses assignee first names, so Ross/Rich items show as "Ross"
  (the Asana assignee) after the first live pull.
- The one undated "Review meeting with ACA" subtask is not project-homed in
  Asana, so it appears in the embedded snapshot but not in live pulls.
