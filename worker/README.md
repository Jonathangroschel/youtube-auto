# AutoClip Worker

Video processing worker for AutoClip. Runs on Railway to handle FFmpeg operations.

## Setup on Railway

### 1. Create Supabase Storage Bucket

In your Supabase dashboard:
1. Go to **Storage** → **New bucket**
2. Create a bucket named `autoclip-files`
3. Set it to **Private** (we'll use signed URLs)

### 2. Deploy to Railway

1. Go to [railway.app](https://railway.app) and sign in with GitHub
2. Click **New Project** → **Deploy from GitHub repo**
3. Select your repo
4. Click on the service → **Settings** → **Root Directory** → Set to `worker`
5. Railway will auto-detect the Dockerfile

### 3. Add Environment Variables

In Railway dashboard, add these variables:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
OPENAI_API_KEY=your-openai-key
WORKER_SECRET=generate-a-random-secret-here
EDITOR_RENDER_URL=https://your-app-url.vercel.app
EDITOR_EXPORT_BUCKET=autoclip-files

# Transcription reliability defaults (recommended)
AUTOCLIP_TRANSCRIBE_CONCURRENCY=1
AUTOCLIP_TRANSCRIBE_CHUNK_SECONDS=45
AUTOCLIP_TRANSCRIBE_BITRATE=24k
AUTOCLIP_TRANSCRIBE_OPENAI_CONNECTION_MAX_ATTEMPTS=5
AUTOCLIP_TRANSCRIBE_OPENAI_CONNECTION_BACKOFF_MS=3000
AUTOCLIP_TRANSCRIBE_OPENAI_CONNECTION_MAX_BACKOFF_MS=45000
# Optional: choose initial OpenAI transport ("stateless" default or "keepalive")
# AUTOCLIP_OPENAI_TRANSPORT_MODE=stateless

# Optional export tuning (recommended on Railway)
# Hard override if you want a fixed value:
# EDITOR_EXPORT_CONCURRENCY=3
# Auto-tune inputs (used when EDITOR_EXPORT_CONCURRENCY is not set):
EDITOR_EXPORT_MAX_CONCURRENCY=3
EDITOR_EXPORT_MEMORY_PER_JOB_MB=2200
EDITOR_EXPORT_MEMORY_RESERVE_MB=1000
EDITOR_EXPORT_CPU_PER_JOB=1
# FFmpeg threads per export job (defaults to CPU_COUNT / export_concurrency)
# EDITOR_EXPORT_FFMPEG_THREADS=2

# Quality-first defaults (already high by default in worker/server.js)
# EDITOR_EXPORT_PRESET=slow
# EDITOR_EXPORT_CRF=12
# EDITOR_EXPORT_AUDIO_BITRATE=320k
```

Generate a secure secret:
```bash
openssl rand -hex 32
```

### 4. Get Your Worker URL

After deployment, Railway will give you a URL like:
```
https://your-worker-production.up.railway.app
```

### 5. Add to Vercel Environment Variables

In your Vercel project settings, add:

```
AUTOCLIP_WORKER_URL=https://your-worker-production.up.railway.app
AUTOCLIP_WORKER_SECRET=same-secret-from-railway

# Optional: dedicated transcription worker service
# (falls back to AUTOCLIP_WORKER_URL/SECRET when omitted)
AUTOCLIP_TRANSCRIBE_WORKER_URL=https://your-transcribe-worker-production.up.railway.app
AUTOCLIP_TRANSCRIBE_WORKER_SECRET=same-or-separate-secret
```

## Local Development

```bash
cd worker
npm install
npm run dev
```

Set environment variables in a `.env` file:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
OPENAI_API_KEY=your-openai-key
WORKER_SECRET=dev-secret
PORT=3001
```

## API Endpoints

All endpoints require `Authorization: Bearer {WORKER_SECRET}` header.

- `GET /health` - Health check
- `POST /upload` - Upload video file (multipart/form-data)
- `POST /youtube` - Download from YouTube URL
- `POST /transcribe` - Transcribe video with Whisper
- `POST /render` - Render clips with FFmpeg
- `POST /preview` - Generate preview clip
- `POST /download-url` - Get signed download URL
- `POST /cleanup` - Delete session files
- `POST /editor-export/start` - Queue editor export (headless Chromium + FFmpeg)
- `GET /editor-export/status/:jobId` - Export status and download URL

## Cost Estimates

- **Railway**: ~$5/month for light usage (free tier: $5 credit)
- **Supabase Storage**: Free tier includes 1GB
- **OpenAI Whisper**: ~$0.006/minute of audio

## Export Concurrency Tuning (Railway)

The worker now auto-computes editor export concurrency from CPU + memory:

- CPU bound = `CPU_COUNT / EDITOR_EXPORT_CPU_PER_JOB`
- Memory bound = `(TOTAL_MEMORY_MB - EDITOR_EXPORT_MEMORY_RESERVE_MB) / EDITOR_EXPORT_MEMORY_PER_JOB_MB`
- Auto concurrency = `min(EDITOR_EXPORT_MAX_CONCURRENCY, cpuBound, memoryBound)`

For an **8 vCPU / 8 GB** Railway instance, the defaults target **2-3 concurrent exports** depending on your real memory footprint.

If you see OOM/restarts, lower concurrency with one of:

- `EDITOR_EXPORT_CONCURRENCY=2` (hard cap)
- or raise `EDITOR_EXPORT_MEMORY_PER_JOB_MB` (e.g. 2600-3000)

## Dedicated Transcription Service (Recommended)

Run a second Railway service from the same `worker/` Dockerfile and point only transcription traffic to it:

1. Deploy a second Railway service from the same repo + Dockerfile.
2. Set the same Supabase/OpenAI environment variables on that service.
3. Set `AUTOCLIP_TRANSCRIBE_WORKER_URL` + `AUTOCLIP_TRANSCRIBE_WORKER_SECRET` in Vercel.
4. Roll back instantly by unsetting the two transcribe-specific env vars.
