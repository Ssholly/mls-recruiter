# MLS Job Recruiter Dashboard
### Personal AI-powered job digest for Success Oluwafemi Ishola

A fully self-contained web dashboard that searches Nigerian job boards for Medical Laboratory Scientist roles, scores them against your profile, and emails a daily digest — with a built-in scheduler.

---

## Features
- **Daily scheduler** — set a time and days; keeps running as long as the tab is open
- **AI-powered search** — plug in your Anthropic API key to get fresh live results via Claude
- **Gmail auto-send** — add a Gmail OAuth token and emails fire automatically
- **Tiered scoring** — every role is scored 0–100 and grouped into Tier 1 / 2 / 3
- **Run history** — every search is logged with timestamp and match count
- **All settings stored locally** — keys never leave your browser

---

## Deploy to GitHub Pages (5 minutes)

### Step 1 — Create a GitHub repo
1. Go to [github.com](https://github.com) → **New repository**
2. Name it `mls-recruiter` (or anything you like)
3. Set visibility to **Public** (required for free GitHub Pages)
4. Click **Create repository**

### Step 2 — Upload the files
Option A — via GitHub web UI:
1. Click **Add file → Upload files**
2. Drag the entire `mls-dashboard` folder contents (index.html, css/, js/)
3. Click **Commit changes**

Option B — via Git CLI:
```bash
cd mls-dashboard
git init
git add .
git commit -m "Initial deploy"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/mls-recruiter.git
git push -u origin main
```

### Step 3 — Enable GitHub Pages
1. In your repo → **Settings → Pages**
2. Source: **Deploy from a branch**
3. Branch: **main** / root
4. Click **Save**
5. Wait ~60 seconds → your dashboard is live at:
   `https://YOUR_USERNAME.github.io/mls-recruiter/`

---

## Add your API keys (optional but recommended)

### Anthropic API key (for live AI job search)
1. Visit [console.anthropic.com](https://console.anthropic.com)
2. Create an API key
3. Open your dashboard → **Settings → API Keys** → paste it in
4. Click **Save keys** — stored in your browser's localStorage

### Gmail OAuth token (for automatic email sending)
Without a token, clicking "Run" opens your mail client with the digest pre-filled.
With a token, email sends fully automatically.

To get one:
1. Go to [Google OAuth Playground](https://developers.google.com/oauthplayground/)
2. In the settings (⚙️), check **Use your own OAuth credentials** and add your Google Client ID/Secret
3. Authorise `https://www.googleapis.com/auth/gmail.send`
4. Exchange the authorisation code for tokens → copy the **Access token** (starts with `ya29...`)
5. Paste into **Settings → Gmail OAuth token** in the dashboard

---

## File structure
```
mls-dashboard/
├── index.html        # Main app shell and all tab markup
├── css/
│   └── style.css     # Full design system (dark theme, responsive)
└── js/
    ├── data.js       # Curated job list (20 roles, used without API key)
    └── app.js        # All logic: scheduler, search, email, render
```

---

## Privacy
- All API keys are stored in `localStorage` in your browser only
- No data is sent to any server other than Anthropic's API (when you explicitly run a search) and Gmail's API (when sending email)
- The app works fully offline using the curated job list

---

## Updating the curated job list
Edit `js/data.js` — each entry follows this shape:
```js
{
  tier: 1,                          // 1, 2, or 3
  title: "Medical Laboratory Scientist",
  company: "EHA Clinics",
  loc: "Abuja",
  salary: "₦490,000/mo",
  skills: "Haematology, QC, LIS",
  url: "https://...",
  score: 85
}
```

---

Built with Claude · Anthropic 2026
