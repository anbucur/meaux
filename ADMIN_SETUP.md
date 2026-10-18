# MEAUX Atelier — Admin & Database Architecture

This website is equipped with a lightweight, zero-cost, highly secure CMS and dynamic visual editor powered by **Supabase** (Postgres DB + Google OAuth + Storage) and responsive inline editing.

---

## Key Capabilities

1. **Google Account Sign-In**:
   - The sign-in link is discreetly placed in the footer: `Admin`.
   - By default, only **`alexandru.n.bucur@gmail.com`** is authorized.
   - Any other user attempting to connect is blocked at the database level by PostgreSQL Row Level Security (RLS).
2. **Expandable Admin List**:
   - Authorized admins can add or revoke new curator emails at any time from the **Studio Panel → Admins** tab.
3. **Curate Pictures & Media**:
   - Upload high-resolution imagery directly to the Supabase Media storage bucket.
   - Curate the top 8 works featured on the landing page or add new entries to the full archive.
4. **Curate Texts, Fonts & Atmosphere**:
   - Inline visual edit mode: click any text directly on the page to change it.
   - Live typography selector: switch display, editorial serif, or technical monospace Google Fonts in real time.
   - Adjust obsidian & paper color balances.
5. **Add New Sections & Pages**:
   - Add new navigation tabs/pages (e.g. *Exhibitions*, *Press*, *Archive*).
   - Insert new custom section blocks (Monumental Quotes, Narrative Chapter Splits, Headings, Photographic Grids) into any page.
6. **Zero-Cost & Public Deployment**:
   - Runs as a static site hosted anywhere for free (Netlify, Vercel, Cloudflare Pages, GitHub Pages).
   - Supabase free tier includes: 500 MB Postgres database, 1 GB file storage, 50,000 monthly active users.
   - No monthly fees, no credit card required.

---

## 5-Minute Setup Guide

### Step 1: Create a Free Supabase Project
1. Go to [supabase.com](https://supabase.com) and create a free project (e.g. `meaux-atelier`).
2. Once created, go to **Project Settings → API** and copy:
   - **Project URL** (e.g. `https://xyzcompany.supabase.co`)
   - **Project API Keys → `anon` public key**

### Step 2: Run the Database Schema
1. In your Supabase dashboard, click **SQL Editor** on the left menu.
2. Click **New query**.
3. Open [`supabase/schema.sql`](file:///c:/Users/alexa/Downloads/meaux/supabase/schema.sql) in this repository, copy its entire contents, paste them into the SQL editor, and click **Run**.
4. This instantly creates:
   - The `admins` table seeded with `alexandru.n.bucur@gmail.com`.
   - The `site_content` and `site_revisions` tables with strict Row Level Security (public can only read published content; only admins can edit or write drafts).
   - The `media` storage bucket for photo uploads.
   - The atomic `publish_site()` procedure.

### Step 3: Enable Google Provider in Supabase
1. In Supabase, navigate to **Authentication → Providers → Google**.
2. Toggle Google to **Enabled**.
3. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials):
   - Create an **OAuth 2.0 Client ID** (Web application).
   - Add Supabase's redirect URI (provided in the Supabase Google auth settings) to **Authorized redirect URIs**.
   - Copy your Google **Client ID** and **Client Secret** into Supabase and click **Save**.

### Step 4: Connect the Website
You can connect your project in either of two ways:
- **Option A (In-Browser)**: Click `Admin` in the website footer, click **Supabase Credentials / Local Mode ▾**, paste your Project URL and Anon Key, and click **Save Credentials**.
- **Option B (Configuration File)**: Open [`assets/cms/config.js`](file:///c:/Users/alexa/Downloads/meaux/assets/cms/config.js) and paste your credentials:
  ```js
  window.MEAUX_CONFIG = {
    supabaseUrl: 'https://xyzcompany.supabase.co',
    supabaseAnonKey: 'eyJhbGciOi...',
    initialAdmin: 'alexandru.n.bucur@gmail.com'
  };
  ```

---

## Local Testing / Demo Mode
You can test the entire administrative and editing suite immediately on your machine without even setting up Supabase:
1. Open the website at `http://localhost:4173` (or serve with `python -m http.server 4173`).
2. Scroll to the footer and click **Admin**.
3. Expand **Supabase Credentials / Local Mode ▾** and click **Local Demo Mode**.
4. The floating admin bar will appear at the bottom:
   - Toggle **Edit Mode: ON** to edit text directly on the page.
   - Click **Studio Panel ☰** to manage pages, typography, portfolio, and sections.
   - Click **Publish Live ↵** to save changes.
