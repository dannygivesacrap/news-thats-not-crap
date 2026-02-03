# News That's Not Crap - Daily Pipeline Process

## Overview

This document describes exactly how the automated news curation system works, from fetching raw articles to publishing approved content on the live site.

---

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  News Sources   │────▶│  Claude AI      │────▶│  Review Page    │
│  (RSS + API)    │     │  (Curation)     │     │  (You Approve)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Live Website   │◀────│  Netlify Build  │◀────│  GitHub Repo    │
│  (Visitors)     │     │  (Generate HTML)│     │  (Storage)      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

---

## Daily Workflow

### Step 1: Fetch Raw Articles (Automated)

**Script:** `scripts/fetch-news.js`

**What it does:**
- Fetches articles from 12+ RSS feeds:
  - Positive News, Good News Network, Reasons to be Cheerful
  - The Guardian Environment, BBC Science
  - Science Daily (multiple feeds: health, climate, animals, etc.)
  - Nature journal
- Fetches articles from NewsAPI with 14 targeted queries:
  - "scientific breakthrough", "medical breakthrough"
  - "renewable energy record", "climate solution"
  - "conservation success", "species recovery"
  - "community success story", etc.

**Filtering:**
- Scores each article for "positivity" based on keywords
- Positive keywords (+2 points each): breakthrough, success, discover, cure, protect, save, renewable, etc.
- Negative keywords (-10 points each): death, disaster, crisis, attack, tragedy, etc.
- Bonus for trusted sources: Positive News, Good News Network, Reasons to be Cheerful

**Output:** `data/raw-articles.json` (top ~100 most positive articles)

---

### Step 2: AI Curation (Automated)

**Script:** `scripts/curate-with-ai.js`

**What it does:**

1. **Selection & Categorization**
   - Claude reviews all ~100 raw articles
   - Selects 60-80 best stories for the site
   - Categorizes each into: climate, health, science, wildlife, or people
   - Aims for 10-20 stories per category
   - Flags 1 hero story + 14 featured stories for the homepage

2. **Headline Rewriting**
   - Original headlines are rewritten in WGAC voice
   - Punchy, playful, can include puns
   - Example: "Gene Therapy Trial Shows Promise" → "Living Drug Revolution: Gene Therapy Beats 'Untreatable' Blood Cancer"

3. **Excerpt Writing**
   - 2-3 sentence summary using ONLY facts from the source
   - Written in warm, accessible tone

4. **Full Article Generation**
   - Each article gets a full rewrite in WGAC voice
   - Structure: Lead paragraph + 3-4 body paragraphs
   - Tone guidelines:
     - Warm and conversational
     - Playful with puns when natural
     - Optimistic but grounded
     - Accessible (no jargon)
   - **CRITICAL:** Each article starts differently - varied openings, no repetitive phrases

5. **Image Search Terms**
   - Claude suggests 2-3 word Unsplash search terms for each article
   - Example: "elephant sanctuary", "solar panels", "ocean research"

6. **Image Fetching**
   - Uses Unsplash API to find relevant photos
   - Falls back to category-based images if no API key or no results

**Fact-Checking Rules (Built into prompts):**
- ONLY use facts explicitly stated in source material
- NEVER invent statistics, percentages, or numbers
- NEVER fabricate quotes or attribute words to anyone
- NEVER make up researcher names, expert names, or organizations
- When uncertain, use phrases like "according to the report"
- Better to write shorter than to fabricate details

**Output:** `data/curated-articles.json`

---

### Step 3: Human Review (Manual)

**Interface:** `https://your-site.netlify.app/review.html`

**What you see:**
- All curated articles in expandable accordions
- Category tag (color-coded)
- Headline
- Approve/Deny buttons

**When expanded:**
- Author name, read time, source
- Article excerpt
- Full generated content (lead + body)
- Link to original source

**Actions:**
- **Approve** (green): Article will be published
- **Deny** (red): Article will be excluded
- **Approve All / Deny All**: Bulk actions
- **Publish**: Commits approved articles to GitHub

---

### Step 4: Publish (Semi-Automated)

**When you click "Publish":**

1. Browser filters to only approved articles
2. Builds new `curated-articles.json` with approved content
3. Commits to GitHub via API (using your personal access token)
4. Netlify detects the commit

**Netlify Build Process:**
1. Runs `npm install`
2. Runs `node scripts/generate-site.js`
3. Deploys updated static files

---

### Step 5: Site Generation

**Script:** `scripts/generate-site.js`

**What it generates:**

1. **Article Pages** (`/articles/[slug].html`)
   - Full standalone HTML page for each article
   - Hero image, headline, author, date
   - Full article content with proper styling
   - Source attribution with link to original
   - Consistent header/footer

2. **Homepage** (`index.html`)
   - Hero story (largest, most prominent)
   - Featured grid (3 stories)
   - Three-column grid (3 more stories)
   - Numbered list section (5 stories)
   - All linking to internal `/articles/` pages

3. **Section Pages** (`climate.html`, `health.html`, etc.)
   - 10-20 stories per category
   - Featured article + grid layout

**Permanent URLs:**
- Articles stay at `/articles/[slug].html` forever
- Even when removed from homepage, direct links still work

---

## Automation Schedule

**GitHub Actions Workflow:** `.github/workflows/daily-news.yml`

**Schedule:** Every day at 6 AM Pacific Time (2 PM UTC)

**What runs:**
1. `npm install` - Install dependencies
2. `node scripts/fetch-news.js` - Fetch raw articles
3. `node scripts/curate-with-ai.js` - AI curation
4. Git commit and push
5. Create GitHub Issue with link to review page

**Notification:**
- A GitHub Issue is created titled "Articles Ready for Review"
- You'll get a GitHub notification (email/app based on your settings)
- Issue contains direct link to review page
- Close the issue after publishing

---

## Required Secrets (GitHub Repository Settings)

| Secret Name | Description | Where to get it |
|-------------|-------------|-----------------|
| `ANTHROPIC_API_KEY` | Claude API key | console.anthropic.com |
| `NEWS_API_KEY` | NewsAPI key | newsapi.org |
| `UNSPLASH_ACCESS_KEY` | Unsplash API key (optional) | unsplash.com/developers |

---

## Manual Commands

If you need to run steps manually:

```bash
# Fetch articles
npm run fetch

# Curate with AI
npm run curate

# Generate site HTML
npm run generate

# Start local review server (alternative to web version)
npm run review

# Run full pipeline locally
npm run daily
```

---

## File Structure

```
news-thats-not-crap/
├── index.html              # Homepage
├── climate.html            # Climate section
├── health.html             # Health section
├── science.html            # Science section
├── wildlife.html           # Wildlife section
├── people.html             # People section
├── review.html             # Article review interface
├── articles/               # Generated article pages
│   ├── [slug].html
│   └── ...
├── data/
│   ├── raw-articles.json   # Fetched articles (not committed)
│   ├── curated-articles.json # Curated articles with full content
│   └── last-update.json    # Metadata about last update
├── scripts/
│   ├── fetch-news.js       # Step 1: Fetch from sources
│   ├── curate-with-ai.js   # Step 2: AI curation
│   ├── generate-site.js    # Step 4: Generate HTML
│   ├── review-server.js    # Local review server
│   └── daily-pipeline.js   # Run full pipeline locally
├── .github/
│   └── workflows/
│       └── daily-news.yml  # Automated daily workflow
└── netlify.toml            # Build configuration
```

---

## Troubleshooting

**Articles not showing on review page:**
- Check that `data/curated-articles.json` exists and was committed
- Check browser console for errors

**Publish not working:**
- Verify GitHub token has `repo` scope
- Token may have expired - create a new one

**Netlify build failing:**
- Check Netlify deploy logs
- Ensure `data/curated-articles.json` is valid JSON

**No images loading:**
- Add `UNSPLASH_ACCESS_KEY` to secrets, or
- Images will fall back to category defaults (still looks good)

**Email not sending:**
- Verify Gmail app password (not regular password)
- Check GitHub Actions logs for errors
