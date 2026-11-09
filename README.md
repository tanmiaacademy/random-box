# Random Box

Arabic-first online random card draw game.

## Stack
- Next.js 15 / React 19
- Supabase Auth, Postgres, Realtime and Storage
- Vercel deployment

## Included
- Public home page with active boxes
- Shareable `/box/[slug]` game pages
- Admin sign-in and protected admin dashboard
- Create boxes in shared or individual mode
- Upload card images and add card titles/descriptions
- No-repeat random draws using a database RPC
- Draw history and round reset choice
- Arabic RTL responsive UI

## Local setup
1. Install Node.js 20 or later.
2. Copy `.env.example` to `.env.local`.
3. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Run `npm install`, then `npm run dev`.

## Supabase setup
The initial database schema, admin user, and storage bucket were configured manually.
Run `database/phase2.sql` in the Supabase SQL Editor after the initial schema. This adds draw history, reset-round RPCs, and shared draw realtime visibility.
The public realtime policy exposes only shared draw events; individual histories are returned through the participant-key-filtered RPC.

## Deployment
Import this repository into Vercel and add these environment variables under Project Settings → Environment Variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Redeploy after saving them. Never add a Supabase service-role or secret key to frontend environment variables.
