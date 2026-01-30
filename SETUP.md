# 🛒 Shop Setup Guide

## Overview

This shop application uses:
- **Supabase** - PostgreSQL database with Row Level Security (RLS)
- **Cloudinary** - Image/video hosting and optimization
- **GitHub Pages** (or similar) - Host the public shop frontend

## Security Architecture

| Component | Key Type | Access Level |
|-----------|----------|--------------|
| Public Shop (`index.html`) | `anon` key | SELECT only (read products) |
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
3. Copy the entire contents of `supabase_schema.sql` from this repo
4. Paste it into the SQL Editor
5. Click **Run** (or press Ctrl/Cmd + Enter)
6. You should see "Success. No rows returned" - this is normal!

### Step 3: Verify RLS Policies

1. Go to **Table Editor** > **products**
2. Click the **shield icon** (RLS) or go to **Authentication** > **Policies**
3. You should see these policies:
   - ✅ `Allow public read access to products` (SELECT for anon)
   - ✅ `Allow service role full access` (ALL for service_role)

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
   - Name it `products`
   - Set **Signing Mode** to `Unsigned`
   - Configure transformations (optional):
     - Width: 400, Height: 400
     - Format: WebP (for images)
   - Save

### Step 6: Configure the Application

#### For the Public Shop (`src/connection/database.js`):
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
const CLOUDINARY_UPLOAD_PRESET = 'products';
```

### Step 7: Deploy the Public Shop

**Option A: GitHub Pages**
1. Push `index.html`, `src/`, and `README.md` to a GitHub repo
2. Go to repo **Settings** > **Pages**
3. Set Source to `main` branch, folder to `/ (root)`
4. Your shop will be at `https://username.github.io/repo-name`

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
- ✅ Read all products (SELECT)
- ❌ Cannot insert new products
- ❌ Cannot update products
- ❌ Cannot delete products
- ❌ Cannot see `admin_notes` (if using the `public_products` view)

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

### Products Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key (auto-generated) |
| `title` | TEXT | Product name (required) |
| `description` | TEXT | Customer-facing description |
| `price` | DECIMAL | Product price |
| `image_urls` | TEXT[] | Array of Cloudinary URLs |
| `categories` | TEXT[] | Array of category names |
| `is_featured` | BOOLEAN | Show in featured section |
| `admin_notes` | TEXT | Internal notes (hidden from public) |
| `discount_percent` | INTEGER | Promotion discount (0-100) |
| `promotion_start` | TIMESTAMPTZ | Promo start date |
| `promotion_end` | TIMESTAMPTZ | Promo end date |
| `created_at` | TIMESTAMPTZ | Auto-set on create |
| `updated_at` | TIMESTAMPTZ | Auto-updated on changes |

---

## 🔧 Troubleshooting

### "Failed to fetch products" error
- Check if your Supabase URL is correct
- Verify the anon key is properly set
- Check browser console for CORS errors

### Products not showing in shop
- Verify RLS policy exists for `anon` SELECT
- Test the query in Supabase SQL Editor
- Check if products exist in the table

### Admin can't add products
- Verify you're using the `service_role` key (not anon)
- Check if the key is correctly formatted
- Look for errors in browser console

### Images not uploading
- Verify Cloudinary credentials
- Check if upload preset exists and is `unsigned`
- Ensure file size is under limits

---

## 📁 File Structure

```
Shop/
├── index.html          # Public shop frontend (DEPLOY THIS)
├── README.md           # Project info
├── supabase_schema.sql # Database setup script
├── SETUP.md            # This file
├── src/
│   ├── index.js        # Shop JavaScript
│   ├── css/
│   │   └── index.css   # Shop styles
│   └── connection/
│       └── database.js # Supabase connection (anon key)
└── admin/              # ⚠️ LOCAL ONLY - DO NOT DEPLOY
    ├── admin.html      # Admin panel UI
    ├── admin.js        # Admin logic (service_role key)
    └── admin.css       # Admin styles
```

---

## ✅ Checklist

- [ ] Created Supabase project
- [ ] Ran `supabase_schema.sql` in SQL Editor
- [ ] Verified RLS policies are active
- [ ] Copied anon key to `database.js`
- [ ] Copied service_role key to `admin.js`
- [ ] Set up Cloudinary account
- [ ] Created unsigned upload preset
- [ ] Added Cloudinary credentials to `admin.js`
- [ ] Deployed public shop (without admin folder)
- [ ] Admin panel works locally
- [ ] Added `admin/` to `.gitignore`
