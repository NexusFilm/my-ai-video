# Supabase Storage Setup

This application now uses **Supabase Storage** for image assets instead of embedding base64 data URLs. This provides:

- ✅ Smaller code files (no 700KB+ base64 strings)
- ✅ Faster API responses (no payload bloat)
- ✅ No syntax errors from ASSET_URLS injection
- ✅ Better performance and reliability

## Setup Instructions

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Note your project URL and anon key

### 2. Create Storage Bucket

1. In Supabase Dashboard → Storage
2. Create new bucket: **`ai-video-assets`**
3. Set it to **Public** (for direct image access)
4. Enable RLS if needed (optional)

### 3. Configure Environment Variables

Create `.env.local` in `my-ai-video/` directory:

```bash
# Existing variables
OPENAI_API_KEY=your-openai-key
REMOTION_AWS_ACCESS_KEY_ID=your-aws-key
REMOTION_AWS_SECRET_ACCESS_KEY=your-aws-secret

# NEW: Supabase Storage (required for image uploads)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

**Important**: These are PUBLIC environment variables (prefixed with `NEXT_PUBLIC_`) because image uploads happen client-side. Use Row Level Security (RLS) policies if you need access control.

### 4. Deploy to Vercel

Add the same environment variables in:
- Vercel Dashboard → Project → Settings → Environment Variables

## Fallback Behavior

If Supabase is **not configured**, the app automatically falls back to:
- Using data URLs (base64-encoded images)
- Works but creates larger payloads

You'll see console warnings:
```
⚠️ Supabase not configured, using data URL for: image.jpg
```

## How It Works

1. **User uploads image** → Compressed to <1MB
2. **Client sends to** `/api/upload-asset`
3. **Server uploads to** Supabase Storage bucket: `ai-video-assets/images/[timestamp]-[random]-[filename]`
4. **Server returns** public URL: `https://[project].supabase.co/storage/v1/object/public/ai-video-assets/images/...`
5. **AI generates code** using the public URL directly (no ASSET_URLS constant needed)

## Storage Management

Images are stored permanently in Supabase. To clean up:

1. Go to Storage → `ai-video-assets` → `images/`
2. Delete old files manually
3. OR set up automatic cleanup with Supabase Edge Functions

## Troubleshooting

**Upload fails with 500 error:**
- Check Supabase bucket exists: `ai-video-assets`
- Check bucket is public
- Verify environment variables are set

**Images not showing in generated video:**
- Check browser console for URL
- Verify bucket is public
- Test URL directly in browser

**Still using data URLs:**
- Check environment variables are prefixed with `NEXT_PUBLIC_`
- Restart dev server after adding variables
- Check console for Supabase configuration warnings
