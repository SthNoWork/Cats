# 🐱 Cats Gallery Setup Guide

## Overview

This cats gallery application uses:
- **Supabase** - PostgreSQL database with Row Level Security (RLS)
- **Cloudinary** - Image/video hosting and optimization
- **GitHub Pages** (or similar) - Host the public gallery frontend

## Security Architecture

| Component | Key Type | Access Level |
|-----------|----------|--------------|
| Public Gallery (`index.html`) | `anon` key | SELECT only (read cats) |
| Admin Panel (`admin/admin.html`) | `service_role` key | FULL access (CRUD) |

The admin panel should **NEVER** be deployed publicly - run it locally only!

---

## 📋 Step-by-Step Setup

### Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create an account
2. Click **New Project**
3. Choose organization, name your project, set a database password
4. Select a region close to your users
5. Wait for the project to be created (~2 minutes)

### Step 2: Run the Database Schema

1. In your Supabase Dashboard, go to **SQL Editor** (left sidebar)
2. Click **+ New Query**
3. Copy the entire contents of `database_setup.sql` from this repo
4. Paste it into the SQL Editor
5. Click **Run** (or press Ctrl/Cmd + Enter)
6. You should see "Success. No rows returned" - this is normal!

### Step 3: Verify RLS Policies

1. Go to **Table Editor** > **cats**
2. Click the **shield icon** (RLS) or go to **Authentication** > **Policies**
3. You should see these policies:
   - ✅ `Allow public read access` (SELECT for anon)
   - ✅ `Allow authenticated insert/update/delete`

### Step 4: Get Your API Keys

1. Go to **Project Settings** (gear icon) > **API**
2. Copy these values:

```
Project URL:        https://xxxxx.supabase.co
anon/public key:    eyJhbGciOiJIUzI1NiI... (safe to expose)
service_role key:   eyJhbGciOiJIUzI1NiI... (KEEP SECRET!)
```

### Step 5: Set Up Cloudinary

1. Go to [cloudinary.com](https://cloudinary.com) and create a free account
2. From your Dashboard, copy:
   - Cloud Name
   - API Key
   - API Secret

3. Create an **Upload Preset**:
   - Go to **Settings** > **Upload**
   - Scroll to **Upload presets** > **Add upload preset**
   - Name it `Medias`
   - Set **Signing Mode** to `Unsigned`
   - Configure transformations (optional):
     - Width: 1920, Height: 1080 (for images/videos)
     - Format: auto
   - Save

### Step 6: Configure the Application

#### For the Public Gallery (`src/connection/database.js`):
```javascript
const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key-here';
```

#### For the Admin Panel (`admin/admin.js`):
```javascript
const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_SERVICE_KEY = 'your-service-role-key-here';

const CLOUDINARY_CLOUD_NAME = 'your-cloud-name';
const CLOUDINARY_API_KEY = 'your-api-key';
const CLOUDINARY_API_SECRET = 'your-api-secret';
const CLOUDINARY_UPLOAD_PRESET = 'Medias';
```

### Step 7: Deploy the Public Gallery

**Option A: GitHub Pages**
1. Push `index.html`, `src/`, and `README.md` to a GitHub repo
2. Go to repo **Settings** > **Pages**
3. Set Source to `main` branch, folder to `/ (root)`
4. Your gallery will be at `https://username.github.io/repo-name`

**Option B: Vercel/Netlify**
1. Connect your repo
2. Deploy with default settings

⚠️ **DO NOT** deploy the `admin/` folder publicly!

### Step 8: Use the Admin Panel Locally

1. Keep the `admin/` folder on your local machine only
2. Open `admin/admin.html` directly in your browser (File > Open)
3. Or use VS Code Live Server extension

---

## 🔒 Security Notes

### What the anon key can do:
- ✅ Read all cats (SELECT)
- ❌ Cannot insert new cats
- ❌ Cannot update cats
- ❌ Cannot delete cats
- ❌ Cannot see `admin_notes`

### What the service_role key can do:
- ✅ Full CRUD access (Create, Read, Update, Delete)
- ✅ Bypasses all RLS policies
- ⚠️ **NEVER expose this key publicly!**

### Best Practices:
1. Add `admin/` to your `.gitignore` if pushing to public repo
2. Never commit API secrets to version control
3. Use environment variables in production
4. Rotate keys if accidentally exposed

---

## 🗄️ Database Schema Reference

### Cats Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key (auto-generated) |
| `title` | TEXT | Cat title |
| `description` | TEXT | Cat description |
| `image_data` | JSONB | Array of `{url, type}` |
| `categories` | TEXT[] | Array of category names (stored directly) |
| `is_featured` | BOOLEAN | Show in featured section |
| `admin_notes` | TEXT | Internal notes (hidden from public) |
| `upload_mode` | TEXT | 'batch' or 'individual' |
| `created_at` | TIMESTAMPTZ | Auto-set on create |
| `updated_at` | TIMESTAMPTZ | Auto-updated on changes |

**Note:** Categories are stored directly in the `cats` table as a TEXT array. There is no separate categories table - new categories are automatically available when you add them to any cat entry.

### image_data JSONB Structure

```json
[
    {
        "url": "https://res.cloudinary.com/...",
        "type": "image"
    }
]
```

---

## 📸 Upload Modes

### Batch Mode (🖼️)
- Multiple images share ONE title and description
- Best for: photo albums, cat photo collections
- All images are stored in one database entry

### Individual Mode (📸)
- Each image becomes its OWN separate database entry
- Best for: daily cat photos, unique moments
- Each image gets its own title, description, and categories

---

## 🔧 Troubleshooting

### "Failed to fetch cats" error
- Check if your Supabase URL is correct
- Verify the anon key is properly set
- Check browser console for CORS errors

### Cats not showing in gallery
- Verify RLS policy exists for `anon` SELECT
- Test the query in Supabase SQL Editor
- Check if cats exist in the table

### Admin can't add cats
- Verify you're using the `service_role` key (not anon)
- Check if the key is correctly formatted
- Look for errors in browser console

### Images not uploading
- Verify Cloudinary credentials
- Check that upload preset is set to "Unsigned"
- Verify the preset name matches your config (`Medias`)

### Images not deleting from Cloudinary
- Verify API Secret is correct
- Check browser console for signature errors
- Ensure the public_id extraction is working
