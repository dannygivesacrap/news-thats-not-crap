/**
 * Local CMS for reviewing and approving daily articles
 *
 * Run: node scripts/review-server.js
 * Open: http://localhost:3000/review
 */

import 'dotenv/config';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateSite } from './generate-site.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const PORT = 3000;

// Load curated articles
function loadArticles() {
  const curatedPath = path.join(DATA_DIR, 'curated-articles.json');
  if (!fs.existsSync(curatedPath)) {
    return { allArticles: [], homepage: { hero: null, featured: [] }, sections: {} };
  }
  const data = JSON.parse(fs.readFileSync(curatedPath, 'utf8'));

  // Handle both old and new structure
  if (!data.allArticles) {
    data.allArticles = [data.hero, ...(data.featured || []), ...(data.more || [])].filter(Boolean);
  }

  // Add approved status if not present
  data.allArticles.forEach((article, i) => {
    if (article.approved === undefined) {
      article.approved = true; // Default to approved
    }
    article._index = i;
  });

  return data;
}

// Save articles with approval status
function saveArticles(data) {
  const curatedPath = path.join(DATA_DIR, 'curated-articles.json');
  fs.writeFileSync(curatedPath, JSON.stringify(data, null, 2));
}

// Generate the review HTML page
function generateReviewHTML(data) {
  const articles = data.allArticles || [];
  const approvedCount = articles.filter(a => a.approved).length;

  const articlesHTML = articles.map((article, index) => {
    const statusClass = article.approved ? 'approved' : 'denied';
    const categoryColor = {
      climate: '#2dcb98',
      health: '#e85d4c',
      science: '#4368ff',
      wildlife: '#e84393',
      people: '#7b68ee'
    }[article.category] || '#666';

    return `
      <div class="article-item ${statusClass}" data-index="${index}">
        <div class="article-header" onclick="toggleArticle(${index})">
          <div class="article-status">
            <span class="status-indicator"></span>
          </div>
          <div class="article-info">
            <span class="category-tag" style="background: ${categoryColor}">${article.category}</span>
            <h3>${escapeHtml(article.headline)}</h3>
          </div>
          <div class="article-actions">
            <button class="btn btn-approve ${article.approved ? 'active' : ''}" onclick="event.stopPropagation(); setApproval(${index}, true)">Approve</button>
            <button class="btn btn-deny ${!article.approved ? 'active' : ''}" onclick="event.stopPropagation(); setApproval(${index}, false)">Deny</button>
          </div>
          <span class="expand-icon">▼</span>
        </div>
        <div class="article-content" id="content-${index}">
          <div class="article-meta">
            <span>By ${escapeHtml(article.author)}</span>
            <span>${article.readTime} min read</span>
            <span>Source: ${escapeHtml(article.sourceName)}</span>
          </div>
          <p class="excerpt">${escapeHtml(article.excerpt)}</p>
          ${article.fullContent ? `
            <div class="full-content">
              <h4>Lead</h4>
              <p>${escapeHtml(article.fullContent.lead)}</p>
              <h4>Body</h4>
              ${(article.fullContent.body || []).map(p => `<p>${escapeHtml(p)}</p>`).join('')}
            </div>
          ` : ''}
          <a href="${article.sourceUrl}" target="_blank" class="source-link">View Original Source →</a>
        </div>
      </div>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Review Articles | News That's Not Crap</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f4f2;
            color: #1a1a1a;
            line-height: 1.6;
        }
        .header {
            background: #4368ff;
            color: white;
            padding: 1.5rem 2rem;
            position: sticky;
            top: 0;
            z-index: 100;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .header h1 { font-size: 1.5rem; font-weight: 800; }
        .header-stats {
            display: flex;
            gap: 1.5rem;
            align-items: center;
        }
        .stat { font-size: 0.9rem; opacity: 0.9; }
        .stat strong { font-size: 1.2rem; }
        .container { max-width: 1000px; margin: 0 auto; padding: 2rem; }
        .publish-bar {
            background: white;
            padding: 1.5rem;
            border-radius: 12px;
            margin-bottom: 2rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }
        .publish-info { color: #666; }
        .btn-publish {
            background: #1B873F;
            color: white;
            border: none;
            padding: 1rem 2rem;
            font-size: 1rem;
            font-weight: 700;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s;
        }
        .btn-publish:hover { background: #156b32; transform: translateY(-2px); }
        .btn-publish:disabled { background: #ccc; cursor: not-allowed; transform: none; }
        .article-item {
            background: white;
            border-radius: 12px;
            margin-bottom: 1rem;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
            border-left: 4px solid #1B873F;
            transition: all 0.2s;
        }
        .article-item.denied { border-left-color: #e85d4c; opacity: 0.7; }
        .article-header {
            padding: 1rem 1.5rem;
            display: flex;
            align-items: center;
            gap: 1rem;
            cursor: pointer;
        }
        .article-header:hover { background: #f9f9f9; }
        .article-status { width: 24px; flex-shrink: 0; }
        .status-indicator {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            display: block;
            background: #1B873F;
        }
        .denied .status-indicator { background: #e85d4c; }
        .article-info { flex: 1; }
        .category-tag {
            display: inline-block;
            color: white;
            font-size: 0.65rem;
            font-weight: 700;
            text-transform: uppercase;
            padding: 0.2rem 0.5rem;
            border-radius: 4px;
            margin-bottom: 0.25rem;
        }
        .article-info h3 { font-size: 1rem; font-weight: 600; }
        .article-actions { display: flex; gap: 0.5rem; }
        .btn {
            border: 2px solid #ddd;
            background: white;
            padding: 0.4rem 0.8rem;
            font-size: 0.75rem;
            font-weight: 600;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s;
        }
        .btn-approve.active { background: #1B873F; color: white; border-color: #1B873F; }
        .btn-deny.active { background: #e85d4c; color: white; border-color: #e85d4c; }
        .expand-icon {
            color: #999;
            transition: transform 0.2s;
        }
        .article-item.expanded .expand-icon { transform: rotate(180deg); }
        .article-content {
            display: none;
            padding: 0 1.5rem 1.5rem 3.5rem;
            border-top: 1px solid #eee;
        }
        .article-item.expanded .article-content { display: block; }
        .article-meta {
            display: flex;
            gap: 1rem;
            color: #888;
            font-size: 0.85rem;
            margin: 1rem 0;
        }
        .excerpt {
            font-size: 0.95rem;
            color: #444;
            margin-bottom: 1rem;
        }
        .full-content { background: #f9f9f9; padding: 1rem; border-radius: 8px; margin: 1rem 0; }
        .full-content h4 { font-size: 0.8rem; color: #666; text-transform: uppercase; margin: 0.5rem 0; }
        .full-content p { font-size: 0.9rem; margin-bottom: 0.75rem; }
        .source-link { color: #4368ff; font-weight: 600; text-decoration: none; }
        .source-link:hover { text-decoration: underline; }
        .loading { text-align: center; padding: 3rem; color: #666; }
        .message {
            padding: 1rem;
            border-radius: 8px;
            margin-bottom: 1rem;
            font-weight: 500;
        }
        .message.success { background: #d4edda; color: #155724; }
        .message.error { background: #f8d7da; color: #721c24; }
    </style>
</head>
<body>
    <header class="header">
        <h1>Review Today's Articles</h1>
        <div class="header-stats">
            <div class="stat"><strong id="approved-count">${approvedCount}</strong> approved</div>
            <div class="stat"><strong id="total-count">${articles.length}</strong> total</div>
        </div>
    </header>

    <div class="container">
        <div id="message"></div>

        <div class="publish-bar">
            <div class="publish-info">
                Review articles below, then publish when ready.
            </div>
            <button class="btn-publish" onclick="publish()" id="publish-btn">
                Publish Approved Articles
            </button>
        </div>

        <div id="articles-list">
            ${articlesHTML}
        </div>
    </div>

    <script>
        let articles = ${JSON.stringify(articles)};

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text || '';
            return div.innerHTML;
        }

        function toggleArticle(index) {
            const item = document.querySelector(\`.article-item[data-index="\${index}"]\`);
            item.classList.toggle('expanded');
        }

        async function setApproval(index, approved) {
            articles[index].approved = approved;

            // Update UI
            const item = document.querySelector(\`.article-item[data-index="\${index}"]\`);
            if (approved) {
                item.classList.remove('denied');
                item.classList.add('approved');
            } else {
                item.classList.remove('approved');
                item.classList.add('denied');
            }

            // Update buttons
            item.querySelector('.btn-approve').classList.toggle('active', approved);
            item.querySelector('.btn-deny').classList.toggle('active', !approved);

            // Update count
            const approvedCount = articles.filter(a => a.approved).length;
            document.getElementById('approved-count').textContent = approvedCount;

            // Save to server
            try {
                await fetch('/api/update-approval', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ index, approved })
                });
            } catch (error) {
                console.error('Failed to save:', error);
            }
        }

        async function publish() {
            const btn = document.getElementById('publish-btn');
            const msgEl = document.getElementById('message');
            btn.disabled = true;
            btn.textContent = 'Publishing...';
            msgEl.innerHTML = '';

            try {
                const response = await fetch('/api/publish', { method: 'POST' });
                const result = await response.json();

                if (result.success) {
                    msgEl.innerHTML = '<div class="message success">Published successfully! Site will update shortly.</div>';
                } else {
                    throw new Error(result.error || 'Unknown error');
                }
            } catch (error) {
                msgEl.innerHTML = '<div class="message error">Error: ' + escapeHtml(error.message) + '</div>';
            } finally {
                btn.disabled = false;
                btn.textContent = 'Publish Approved Articles';
            }
        }
    </script>
</body>
</html>`;
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Create HTTP server
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // Review page
  if (url.pathname === '/review' || url.pathname === '/') {
    const data = loadArticles();
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(generateReviewHTML(data));
    return;
  }

  // Update approval status
  if (url.pathname === '/api/update-approval' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { index, approved } = JSON.parse(body);
        const data = loadArticles();
        if (data.allArticles[index]) {
          data.allArticles[index].approved = approved;
          saveArticles(data);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
    });
    return;
  }

  // Publish approved articles
  if (url.pathname === '/api/publish' && req.method === 'POST') {
    try {
      const data = loadArticles();

      // Filter to only approved articles
      const approvedArticles = data.allArticles.filter(a => a.approved);

      // Update the data structure with only approved articles
      data.allArticles = approvedArticles;

      // Update homepage hero/featured
      data.homepage = {
        hero: approvedArticles.find(a => a.isHomepageHero) || approvedArticles[0],
        featured: approvedArticles.filter(a => a.isHomepageFeatured).slice(0, 14)
      };

      // Update sections
      data.sections = {};
      ['climate', 'health', 'science', 'wildlife', 'people'].forEach(cat => {
        data.sections[cat] = approvedArticles.filter(a => a.category === cat);
      });

      saveArticles(data);

      // Generate site
      console.log('Generating site with approved articles...');
      await generateSite();

      // Git commit and push
      console.log('Pushing to GitHub...');
      const rootDir = path.join(__dirname, '..');
      await execAsync('git add -A', { cwd: rootDir });
      await execAsync('git commit -m "Publish approved articles"', { cwd: rootDir });
      await execAsync('git push origin main', { cwd: rootDir });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, articleCount: approvedArticles.length }));
    } catch (error) {
      console.error('Publish error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`\n🗞️  Article Review CMS running at http://localhost:${PORT}/review\n`);
  console.log('Open this URL in your browser to review and approve articles.\n');
});
