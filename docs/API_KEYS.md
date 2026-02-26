 # API Key Rotation Guide
 
 This project uses environment variables for all external API keys. Secrets must never be committed to the repository or printed in logs.
 
 ## Baseten (Zeus AI) Key
 
 - Variable name: `BASETEN_API_KEY`
 - Optional base URL: `BASETEN_BASE_URL` (default: `https://inference.baseten.co/v1`)
 
 The key is consumed in:
 - `lib/ai/baseten-api.ts` (Baseten client)
 - `app/api/ai/kb-chat/route.ts` (server-side chat endpoint)
 
 ## Rotate Locally
 
 1. Open `.env.local` and update:
 
    ```
    BASETEN_API_KEY=<YOUR_NEW_KEY>
    BASETEN_BASE_URL=https://inference.baseten.co/v1
    ```
 
 2. Restart the dev server or rebuild:
 
    ```
    npm run build && npm start
    ```
 
 ## Rotate on Vercel
 
 Option A — Dashboard:
 - Project Settings → Environment Variables
 - Add/Update:
   - `BASETEN_API_KEY` (Production, Preview, Development)
   - `BASETEN_BASE_URL` (optional)
 - Redeploy the project
 
 Option B — CLI (non-interactive value input should be done locally; do not paste secrets into shared logs):
 - Development:
   ```
   vercel env add BASETEN_API_KEY development
   ```
 - Preview:
   ```
   vercel env add BASETEN_API_KEY preview
   ```
 - Production:
   ```
   vercel env add BASETEN_API_KEY production
   ```
 - Then deploy:
   ```
   vercel deploy --prod
   ```
 
 ## Verification
 
 - Hit the chat endpoint to ensure it responds without auth errors:
   - `POST /api/ai/kb-chat` with `{ "query": "Ping" }`
 - Check server logs: no API key warnings
 - Optional: run `scripts/test-all-services.ts` and confirm environment summary
 
 ## Security Notes
 
 - Never commit secrets to the repository
 - Avoid printing secrets in CLI or chat logs
 - Prefer dashboard for production rotations
 
