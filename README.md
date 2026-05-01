# SaaS Starter (Next.js App Router)

Modern full-stack SaaS starter built with:

- Next.js (App Router, TypeScript)
- Tailwind CSS
- API routes for backend logic
- Responsive UI layout
- Firestore role persistence (Teacher/Student/Admin)

## Pages

- `/` - Landing page
- `/login` - Login page
- `/signup` - Signup page
- `/dashboard` - Dashboard with sidebar, header, and main content

## API Routes

- `GET /api/health` - health status endpoint
- `POST /api/auth` - signup/login endpoint with Firestore role storage
- `POST /api/generate` - AI content generation endpoint
- `GET /api/documents?userId=...` - list saved generated documents
- `DELETE /api/documents` - delete a saved document

## Project Structure

- `src/app` - App Router pages, layouts, and API routes
- `src/components/auth` - Auth UI components
- `src/components/dashboard` - Dashboard UI components
- `src/lib/firebase-admin.ts` - Firestore Admin SDK initialization
- `src/lib/roles.ts` - Role definitions and tool mappings

## Role-Based Access

Supported roles:

- Teacher -> Lesson Plan, Worksheet, Question Paper, Cheatsheet
- Student -> Notes, Cheatsheet, Practice Questions

Signup requires selecting a role. Role is stored in Firestore and used to control dashboard tool visibility.

Dashboard tool access:

- Teacher: Lesson Plan, Worksheet, Question Paper, Cheatsheet
- Student: Notes, Cheatsheet, Practice Questions

Each tool has an individual page under `/dashboard/tools/*` with:

- Input textarea
- Generate button
- Loading state
- Output display
- Rich text editing (bold, heading, lists)
- Export as PDF and DOCX

Generated output is stored in Firestore collection `documents` with:

- `userId`
- `type`
- `input`
- `output`
- `timestamp`

Use `/dashboard/documents` to view and delete saved content.

Free usage tracking is enabled:

- Free users are limited to **5 generations/day**
- Usage is stored in Firestore collection `usage`
- User plan (`free` now, `pro` for future paid plans) is stored on user profile

## Firestore Setup

1. Create a Firebase project with Firestore enabled.
2. Create a Firebase service account (Admin SDK credentials).
3. Copy `.env.example` to `.env.local` and set:
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PRIVATE_KEY` (keep `\n` escapes)
   - `FIREBASE_STORAGE_BUCKET`
   - `GEMINI_API_KEY`

## Environment Variables Setup

Create `.env.local` in the project root:

```bash
cp .env.example .env.local
```

Then add real values for all keys:

- Firebase Admin:
  - `FIREBASE_PROJECT_ID`
  - `FIREBASE_CLIENT_EMAIL`
  - `FIREBASE_PRIVATE_KEY`
  - `FIREBASE_STORAGE_BUCKET`
- Gemini:
  - `GEMINI_API_KEY`

For Vercel, add the same variables in Project Settings -> Environment Variables.

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Production Build

```bash
npm run lint
npm run build
npm start
```

Optimizations already enabled:

- `reactStrictMode: true`
- `poweredByHeader: false`
- response compression
- modern image formats (`avif`, `webp`)

## Deploy to Vercel

1. Push this project to GitHub/GitLab/Bitbucket.
2. Open [Vercel New Project](https://vercel.com/new) and import the repo.
3. Confirm framework is **Next.js** (auto-detected).
4. In Vercel project settings, add all env vars from `.env.local`.
5. Set Production + Preview + Development scopes for env vars.
6. Trigger first deploy.
7. After deploy, test:
   - signup/login flow
   - tool generation
   - my documents list/delete
8. Add custom domain (optional) from Vercel dashboard.

Vercel will run this Next.js app without extra build config.

## CBSE Prompt Quality

Prompt templates are enhanced for Indian schools with:

- Bloom's taxonomy alignment
- Competency-based task framing
- HOTS question inclusion
- Practical classroom-ready structure for teachers
