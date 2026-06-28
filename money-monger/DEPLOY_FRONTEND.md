# Frontend deployment — Web (Vercel) + Android (EAS → Play Store)

The Expo app lives in `money-monger/`; the git repo root is one level up
(`boardgame-mobile/`, remote `money-monger-app`). GitHub Actions reads workflows
from the repo root's `.github/workflows/`.

Three runtime values are read at **build time** and inlined into the bundle
(they're `EXPO_PUBLIC_*`, so they ship to clients — keep only public values here):

| Var | Purpose |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (public; protected by RLS) |
| `EXPO_PUBLIC_GAME_WS_URL` | Colyseus server URL (e.g. `wss://game.example.com`) |

---

## Web → Vercel (free / Hobby tier, Git integration)

No workflow file — Vercel builds on every push once the repo is connected.
[`vercel.json`](vercel.json) holds the build config; you only set the root + env in the dashboard.

**One-time setup (Vercel dashboard):**
1. **Add New → Project**, import `akkiei/money-monger-app`.
2. **Root Directory** → `money-monger` (this is critical — the app is in a subdir).
3. Framework preset → **Other** (the `vercel.json` already sets build command
   `expo export -p web`, output `dist`, and an SPA rewrite for expo-router).
4. **Settings → Environment Variables** → add the three `EXPO_PUBLIC_*` vars
   (Production + Preview). The WS URL should be a **`wss://`** (TLS) endpoint —
   a browser on an `https://` Vercel page cannot open an insecure `ws://` socket.
5. Deploy. Pushes to the default branch → Production; other branches / PRs → Preview URLs.

> If deep-linked routes 404 on refresh, confirm the `rewrites` block in `vercel.json`
> survived — it maps every path back to the SPA entry.

---

## Android → EAS Build (AAB) → Play Store internal track

Builds run on EAS servers (managed workflow — `/android` is gitignored, there's no
native project to commit). Workflow: [`.github/workflows/eas-android.yml`](../.github/workflows/eas-android.yml).
It's **manual** (`workflow_dispatch`) because EAS builds are slow and metered.

### One-time setup

1. **Expo account + project id**

   ```bash
   cd money-monger
   npm i -g eas-cli
   eas login
   eas init        # writes extra.eas.projectId into app.json — commit that
   ```

2. **Android signing** — let EAS manage the keystore:

   ```bash
   eas credentials   # Android → set up a new keystore (EAS stores it for you)
   ```

3. **EXPO_TOKEN secret** — Expo dashboard → **Account → Access Tokens** → create one.
   Add it as a GitHub repo secret `EXPO_TOKEN`.

4. **Build-time env vars** — register the three public vars with EAS so they're
   present during the cloud build:

   ```bash
   eas env:create --name EXPO_PUBLIC_SUPABASE_URL      --value "https://<project>.supabase.co" --environment production
   eas env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "<anon-key>"                    --environment production
   eas env:create --name EXPO_PUBLIC_GAME_WS_URL       --value "wss://game.example.com"         --environment production
   ```

5. **Google Play service account** (for `eas submit`):
   - Play Console → **Setup → API access** → link a Google Cloud project →
     create a service account → grant it **Release** permissions on this app.
   - Download the JSON key.
   - Add its full contents as the GitHub repo secret `GOOGLE_SERVICE_ACCOUNT_JSON`.
   - The workflow writes it to `./google-service-account.json` at run time (gitignored)
     to match `submit.production.android.serviceAccountKeyPath` in `eas.json`.

### First release (must be manual once)

Play Console rejects API uploads until the app exists with one AAB uploaded by hand.

1. Run **Actions → "EAS Android" → Run workflow** with `profile = production`,
   `submit = false`. Download the AAB from the EAS build page.
2. In Play Console, create the app and upload that AAB to the **Internal testing** track manually.
3. Confirm the service account now has access.

### Ongoing

Run the workflow with `profile = production`, `submit = true` → EAS builds the AAB
(`autoIncrement` bumps `versionCode` remotely) and submits to the internal track.
For a quick installable build without touching the store, use `profile = preview`
(produces an APK; never submits).

---

## Required GitHub secrets (mobile repo)

| Secret | Used by | Notes |
|---|---|---|
| `EXPO_TOKEN` | EAS workflow | Expo access token |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | EAS submit | Full Play service-account JSON; only needed when submitting |

Vercel needs **no** GitHub secret — it authenticates through its own Git integration.

---

## Caveats / production hardening

- **Cleartext WebSocket**: the current backend is `ws://20.44.61.245` (no TLS).
  Android blocks cleartext traffic by default and browsers block `ws://` from
  `https://` pages, so **store/web builds need `wss://`** — front the Colyseus server
  with TLS (the backend `DEPLOY.md` notes this) before a real release.
- `.env` is committed (only `.env*.local` is gitignored). That's acceptable here
  because the values are all public (`EXPO_PUBLIC_*` + Supabase anon, guarded by RLS) —
  but never put a service-role key or any real secret in it.
- EAS free tier has limited concurrent/monthly build credits; keep Android builds manual.
