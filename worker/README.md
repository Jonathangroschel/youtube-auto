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

## Cost Estimates

- **Railway**: ~$5/month for light usage (free tier: $5 credit)
- **Supabase Storage**: Free tier includes 1GB
- **OpenAI Whisper**: ~$0.006/minute of audio
