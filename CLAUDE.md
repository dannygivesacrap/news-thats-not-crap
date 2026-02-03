# CLAUDE.md - Project Instructions for AI Assistants

> **LOCKED FILE - DO NOT MODIFY WITHOUT EXPLICIT USER PERMISSION**
>
> This file defines critical project requirements. AI assistants:
> - MUST read this file completely before making any changes to the project
> - MUST NOT remove, simplify, or "clean up" any requirements listed here
> - MUST ask "Can I update CLAUDE.md?" and receive an affirmative response BEFORE editing
> - MUST ask the user before removing any feature mentioned in this file
>
> If you're tempted to remove something because it seems redundant or outdated, ASK FIRST.

## Project Overview

"News That's Not Crap" is a positive news aggregation site for Who Gives A Crap (WGAC). It automatically curates feel-good news stories, rewrites them in WGAC's playful voice, and publishes them daily.

## Critical Requirements (DO NOT REMOVE)

### 1. Fact Checking
- Every generated article MUST be fact-checked against its source
- The fact-check step runs AFTER article generation in `curate-with-ai.js`
- Facts, quotes, statistics, and names must be verified against source material
- Articles that fail fact-checking should be flagged or rejected

### 2. Article Archive
- Old articles MUST be preserved and remain accessible
- Archive page (`archive.html`) shows all historical articles organized by date
- Original article URLs (`/articles/[slug].html`) must NEVER break
- Historical articles stored in `data/article-archive.json`
- Generate-site.js must NEVER delete old article HTML files

### 3. Image Pool
- 100 curated images per category (500 total)
- Images rotate to ensure variety
- No API calls needed - all URLs are pre-verified Unsplash images
- Categories: climate, health, science, wildlife, people

### 4. Publishing Flow & Timeline
| Time | Event |
|------|-------|
| 6:00 AM Pacific | Pipeline starts (daily-news.yml) |
| ~6:05 AM | News fetched from NewsAPI |
| ~6:30-7:00 AM | AI curation + fact-checking completes |
| ~7:00 AM | GitHub Issue created for review notification |
| 9:00 AM Pacific | Auto-publish if not reviewed (auto-publish.yml) |

- Manual review available at review.html anytime before 9 AM
- If manually reviewed, articles publish immediately
- If not reviewed by 9 AM, auto-publish workflow runs

### 5. Voice & Tone
- Warm, conversational, like a smart friend sharing good news
- Playful with puns when natural
- DO NOT reference being a toilet paper company in every article
- Each article opening should be unique
- Optimistic but grounded in facts

## File Structure

```
/
├── CLAUDE.md                 # THIS FILE - project instructions
├── index.html                # Homepage
├── archive.html              # Historical articles by date
├── climate.html              # Climate section
├── health.html               # Health section
├── science.html              # Science section
├── wildlife.html             # Wildlife section
├── people.html               # People section
├── review.html               # Article approval CMS
├── articles/                 # Generated article pages (NEVER DELETE)
│   └── [slug].html
├── data/
│   ├── raw-articles.json     # Fetched from NewsAPI
│   ├── curated-articles.json # Current day's curated articles
│   ├── article-archive.json  # Historical article metadata
│   └── last-update.json      # Generation metadata
├── scripts/
│   ├── fetch-news.js         # Fetches from NewsAPI
│   ├── curate-with-ai.js     # AI curation + fact-checking
│   └── generate-site.js      # HTML generation + archive
└── .github/workflows/
    ├── daily-news.yml        # 6 AM pipeline
    └── auto-publish.yml      # 9 AM auto-publish
```

## Required Secrets (GitHub)

- `NEWS_API_KEY` - From newsapi.org
- `ANTHROPIC_API_KEY` - For Claude AI

## Pipeline Steps (in order)

1. **Fetch** - Get raw articles from NewsAPI
2. **Curate** - AI selects and categorizes positive stories
3. **Rewrite** - AI generates full articles in WGAC voice
4. **Fact-Check** - AI verifies facts against source (REQUIRED)
5. **Commit** - Save to data/curated-articles.json
6. **Notify** - Create GitHub Issue for review
7. **Review** - Manual approval via review.html (optional)
8. **Auto-Publish** - 9 AM if not manually reviewed
9. **Generate** - Create HTML pages
10. **Archive** - Add to historical archive

## Section Colors

- Climate: `--wgac-teal` (#2dcb98)
- Health: `--wgac-coral` (#e85d4c)
- Science: `--wgac-blue` (#4368ff)
- Wildlife: `--wgac-pink` (#e84393)
- People: `--wgac-purple` (#7b68ee)

## Styling Requirements

All section pages must match the same CSS structure:
- Logo slide-in animation
- Nav fade-in animation
- Card hover effects with shadows
- Pill-shaped category tags
- "Updated at XX:XX on [Date]" in header

## DO NOT

- Delete old article HTML files
- Skip the fact-checking step
- Use repetitive article openings
- Reference toilet paper in every article
- Remove archive functionality
- Break existing article URLs
- Use Unsplash API (use curated image pool instead)
- Modify this CLAUDE.md file without explicit user permission

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-02-03 | Initial version with all core requirements |

**Current Version: 1.0**

When updating this file, increment the version and add a row to the table above.
