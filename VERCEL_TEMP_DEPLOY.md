# Temporary Vercel Deployment (Frontend + Backend)

## 1) Deploy Backend (`server`) first

1. In Vercel, create a **new project** and set root directory to `server`.
2. Framework preset: **Other**.
3. Add environment variables used by backend (minimum):
   - `MONGO_URI`
   - `JWT_SECRET`
   - `FRONTEND_URL` (set this later to frontend Vercel URL)
   - Stripe/AWS/Email vars if those features are needed in this temporary deploy.
4. Deploy and note backend URL, for example:
   - `https://powermysport-api.vercel.app`
5. Health check:
   - `https://powermysport-api.vercel.app/api/health`

## 2) Deploy Frontend (`client`)

1. Create another Vercel project with root directory `client`.
2. Framework preset: **Next.js** (auto-detected).
3. Add frontend env vars:
   - `NEXT_PUBLIC_API_URL=https://powermysport-api.vercel.app/api`
   - `NEXT_PUBLIC_GOOGLE_CLIENT_ID=...` (if Google login is used)
4. Deploy and note frontend URL, for example:
   - `https://powermysport-web.vercel.app`

## 3) Final CORS sync

1. Go back to backend project env vars.
2. Set `FRONTEND_URL=https://powermysport-web.vercel.app`.
3. Redeploy backend.

## Notes for temporary setup

- Backend is deployed as a Vercel Serverless Function.
- Cold starts are normal on free/low-traffic usage.
- Keep frontend and backend as **separate Vercel projects**.
