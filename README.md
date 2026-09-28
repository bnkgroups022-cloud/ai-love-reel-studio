# AI LOVE REEL STUDIO

Turn one idea into a cinematic love story Reel.

---

## 1. What this project does

You type a simple idea, like **"Ek baarish wali romantic love story"**, and press **CREATE REEL**. The app then:

1. Writes a short romantic story with AI (Claude).
2. Invents a fictional adult couple and writes down exactly how they look (the "character bible").
3. Plans 8 cinematic shots.
4. Makes 8 realistic vertical pictures with an image AI — the couple description is repeated in every picture so they look the same.
5. Shows you the 8 scenes. You can remake any single scene, or edit what it shows.
6. Turns the 8 pictures into a 9:16 MP4 video (1080×1920, 30 fps) with slow zooms, slow pans and soft crossfades.
7. Lets you play and download the MP4, then make another one.

The video has **no music on purpose**. Add music when you post it on Instagram or Facebook.

Nothing is faked: if a service is not connected, the app tells you exactly which one and why.
There is a clearly labelled **DEMO MODE** for trying the app before you have API keys — demo pictures say "DEMO MODE — NOT AI generated" on them.

### The services it uses

| What | Service | Why |
|---|---|---|
| Database + file storage | **Supabase** (free plan is fine) | Saves your projects, pictures and videos |
| Story AI | **Anthropic (Claude)** | Writes the story, characters and scenes |
| Image AI | **Replicate** (FLUX 1.1 Pro) — or OpenAI | Makes the 8 pictures |
| Video rendering | **Shotstack** (for the website on Vercel) — or FFmpeg on your own computer | Makes the MP4 |
| Website hosting | **Vercel** + **GitHub** | Puts the app online |

Each AI service charges per use (a few cents per picture; the story costs less). Check each site's pricing page. The Shotstack free "sandbox" key works but puts a watermark on videos.

---

## 2. How to install (on your computer)

You need **Node.js** (version 20 or newer). Check by opening a terminal and typing `node -v`.
If it is missing: open https://nodejs.org → download the **LTS** version → install it.

Then, in a terminal:

```
cd C:\Users\Win-11\ai-love-reel-studio
npm install
```

---

## 3. How to create Supabase (database + storage)

STEP 1 — Open https://supabase.com and sign in (you can use your GitHub account).
STEP 2 — Click **New project**. Give it a name (e.g. `ai-love-reel-studio`), make up a database password, pick the region closest to you, click **Create new project**. Wait 1–2 minutes.
STEP 3 — In the left menu click **SQL Editor** → **New query**.
STEP 4 — Open the file `supabase/migrations/0001_initial_schema.sql` from this project, copy **everything**, paste it into the SQL editor, click **Run**. You should see "Success". (This creates the tables and a private storage folder called `reel-assets`.)
STEP 5 — Click the **gear icon (Project Settings)** → **Data API** (or **API**). Copy the **Project URL**. This is `NEXT_PUBLIC_SUPABASE_URL`.
STEP 6 — Go to **Project Settings → API Keys**. Copy the **secret** key (starts with `sb_secret_`) — or, on older projects, the **service_role** key. This is `SUPABASE_SERVICE_ROLE_KEY`. Keep it secret.
STEP 7 — (Optional) copy the **anon / publishable** key into `NEXT_PUBLIC_SUPABASE_ANON_KEY`. The app does not use it yet.

---

## 4. How to configure the story AI and the image AI

**Story AI (Anthropic / Claude)**
STEP 1 — Open https://console.anthropic.com and sign in.
STEP 2 — Add billing (Settings → Billing).
STEP 3 — Go to **API Keys** → **Create Key** → copy it. This is `ANTHROPIC_API_KEY`.
Set `STORY_PROVIDER=anthropic`.

**Image AI — Replicate (recommended)**
STEP 1 — Open https://replicate.com and sign in.
STEP 2 — Add billing (Account → Billing).
STEP 3 — Open https://replicate.com/account/api-tokens → create a token → copy it. This is `IMAGE_API_KEY`.
Set `IMAGE_PROVIDER=replicate`. (It uses the model `black-forest-labs/flux-1.1-pro`, which makes true 9:16 vertical pictures and supports a fixed "seed" per project for a more consistent look.)

**Image AI — OpenAI (alternative)**
Create a key at https://platform.openai.com/api-keys, set `IMAGE_PROVIDER=openai` and put the key in `IMAGE_API_KEY`. OpenAI makes 1024×1536 pictures; the app crops them to 9:16.

---

## 5. How to configure video rendering

**For the website on Vercel — Shotstack**
Vercel cannot run long video rendering itself, so the app sends the finished scene list to Shotstack, which renders the MP4 in the cloud. The app then saves the MP4 into your Supabase storage.

STEP 1 — Open https://shotstack.io and sign up.
STEP 2 — In the dashboard open **API Keys**. You will see a **Sandbox (stage)** key and a **Production** key.
STEP 3 — Copy one into `VIDEO_API_KEY`.
STEP 4 — Set `SHOTSTACK_ENV=stage` for the sandbox key (free, watermark) or `SHOTSTACK_ENV=v1` for the production key (paid, no watermark).
Set `VIDEO_PROVIDER=shotstack`.

**On your own computer — FFmpeg**
Set `VIDEO_PROVIDER=ffmpeg`. FFmpeg comes with `npm install`, nothing else to do. (Do not use this on Vercel.)

---

## 6. How to run locally

A file called **`.env.local`** has already been created for you in the project folder. It is set to **DEMO MODE** (fixed test story, labelled placeholder pictures, FFmpeg video) and already contains a random `ENCRYPTION_KEY`.

STEP 1 — Open `.env.local` in Notepad.
STEP 2 — After `APP_ACCESS_PASSWORD=` type a password you will remember (this unlocks the app).
STEP 3 — Paste your two Supabase values (from section 3) after `NEXT_PUBLIC_SUPABASE_URL=` and `SUPABASE_SERVICE_ROLE_KEY=`.
STEP 4 — Save the file.
STEP 5 — In the terminal:

```
npm run dev
```

STEP 6 — Open http://localhost:3000 and type your password.

When you have real keys, change `STORY_PROVIDER=anthropic`, `IMAGE_PROVIDER=replicate`, add the keys, save, and restart `npm run dev` (press Ctrl+C, then run it again).

**Test the video maker without any account at all:**

```
npm run render:demo
```

This writes `demo-reel.mp4` (30 seconds, 1080×1920) into the project folder.

---

## 7. How to push to GitHub

STEP 1 — Open https://github.com/new. Name the repository `ai-love-reel-studio`, choose **Private**, do not add a README, click **Create repository**.
STEP 2 — In the terminal, in the project folder, run (replace `YOUR-NAME` with your GitHub username):

```
git add .
git commit -m "AI Love Reel Studio v1"
git branch -M main
git remote add origin https://github.com/YOUR-NAME/ai-love-reel-studio.git
git push -u origin main
```

Your `.env.local` (with your keys) is **not** uploaded — it is ignored on purpose.

---

## 8. How to deploy to Vercel

STEP 1 — Open https://vercel.com and sign in with GitHub.
STEP 2 — Click **Add New… → Project**, choose `ai-love-reel-studio`, click **Import**.
STEP 3 — Before clicking Deploy, open **Environment Variables** and add the values from section 9.
STEP 4 — Click **Deploy**. Wait ~2 minutes. You get a link like `https://ai-love-reel-studio.vercel.app`.

---

## 9. How to add Vercel environment variables

In Vercel: your project → **Settings → Environment Variables**. Add each name and value (copy the name exactly):

| Name | Value |
|---|---|
| `APP_ACCESS_PASSWORD` | your unlock password |
| `ENCRYPTION_KEY` | a long random text — you can copy the one from your `.env.local` |
| `NEXT_PUBLIC_APP_URL` | your Vercel link, e.g. `https://ai-love-reel-studio.vercel.app` |
| `NEXT_PUBLIC_SUPABASE_URL` | from Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | from Supabase (secret) |
| `STORY_PROVIDER` | `anthropic` |
| `ANTHROPIC_API_KEY` | from Anthropic |
| `IMAGE_PROVIDER` | `replicate` |
| `IMAGE_API_KEY` | from Replicate |
| `VIDEO_PROVIDER` | `shotstack` |
| `VIDEO_API_KEY` | from Shotstack |
| `SHOTSTACK_ENV` | `stage` or `v1` |

After adding or changing variables: **Deployments → ⋯ → Redeploy**. Changes only apply after a redeploy.

---

## 10. How to test

In the terminal:

```
npm run lint
npm run typecheck
npm test
npm run build
```

`npm test` checks: story JSON validation, scene validation, project creation, duplicate-click protection, the image provider adapters, retrying one failed scene, job status/progress, video timing and a real small MP4 render, and the download link rules.

In the app: open **SETTINGS** → **AI provider status**. Each service shows **Connected**, **Not connected**, **Error** (with the reason) or **Demo mode**.

---

## 11. How to create your first Reel

STEP 1 — Open the app and unlock it.
STEP 2 — Type your idea, e.g. `Ek baarish wali romantic love story`.
STEP 3 — Pick Mood, Visual Style, Language and Duration (or keep the defaults).
STEP 4 — Press **CREATE REEL** and keep the screen open. You will see each real step tick off: story → scene 1/8 … 8/8.
STEP 5 — On the scene preview, check the 8 pictures. If one looks wrong, press **REGENERATE SCENE** (only that one is remade) or **EDIT PROMPT** to describe it differently.
STEP 6 — Press **BUILD REEL**. Wait for "Rendering MP4…" to finish.
STEP 7 — Press **DOWNLOAD MP4**.
STEP 8 — Post it on Instagram or Facebook and add music from their music library.

**Tip — install it like an app:** on your phone open the website → browser menu → **Add to Home Screen**.

---

## Good to know (limitations)

- **Keep the screen open while a Reel is being made.** The work runs in small steps that your browser triggers one after another (this is how it fits Vercel's time limits without a paid queue service). If you close the page, it pauses, and continues when you open the Reel again from PROJECTS.
- **Faces are kept consistent with words, not with a reference photo.** The same detailed description and the same seed are used for every scene, but AI pictures can still vary a little. Remake any scene that drifts. The code is ready for reference-image support later.
- **Shotstack sandbox videos have a watermark.** Use a production key to remove it.
- **FFmpeg rendering is for your own computer only.** On Vercel use Shotstack.
- **Text on the video** uses the Hind font (supports Hindi and English), drawn by the app.
- **Only one owner account** (password login). The database is ready for Google login later.
- **No music** is added (by design). Future versions can add royalty-free music or your own audio.
