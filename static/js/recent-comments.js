(function () {
  'use strict';

  var root = document.getElementById('recent-comments');
  if (!root) return;

  var listEl = root.querySelector('[data-role="list"]');
  var metaEl = root.querySelector('[data-role="meta"]');
  var limit = parseInt(root.getAttribute('data-limit') || '10', 10);
  var dataURL = root.getAttribute('data-url') || '/data/recent-comments.json';
  var repo = root.getAttribute('data-repo') || 'simonlee-hello/MyBlog';
  var indexURL = root.getAttribute('data-index') || '/index.json';

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function relativeTime(iso) {
    var t = Date.parse(iso);
    if (isNaN(t)) return '';
    var diff = Math.max(0, Date.now() - t);
    var sec = Math.floor(diff / 1000);
    if (sec < 60) return '刚刚';
    var min = Math.floor(sec / 60);
    if (min < 60) return min + ' 分钟前';
    var hour = Math.floor(min / 60);
    if (hour < 24) return hour + ' 小时前';
    var day = Math.floor(hour / 24);
    if (day < 7) return day + ' 天前';
    if (day < 30) return Math.floor(day / 7) + ' 周前';
    return Math.floor(day / 30) + ' 个月前';
  }

  function initials(name) {
    var s = String(name || '?').trim();
    if (!s) return '?';
    var parts = s.split(/[\s_-]+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2);
    }
    return s.slice(0, 2).toUpperCase();
  }

  function stripMarkdown(text) {
    return String(text || '')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`[^`]*`/g, ' ')
      .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
      .replace(/\[[^\]]*\]\([^)]+\)/g, function (m) {
        var label = m.match(/^\[([^\]]*)\]/);
        return label ? label[1] : ' ';
      })
      .replace(/[#>*_~]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function normalizePath(p) {
    var s = String(p || '').trim();
    if (!s) return '/';
    if (s.charAt(0) !== '/') s = '/' + s;
    if (s.length > 1 && s.charAt(s.length - 1) !== '/') s += '/';
    return s;
  }

  function render(comments, source) {
    var items = (comments || []).slice(0, limit);
    if (!items.length) {
      listEl.innerHTML = '<div class="recent-comments__empty">暂无评论，来抢沙发吧</div>';
      if (metaEl) metaEl.textContent = '0 条';
      return;
    }

    var html = items.map(function (c) {
      var author = escapeHtml(c.author || '匿名');
      var excerpt = escapeHtml(c.excerpt || '');
      var postTitle = escapeHtml(c.postTitle || '文章');
      var postURL = escapeHtml(c.commentURL || c.postURL || '#');
      var time = relativeTime(c.createdAt);
      var avatar = c.avatar
        ? '<img class="recent-comments__avatar" src="' + escapeHtml(c.avatar) + '" alt="" width="28" height="28" loading="lazy" referrerpolicy="no-referrer">'
        : '<span class="recent-comments__avatar recent-comments__avatar--fallback">' + escapeHtml(initials(c.author)) + '</span>';

      return (
        '<article class="recent-comments__item">' +
          '<div class="recent-comments__top">' +
            avatar +
            '<span class="recent-comments__author">' + author + '</span>' +
            (time ? '<time class="recent-comments__time">' + escapeHtml(time) + '</time>' : '') +
          '</div>' +
          '<p class="recent-comments__excerpt">' + excerpt + '</p>' +
          '<a class="recent-comments__post" href="' + postURL + '">→ ' + postTitle + '</a>' +
        '</article>'
      );
    }).join('');

    listEl.innerHTML = html;
    if (metaEl) {
      var label = items.length + ' 条';
      if (source === 'mock') label += ' · 示例数据';
      else if (source === 'github') label += ' · 实时';
      metaEl.textContent = label;
    }
  }

  function fail(msg) {
    listEl.innerHTML = '<div class="recent-comments__empty">' + escapeHtml(msg || '评论加载失败') + '</div>';
    if (metaEl) metaEl.textContent = '不可用';
  }

  function loadTitleMap() {
    return fetch(indexURL, { credentials: 'same-origin' })
      .then(function (res) { return res.ok ? res.json() : []; })
      .then(function (rows) {
        var map = {};
        (rows || []).forEach(function (row) {
          var uri = normalizePath(row.uri || row.permalink || row.url);
          if (uri && row.title && !map[uri]) map[uri] = row.title;
        });
        return map;
      })
      .catch(function () { return {}; });
  }

  function ghHeaders() {
    return {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };
  }

  function fetchJSON(url) {
    return fetch(url, { headers: ghHeaders() }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    });
  }

  function loadFromGitHub(titleMap) {
    var apiBase = 'https://api.github.com/repos/' + repo;
    return fetchJSON(apiBase + '/discussions?per_page=30').then(function (discussions) {
      var tasks = (discussions || [])
        .filter(function (d) { return (d.comments || 0) > 0; })
        .map(function (d) {
          return fetchJSON(apiBase + '/discussions/' + d.number + '/comments?per_page=30')
            .then(function (comments) {
              var path = normalizePath(d.title);
              var postTitle = titleMap[path] || d.title.replace(/\/$/, '');
              return (comments || []).map(function (c) {
                var excerpt = stripMarkdown(c.body);
                if (excerpt.length > 100) excerpt = excerpt.slice(0, 100) + '…';
                return {
                  id: String(c.id),
                  author: (c.user && c.user.login) || '匿名',
                  avatar: (c.user && c.user.avatar_url) || '',
                  excerpt: excerpt,
                  postTitle: postTitle,
                  postURL: path,
                  commentURL: path + '#comments',
                  createdAt: c.created_at
                };
              });
            });
        });
      return Promise.all(tasks).then(function (groups) {
        return groups
          .reduce(function (acc, cur) { return acc.concat(cur); }, [])
          .sort(function (a, b) {
            return Date.parse(b.createdAt) - Date.parse(a.createdAt);
          });
      });
    });
  }

  function loadFromLocal() {
    return fetch(dataURL, { credentials: 'same-origin' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        return {
          comments: (data && data.comments) || [],
          source: (data && data.source) || 'local'
        };
      });
  }

  loadTitleMap()
    .then(function (titleMap) {
      return loadFromGitHub(titleMap)
        .then(function (comments) {
          render(comments, 'github');
        })
        .catch(function () {
          return loadFromLocal().then(function (data) {
            render(data.comments, data.source);
          });
        });
    })
    .catch(function () {
      fail('暂时无法加载评论');
    });
})();
