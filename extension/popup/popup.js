/* ================================================================
   Swipe Toolkit — Popup Controller (vanilla JS, Manifest V3)
   All dynamic values are escaped through esc() which uses
   textContent-based encoding to prevent XSS.
   ================================================================ */

(() => {
  'use strict';

  // ── State ──────────────────────────────────────────────────────
  let serverUrl = 'https://chrex.ddmn.in';
  let token = null;
  let currentUser = null;

  let folders = [];
  let tags = [];
  let selectedFolderId = null;
  let selectedTagId = null;
  let snippets = [];
  let prompts = [];
  let pinnedIds = [];

  // Usage stats
  let stats = { swipe: 0, email: 0, ai: 0, wa: 0, date: '' };

  // ── Helpers ────────────────────────────────────────────────────
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  function show(el) { el.classList.remove('hidden'); }
  function hide(el) { el.classList.add('hidden'); }

  /** Escape a string for safe insertion into HTML */
  function esc(s) {
    const d = document.createElement('span');
    d.textContent = String(s ?? '');
    return d.innerHTML;
  }

  function stripHTML(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.textContent;
  }

  function toast(msg, type) {
    type = type || 'info';
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'toast ' + type;
    show(t);
    clearTimeout(t._timer);
    t._timer = setTimeout(function () { hide(t); }, 2500);
  }

  function setLoading(btn, loading) {
    if (loading) {
      btn.disabled = true;
      btn._origHTML = btn.textContent;
      btn.textContent = '';
      const spinner = document.createElement('span');
      spinner.className = 'spinner';
      btn.appendChild(spinner);
    } else {
      btn.disabled = false;
      btn.textContent = btn._origHTML || '';
    }
  }

  // ── Storage helpers ────────────────────────────────────────────
  async function loadStorage() {
    return new Promise(function (resolve) {
      chrome.storage.local.get(['token', 'pinnedSnippets', 'usageStats'], function (data) {
        if (data.token) token = data.token;
        if (data.pinnedSnippets) pinnedIds = data.pinnedSnippets;
        if (data.usageStats) stats = data.usageStats;
        // Daily reset
        var today = new Date().toISOString().slice(0, 10);
        if (stats.date !== today) {
          stats = { swipe: 0, email: 0, ai: 0, wa: 0, date: today };
          chrome.storage.local.set({ usageStats: stats });
        }
        resolve();
      });
    });
  }

  function saveToken(t) {
    token = t;
    chrome.storage.local.set({ token: t });
  }

  // Server URL is hardcoded — no user configuration needed

  function savePinnedIds() {
    chrome.storage.local.set({ pinnedSnippets: pinnedIds });
  }

  function incrementStat(key) {
    stats[key] = (stats[key] || 0) + 1;
    chrome.storage.local.set({ usageStats: stats });
    renderStats();
  }

  function renderStats() {
    var map = { swipe: 'stat-swipe', email: 'stat-email', ai: 'stat-ai', wa: 'stat-wa' };
    Object.keys(map).forEach(function (k) {
      var el = $('#' + map[k]);
      if (el) el.textContent = stats[k] || 0;
    });
    // Badges
    var badgeMap = { swipe: 'badge-swipe', email: 'badge-email', ai: 'badge-ai', wa: 'badge-wa' };
    Object.keys(badgeMap).forEach(function (k) {
      var el = $('#' + badgeMap[k]);
      if (!el) return;
      var val = stats[k] || 0;
      if (val > 0) {
        el.textContent = val;
        show(el);
      } else {
        hide(el);
      }
    });
  }

  // ── API helper ─────────────────────────────────────────────────
  async function api(method, path, body) {
    var opts = {
      method: method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    if (body) opts.body = JSON.stringify(body);

    var res;
    try {
      res = await fetch(serverUrl + path, opts);
    } catch (err) {
      throw new Error('Cannot reach server. Check your connection and server URL.');
    }

    if (res.status === 401) {
      token = null;
      chrome.storage.local.remove('token');
      showLogin();
      throw new Error('Session expired. Please log in again.');
    }

    var data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed (' + res.status + ')');
    return data;
  }

  // ── Screen management ─────────────────────────────────────────
  function showLogin() {
    show($('#login-screen'));
    hide($('#app-screen'));
  }

  function showApp() {
    hide($('#login-screen'));
    show($('#app-screen'));
  }

  // ── Tab switching ──────────────────────────────────────────────
  function switchTab(tabName) {
    $$('.tab-btn').forEach(function (b) { b.classList.remove('active'); });
    $$('.tab-panel').forEach(function (p) { p.classList.remove('active'); });
    var tabBtn = document.querySelector('.tab-btn[data-tab="' + tabName + '"]');
    if (tabBtn) tabBtn.classList.add('active');
    var panel = $('#tab-' + tabName);
    if (panel) panel.classList.add('active');
  }

  function initTabs() {
    $$('.tab-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        switchTab(btn.dataset.tab);
      });
    });
  }

  // ══════════════════════════════════════════════════════════════
  //  AUTH
  // ══════════════════════════════════════════════════════════════
  function initAuth() {
    $('#login-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var btn = $('#login-btn');
      var errEl = $('#login-error');
      errEl.textContent = '';
      setLoading(btn, true);
      try {
        var data = await api('POST', '/api/auth/login', {
          email: $('#login-email').value.trim(),
          password: $('#login-password').value,
        });
        saveToken(data.token);
        currentUser = data.user;
        showApp();
        bootstrap();
      } catch (err) {
        errEl.textContent = err.message;
      } finally {
        setLoading(btn, false);
      }
    });

    // Server URL is hardcoded — login settings button removed
  }

  // ══════════════════════════════════════════════════════════════
  //  SETTINGS
  // ══════════════════════════════════════════════════════════════
  function initSettings() {
    $('#btn-logout').addEventListener('click', function () {
      token = null; currentUser = null;
      chrome.storage.local.remove('token');
      showLogin();
      toast('Logged out', 'info');
    });
  }

  function renderUserInfo() {
    var el = $('#settings-user');
    if (!currentUser) { el.textContent = 'Not logged in'; return; }
    el.textContent = '';

    var nameDiv = document.createElement('div');
    nameDiv.className = 'user-name';
    nameDiv.textContent = currentUser.name || currentUser.email;
    el.appendChild(nameDiv);

    var emailDiv = document.createElement('div');
    emailDiv.className = 'user-email';
    emailDiv.textContent = currentUser.email;
    el.appendChild(emailDiv);

    var roleSpan = document.createElement('span');
    roleSpan.className = 'user-role';
    roleSpan.textContent = currentUser.role;
    el.appendChild(roleSpan);
  }

  // ══════════════════════════════════════════════════════════════
  //  FOLDERS
  // ══════════════════════════════════════════════════════════════
  async function loadFolders() {
    try {
      folders = await api('GET', '/api/folders');
    } catch (e) { toast(e.message, 'error'); }
  }

  function buildTree(parentId) {
    return folders.filter(function (f) { return (f.parentId || null) === (parentId || null); });
  }

  function renderFolderTree() {
    var ul = $('#folder-tree');
    ul.textContent = '';

    // "All" item
    var allLi = document.createElement('li');
    var allDiv = document.createElement('div');
    allDiv.className = 'folder-item' + (selectedFolderId === null ? ' selected' : '');
    allDiv.dataset.id = '';
    var iconSpan = document.createElement('span');
    iconSpan.className = 'folder-icon';
    iconSpan.textContent = '\uD83D\uDCC1';
    allDiv.appendChild(iconSpan);
    var nameSpan = document.createElement('span');
    nameSpan.className = 'folder-name';
    nameSpan.textContent = 'All Snippets';
    allDiv.appendChild(nameSpan);
    allDiv.addEventListener('click', function () { selectedFolderId = null; renderFolderTree(); loadAndRenderSnippets(); });
    allLi.appendChild(allDiv);
    ul.appendChild(allLi);

    renderFolderLevel(null, ul);
    populateFolderSelects();
  }

  function renderFolderLevel(parentId, container) {
    var children = buildTree(parentId);
    children.forEach(function (f) {
      var hasChildren = folders.some(function (c) { return c.parentId === f.id; });
      var li = document.createElement('li');

      var item = document.createElement('div');
      item.className = 'folder-item' + (selectedFolderId === f.id ? ' selected' : '');
      item.dataset.id = f.id;

      if (hasChildren) {
        var toggle = document.createElement('span');
        toggle.className = 'folder-toggle';
        toggle.textContent = '\u25BC';
        item.appendChild(toggle);
      } else {
        var spacer = document.createElement('span');
        spacer.style.width = '14px';
        spacer.style.display = 'inline-block';
        item.appendChild(spacer);
      }

      var icon = document.createElement('span');
      icon.className = 'folder-icon';
      icon.textContent = '\uD83D\uDCC2';
      item.appendChild(icon);

      var name = document.createElement('span');
      name.className = 'folder-name';
      name.textContent = f.name;
      item.appendChild(name);

      var actions = document.createElement('span');
      actions.className = 'folder-actions';

      var editBtn = document.createElement('button');
      editBtn.className = 'btn-icon btn-edit-folder';
      editBtn.title = 'Edit';
      editBtn.textContent = '\u270E';
      editBtn.addEventListener('click', function (e) { e.stopPropagation(); openFolderModal(f); });
      actions.appendChild(editBtn);

      var delBtn = document.createElement('button');
      delBtn.className = 'btn-icon btn-del-folder';
      delBtn.title = 'Delete';
      delBtn.textContent = '\u00D7';
      delBtn.addEventListener('click', function (e) { e.stopPropagation(); deleteFolder(f.id); });
      actions.appendChild(delBtn);

      item.appendChild(actions);

      item.addEventListener('click', function (e) {
        if (e.target.closest('.folder-actions')) return;
        selectedFolderId = f.id;
        renderFolderTree();
        loadAndRenderSnippets();
      });

      li.appendChild(item);

      if (hasChildren) {
        var childUl = document.createElement('ul');
        childUl.className = 'folder-children';
        renderFolderLevel(f.id, childUl);
        li.appendChild(childUl);

        var toggleEl = item.querySelector('.folder-toggle');
        if (toggleEl) {
          toggleEl.addEventListener('click', function (e) {
            e.stopPropagation();
            toggleEl.classList.toggle('collapsed');
            childUl.classList.toggle('hidden');
          });
        }
      }

      container.appendChild(li);
    });
  }

  function populateFolderSelects() {
    var selects = [$('#snippet-folder-input'), $('#folder-parent-input')];
    selects.forEach(function (sel) {
      if (!sel) return;
      var current = sel.value;
      sel.textContent = '';
      if (sel.id === 'folder-parent-input') {
        var noneOpt = document.createElement('option');
        noneOpt.value = '';
        noneOpt.textContent = 'None (root)';
        sel.appendChild(noneOpt);
      }
      folders.forEach(function (f) {
        var opt = document.createElement('option');
        opt.value = f.id;
        opt.textContent = f.name;
        sel.appendChild(opt);
      });
      sel.value = current;
    });
  }

  // Folder modal
  function openFolderModal(folder) {
    var isEdit = !!folder;
    $('#folder-modal-title').textContent = isEdit ? 'Edit Folder' : 'New Folder';
    $('#folder-name-input').value = isEdit ? folder.name : '';
    $('#folder-edit-id').value = isEdit ? folder.id : '';
    populateFolderSelects();
    if (isEdit) $('#folder-parent-input').value = folder.parentId || '';
    show($('#folder-modal'));
  }

  function closeFolderModal() { hide($('#folder-modal')); }

  async function saveFolder(e) {
    e.preventDefault();
    var id = $('#folder-edit-id').value;
    var name = $('#folder-name-input').value.trim();
    var parentId = $('#folder-parent-input').value || null;
    if (!name) return;

    try {
      if (id) {
        await api('PUT', '/api/folders/' + id, { name: name, parentId: parentId });
      } else {
        await api('POST', '/api/folders', { name: name, parentId: parentId });
      }
      closeFolderModal();
      await loadFolders();
      renderFolderTree();
      toast(id ? 'Folder updated' : 'Folder created', 'success');
    } catch (err) { toast(err.message, 'error'); }
  }

  async function deleteFolder(id) {
    if (!confirm('Delete this folder and its contents?')) return;
    try {
      await api('DELETE', '/api/folders/' + id);
      if (selectedFolderId === id) selectedFolderId = null;
      await loadFolders();
      renderFolderTree();
      loadAndRenderSnippets();
      toast('Folder deleted', 'success');
    } catch (err) { toast(err.message, 'error'); }
  }

  // ══════════════════════════════════════════════════════════════
  //  TAGS
  // ══════════════════════════════════════════════════════════════
  async function loadTags() {
    try { tags = await api('GET', '/api/tags'); } catch (e) { toast(e.message, 'error'); }
  }

  function renderTagFilter() {
    var bar = $('#tag-filter-bar');
    bar.textContent = '';
    tags.forEach(function (t) {
      var chip = document.createElement('span');
      chip.className = 'tag-chip' + (selectedTagId === t.id ? ' active' : '');

      var dot = document.createElement('span');
      dot.className = 'tag-dot';
      dot.style.background = t.color;
      chip.appendChild(dot);

      chip.appendChild(document.createTextNode(t.name));

      chip.addEventListener('click', function () {
        selectedTagId = selectedTagId === t.id ? null : t.id;
        renderTagFilter();
        loadAndRenderSnippets();
      });
      bar.appendChild(chip);
    });
  }

  function renderTagCheckboxes() {
    var container = $('#snippet-tags-input');
    container.textContent = '';
    tags.forEach(function (t) {
      var lbl = document.createElement('label');
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = t.id;
      lbl.appendChild(cb);

      var dot = document.createElement('span');
      dot.className = 'tag-dot';
      dot.style.background = t.color;
      lbl.appendChild(dot);

      lbl.appendChild(document.createTextNode(' ' + t.name));
      container.appendChild(lbl);
    });
  }

  // ══════════════════════════════════════════════════════════════
  //  SNIPPETS
  // ══════════════════════════════════════════════════════════════
  async function loadAndRenderSnippets() {
    var params = new URLSearchParams();
    if (selectedFolderId) params.set('folder', selectedFolderId);
    if (selectedTagId) params.set('tag', selectedTagId);
    var search = $('#swipe-search').value.trim();
    if (search) params.set('search', search);
    var qs = params.toString();

    try {
      snippets = await api('GET', '/api/snippets' + (qs ? '?' + qs : ''));
    } catch (e) { toast(e.message, 'error'); }
    renderSnippets();
  }

  function renderSnippets() {
    var list = $('#snippet-list');
    list.textContent = '';

    if (snippets.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'empty-state';
      var emptyIcon = document.createElement('span');
      emptyIcon.className = 'empty-state-icon';
      emptyIcon.textContent = '\uD83D\uDCCB';
      empty.appendChild(emptyIcon);
      empty.appendChild(document.createTextNode('No snippets found'));
      list.appendChild(empty);
      return;
    }

    // Separate pinned vs unpinned
    var pinned = [];
    var unpinned = [];
    snippets.forEach(function (s) {
      if (pinnedIds.indexOf(s.id) !== -1) {
        pinned.push(s);
      } else {
        unpinned.push(s);
      }
    });

    if (pinned.length > 0) {
      var sep = document.createElement('div');
      sep.className = 'pinned-separator';
      sep.textContent = '\u2B50 Pinned';
      list.appendChild(sep);
      pinned.forEach(function (s) { list.appendChild(createSnippetCard(s, true)); });
    }

    if (unpinned.length > 0 && pinned.length > 0) {
      var sep2 = document.createElement('div');
      sep2.className = 'pinned-separator';
      sep2.textContent = 'All';
      list.appendChild(sep2);
    }

    unpinned.forEach(function (s) { list.appendChild(createSnippetCard(s, false)); });
  }

  function createSnippetCard(s, isPinned) {
    var card = document.createElement('div');
    card.className = 'snippet-card' + (isPinned ? ' pinned' : '');

    // Header
    var header = document.createElement('div');
    header.className = 'snippet-card-header';

    var title = document.createElement('span');
    title.className = 'snippet-card-title';
    title.textContent = s.title;
    header.appendChild(title);

    var actionsSpan = document.createElement('span');
    actionsSpan.className = 'snippet-card-actions';

    // Pin button
    var pinBtn = document.createElement('button');
    pinBtn.className = 'btn-icon btn-pin' + (isPinned ? ' pinned' : '');
    pinBtn.title = isPinned ? 'Unpin' : 'Pin';
    pinBtn.textContent = '\u2605';
    pinBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      togglePin(s.id);
    });
    actionsSpan.appendChild(pinBtn);

    // Insert button
    var insertBtn = document.createElement('button');
    insertBtn.className = 'btn-icon';
    insertBtn.title = 'Insert into page';
    insertBtn.textContent = '\u2B07';
    insertBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      insertSnippet(s.content);
    });
    actionsSpan.appendChild(insertBtn);

    // Copy button
    var copyBtn = document.createElement('button');
    copyBtn.className = 'btn-icon btn-copy-snippet';
    copyBtn.title = 'Copy';
    copyBtn.textContent = '\uD83D\uDCCB';
    copyBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      navigator.clipboard.writeText(s.content).then(function () {
        toast('Copied!', 'success');
        incrementStat('swipe');
      });
    });
    actionsSpan.appendChild(copyBtn);

    // Edit button
    var editBtnS = document.createElement('button');
    editBtnS.className = 'btn-icon btn-edit-snippet';
    editBtnS.title = 'Edit';
    editBtnS.textContent = '\u270E';
    editBtnS.addEventListener('click', function (e) {
      e.stopPropagation();
      openSnippetModal(s);
    });
    actionsSpan.appendChild(editBtnS);

    // Delete button
    var delBtnS = document.createElement('button');
    delBtnS.className = 'btn-icon btn-del-snippet';
    delBtnS.title = 'Delete';
    delBtnS.textContent = '\u00D7';
    delBtnS.addEventListener('click', function (e) {
      e.stopPropagation();
      deleteSnippet(s.id);
    });
    actionsSpan.appendChild(delBtnS);

    header.appendChild(actionsSpan);
    card.appendChild(header);

    // Preview
    var preview = document.createElement('div');
    preview.className = 'snippet-card-preview';
    preview.textContent = s.content;
    card.appendChild(preview);

    // Tags
    if (s.tags && s.tags.length > 0) {
      var tagsDiv = document.createElement('div');
      tagsDiv.className = 'snippet-card-tags';
      s.tags.forEach(function (st) {
        var tag = st.tag;
        if (!tag) return;
        var tagSpan = document.createElement('span');
        tagSpan.className = 'snippet-tag';
        tagSpan.style.background = tag.color + '22';
        tagSpan.style.color = tag.color;
        tagSpan.textContent = tag.name;
        tagsDiv.appendChild(tagSpan);
      });
      card.appendChild(tagsDiv);
    }

    // Expand on click
    card.addEventListener('click', function (e) {
      if (e.target.closest('.snippet-card-actions')) return;
      preview.classList.toggle('expanded');
    });

    return card;
  }

  function togglePin(id) {
    var idx = pinnedIds.indexOf(id);
    if (idx !== -1) {
      pinnedIds.splice(idx, 1);
    } else {
      pinnedIds.push(id);
    }
    savePinnedIds();
    renderSnippets();
  }

  async function insertSnippet(content) {
    try {
      var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs || !tabs[0]) throw new Error('No active tab');
      await chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: function (text) {
          var el = document.activeElement;
          if (el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || el.isContentEditable)) {
            if (el.isContentEditable) {
              document.execCommand('insertText', false, text);
            } else {
              var start = el.selectionStart || 0;
              var end = el.selectionEnd || 0;
              var val = el.value;
              el.value = val.slice(0, start) + text + val.slice(end);
              el.selectionStart = el.selectionEnd = start + text.length;
              el.dispatchEvent(new Event('input', { bubbles: true }));
            }
            return true;
          }
          return false;
        },
        args: [content]
      });
      toast('Inserted!', 'success');
      incrementStat('swipe');
    } catch (err) {
      // Fallback to clipboard
      navigator.clipboard.writeText(content).then(function () {
        toast('Copied to clipboard (insert failed)', 'info');
        incrementStat('swipe');
      });
    }
  }

  // Snippet modal
  function openSnippetModal(snippet) {
    var isEdit = !!snippet;
    $('#snippet-modal-title').textContent = isEdit ? 'Edit Snippet' : 'New Snippet';
    $('#snippet-title-input').value = isEdit ? snippet.title : '';
    $('#snippet-content-input').value = isEdit ? snippet.content : '';
    $('#snippet-edit-id').value = isEdit ? snippet.id : '';
    populateFolderSelects();
    renderTagCheckboxes();

    if (isEdit) {
      $('#snippet-folder-input').value = snippet.folderId || '';
      var tagIds = (snippet.tags || []).map(function (st) { return st.tag ? st.tag.id : st.tagId; });
      $$('#snippet-tags-input input[type=checkbox]').forEach(function (cb) {
        cb.checked = tagIds.includes(cb.value);
      });
    } else {
      if (selectedFolderId) $('#snippet-folder-input').value = selectedFolderId;
    }
    show($('#snippet-modal'));
  }

  function closeSnippetModal() { hide($('#snippet-modal')); }

  async function saveSnippet(e) {
    e.preventDefault();
    var id = $('#snippet-edit-id').value;
    var titleVal = $('#snippet-title-input').value.trim();
    var contentVal = $('#snippet-content-input').value.trim();
    var folderId = $('#snippet-folder-input').value;
    var tagIds = Array.from($$('#snippet-tags-input input:checked')).map(function (cb) { return cb.value; });
    if (!titleVal || !contentVal || !folderId) return toast('Fill all required fields', 'error');

    try {
      if (id) {
        await api('PUT', '/api/snippets/' + id, { title: titleVal, content: contentVal, folderId: folderId, tagIds: tagIds });
      } else {
        await api('POST', '/api/snippets', { title: titleVal, content: contentVal, folderId: folderId, tagIds: tagIds });
      }
      closeSnippetModal();
      await loadAndRenderSnippets();
      toast(id ? 'Snippet updated' : 'Snippet created', 'success');
    } catch (err) { toast(err.message, 'error'); }
  }

  async function deleteSnippet(id) {
    if (!confirm('Delete this snippet?')) return;
    try {
      await api('DELETE', '/api/snippets/' + id);
      await loadAndRenderSnippets();
      toast('Snippet deleted', 'success');
    } catch (err) { toast(err.message, 'error'); }
  }

  // Search debounce
  var searchTimer;
  function initSnippetSearch() {
    $('#swipe-search').addEventListener('input', function () {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(loadAndRenderSnippets, 300);
    });
  }

  // ══════════════════════════════════════════════════════════════
  //  EMAIL VALIDATOR
  // ══════════════════════════════════════════════════════════════
  function initEmailValidator() {
    // Mode toggle
    $$('.mode-toggle-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        $$('.mode-toggle-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        var mode = btn.dataset.mode;
        if (mode === 'single') {
          show($('#email-single-mode'));
          hide($('#email-bulk-mode'));
        } else {
          hide($('#email-single-mode'));
          show($('#email-bulk-mode'));
        }
      });
    });

    // Single validate
    $('#btn-validate-email').addEventListener('click', async function () {
      var email = $('#validate-email-input').value.trim();
      if (!email) return toast('Enter an email address', 'error');
      var btn = $('#btn-validate-email');
      var resultEl = $('#email-result');
      hide(resultEl);
      setLoading(btn, true);

      try {
        var data = await api('POST', '/api/validate-email', { email: email });
        show(resultEl);
        renderEmailResult(data, resultEl);
        incrementStat('email');
      } catch (err) {
        show(resultEl);
        resultEl.textContent = '';
        var errDiv = document.createElement('div');
        errDiv.className = 'error-text';
        errDiv.textContent = err.message;
        resultEl.appendChild(errDiv);
      } finally {
        setLoading(btn, false);
      }
    });

    // Bulk validate
    $('#btn-validate-bulk').addEventListener('click', async function () {
      var raw = $('#bulk-email-input').value.trim();
      if (!raw) return toast('Paste email addresses', 'error');
      var emails = raw.split('\n').map(function (e) { return e.trim(); }).filter(function (e) { return e.length > 0; });
      if (emails.length === 0) return toast('No valid emails found', 'error');

      var btn = $('#btn-validate-bulk');
      setLoading(btn, true);
      var progressEl = $('#bulk-progress');
      var progressFill = $('#bulk-progress-fill');
      var progressText = $('#bulk-progress-text');
      var resultsEl = $('#bulk-results');
      var controlsEl = $('#bulk-results-controls');
      show(progressEl);
      hide(resultsEl);
      hide(controlsEl);

      var results = [];
      for (var i = 0; i < emails.length; i++) {
        progressFill.style.width = ((i + 1) / emails.length * 100) + '%';
        progressText.textContent = (i + 1) + '/' + emails.length;
        try {
          var data = await api('POST', '/api/validate-email', { email: emails[i] });
          results.push({ email: emails[i], status: data.status || 'unknown', data: data });
          incrementStat('email');
        } catch (err) {
          results.push({ email: emails[i], status: 'error', error: err.message });
        }
      }

      setLoading(btn, false);
      show(controlsEl);
      show(resultsEl);
      renderBulkResults(results);

      // Store results for filtering and copy
      resultsEl._data = results;
    });

    // Filter toggle
    $('#bulk-filter-valid').addEventListener('change', function () {
      var resultsEl = $('#bulk-results');
      if (!resultsEl._data) return;
      renderBulkResults(resultsEl._data);
    });

    // Copy bulk results
    $('#btn-copy-bulk').addEventListener('click', function () {
      var resultsEl = $('#bulk-results');
      if (!resultsEl._data) return;
      var filterValid = $('#bulk-filter-valid').checked;
      var lines = resultsEl._data
        .filter(function (r) { return !filterValid || r.status === 'valid' || r.status === 'safe'; })
        .map(function (r) { return r.email + ' — ' + r.status; });
      navigator.clipboard.writeText(lines.join('\n')).then(function () {
        toast('Results copied!', 'success');
      });
    });
  }

  function renderBulkResults(results) {
    var el = $('#bulk-results');
    el.textContent = '';
    var filterValid = $('#bulk-filter-valid').checked;
    var safeStatuses = ['valid', 'safe'];

    results.forEach(function (r) {
      if (filterValid && safeStatuses.indexOf(r.status) === -1) return;

      var item = document.createElement('div');
      item.className = 'bulk-result-item';

      var emailSpan = document.createElement('span');
      emailSpan.className = 'bulk-result-email';
      emailSpan.textContent = r.email;
      item.appendChild(emailSpan);

      var pill = document.createElement('span');
      pill.className = 'status-pill';
      var badStatuses = ['invalid', 'disabled', 'spamtrap', 'error'];
      if (safeStatuses.indexOf(r.status) !== -1) {
        pill.classList.add('valid');
      } else if (badStatuses.indexOf(r.status) !== -1) {
        pill.classList.add('invalid');
      } else {
        pill.classList.add('risky');
      }
      pill.textContent = r.status;
      item.appendChild(pill);

      el.appendChild(item);
    });

    if (el.children.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'bulk-result-item';
      empty.textContent = 'No results match filter';
      empty.style.justifyContent = 'center';
      empty.style.color = 'var(--gray-400)';
      el.appendChild(empty);
    }
  }

  function renderEmailResult(data, el) {
    el.textContent = '';
    var safeStatuses = ['valid', 'safe'];
    var badStatuses = ['invalid', 'disabled', 'spamtrap'];
    var statusClass = safeStatuses.indexOf(data.status) !== -1 ? 'status-valid'
      : badStatuses.indexOf(data.status) !== -1 ? 'status-invalid' : 'status-risky';

    var rows = [
      ['Email', data.email || ''],
      ['Status', data.status || ''],
      ['Overall Score', String(data.overall_score != null ? data.overall_score + '/100' : '-')],
      ['Safe to Send', data.is_safe_to_send != null ? String(data.is_safe_to_send) : '-'],
      ['Deliverable', data.is_deliverable != null ? String(data.is_deliverable) : '-'],
      ['Catch-All', data.is_catch_all != null ? String(data.is_catch_all) : '-'],
      ['Disposable', data.is_disposable != null ? String(data.is_disposable) : '-'],
      ['Role Account', data.is_role_account != null ? String(data.is_role_account) : '-'],
      ['Free Email', data.is_free_email != null ? String(data.is_free_email) : '-'],
    ];

    rows.forEach(function (pair, idx) {
      var row = document.createElement('div');
      row.className = 'result-row';

      var label = document.createElement('span');
      label.className = 'result-label';
      label.textContent = pair[0];
      row.appendChild(label);

      var value = document.createElement('span');
      value.className = 'result-value';
      if (idx === 1) value.className += ' ' + statusClass;
      value.textContent = pair[1];
      row.appendChild(value);

      el.appendChild(row);
    });

    var copyBtn = document.createElement('button');
    copyBtn.className = 'btn btn-sm btn-outline copy-btn';
    copyBtn.textContent = 'Copy';
    copyBtn.addEventListener('click', function () {
      var text = rows.map(function (r) { return r[0] + ': ' + r[1]; }).join('\n');
      navigator.clipboard.writeText(text).then(function () { toast('Copied!', 'success'); });
    });
    el.appendChild(copyBtn);
  }

  // ══════════════════════════════════════════════════════════════
  //  AI GENERATOR
  // ══════════════════════════════════════════════════════════════
  async function loadPrompts(category) {
    try {
      var qs = category ? '?category=' + encodeURIComponent(category) : '';
      prompts = await api('GET', '/api/prompts' + qs);
    } catch (e) { toast(e.message, 'error'); }
  }

  function renderPromptDropdown() {
    var sel = $('#ai-prompt');
    sel.textContent = '';
    var defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = 'Select prompt';
    sel.appendChild(defaultOpt);

    prompts.forEach(function (p) {
      var opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      sel.appendChild(opt);
    });
  }

  async function populateCategories() {
    await loadPrompts();
    var categories = [];
    prompts.forEach(function (p) {
      if (p.category && categories.indexOf(p.category) === -1) categories.push(p.category);
    });
    var sel = $('#ai-category');
    sel.textContent = '';
    var allOpt = document.createElement('option');
    allOpt.value = '';
    allOpt.textContent = 'All';
    sel.appendChild(allOpt);
    categories.forEach(function (c) {
      var opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      sel.appendChild(opt);
    });
    renderPromptDropdown();
  }

  function initAIGenerator() {
    $('#ai-category').addEventListener('change', async function () {
      var cat = $('#ai-category').value;
      await loadPrompts(cat || undefined);
      renderPromptDropdown();
    });

    $('#btn-generate').addEventListener('click', async function () {
      var content = $('#ai-content').value.trim();
      var promptId = $('#ai-prompt').value;
      if (!content) return toast('Enter or select some content', 'error');
      if (!promptId) return toast('Select a prompt', 'error');

      var btn = $('#btn-generate');
      setLoading(btn, true);
      hide($('#ai-result'));

      try {
        var data = await api('POST', '/api/generate', { content: content, promptId: promptId });
        $('#ai-result-text').textContent = data.result || '';
        show($('#ai-result'));
        incrementStat('ai');

        // If WhatsApp callback is pending, send result back
        if (window._waAICallback) {
          window._waAICallback(data.result || '');
          delete window._waAICallback;
          switchTab('whatsapp');
          toast('AI result added to message', 'success');
        }
      } catch (err) { toast(err.message, 'error'); } finally { setLoading(btn, false); }
    });

    $('#btn-copy-ai').addEventListener('click', function () {
      var text = $('#ai-result-text').textContent;
      navigator.clipboard.writeText(text).then(function () { toast('Copied!', 'success'); });
    });

    $('#btn-gmail-compose').addEventListener('click', function () {
      var text = $('#ai-result-text').textContent.trim();
      if (!text) return toast('No content to compose', 'error');

      // Try to extract subject line from the result (look for "Subject: ...")
      var subject = '';
      var body = text;
      var subjectMatch = text.match(/^Subject:\s*(.+)/im);
      if (subjectMatch) {
        subject = subjectMatch[1].trim();
        body = text.replace(/^Subject:\s*.+\n*/im, '').trim();
        body = body.replace(/^Email:\s*\n*/im, '').trim();
      }

      var gmailUrl = 'https://mail.google.com/mail/?view=cm&fs=1'
        + '&su=' + encodeURIComponent(subject)
        + '&body=' + encodeURIComponent(body);

      chrome.tabs.create({ url: gmailUrl });
    });

    // Auto-detect selection from page
    detectSelection();
  }

  async function detectSelection() {
    // 1. Check pending selection from context menu
    chrome.storage.local.get('pendingSelection', function (data) {
      if (data.pendingSelection) {
        $('#ai-content').value = data.pendingSelection;
        chrome.runtime.sendMessage({ type: 'CLEAR_PENDING_SELECTION' });
        switchTab('ai');
        return;
      }

      // 2. Ask content script for current selection
      chrome.runtime.sendMessage({ type: 'GET_SELECTION' }, function (response) {
        if (response && response.text && !$('#ai-content').value) {
          $('#ai-content').value = response.text;
        }
      });
    });
  }

  // ══════════════════════════════════════════════════════════════
  //  WHATSAPP SEND
  // ══════════════════════════════════════════════════════════════
  function initWhatsApp() {
    var msgEl = $('#wa-message');
    var previewEl = $('#wa-preview');
    var previewText = $('#wa-preview-text');

    msgEl.addEventListener('input', function () {
      var val = msgEl.value.trim();
      if (val) { show(previewEl); previewText.textContent = val; }
      else { hide(previewEl); }
    });

    $('#btn-wa-send').addEventListener('click', async function () {
      var phone = $('#wa-phone').value.trim();
      var message = msgEl.value.trim();
      if (!phone) return toast('Enter a phone number', 'error');
      if (!message) return toast('Enter a message', 'error');

      var btn = $('#btn-wa-send');
      setLoading(btn, true);
      hide($('#wa-result'));

      try {
        var data = await api('POST', '/api/whatsapp/send', { phone: phone, message: message });
        var resultEl = $('#wa-result');
        show(resultEl);
        resultEl.textContent = '';

        var statusRow = document.createElement('div');
        statusRow.className = 'result-row';
        var statusLabel = document.createElement('span');
        statusLabel.className = 'result-label';
        statusLabel.textContent = 'Status';
        statusRow.appendChild(statusLabel);
        var statusValue = document.createElement('span');
        statusValue.className = 'result-value status-valid';
        statusValue.textContent = data.status || 'sent';
        statusRow.appendChild(statusValue);
        resultEl.appendChild(statusRow);

        if (data.messageId) {
          var idRow = document.createElement('div');
          idRow.className = 'result-row';
          var idLabel = document.createElement('span');
          idLabel.className = 'result-label';
          idLabel.textContent = 'Message ID';
          idRow.appendChild(idLabel);
          var idValue = document.createElement('span');
          idValue.className = 'result-value';
          idValue.textContent = data.messageId;
          idRow.appendChild(idValue);
          resultEl.appendChild(idRow);
        }

        toast('Message sent!', 'success');
        incrementStat('wa');
      } catch (err) {
        var resultEl2 = $('#wa-result');
        show(resultEl2);
        resultEl2.textContent = '';
        var errDiv = document.createElement('div');
        errDiv.className = 'error-text';
        errDiv.textContent = err.message;
        resultEl2.appendChild(errDiv);
      } finally { setLoading(btn, false); }
    });

    // "Use AI" button
    $('#btn-wa-use-ai').addEventListener('click', async function () {
      switchTab('ai');

      var catSel = $('#ai-category');
      var waOption = Array.from(catSel.options).find(function (o) { return o.value.toLowerCase().indexOf('whatsapp') !== -1; });
      if (waOption) {
        catSel.value = waOption.value;
        await loadPrompts(waOption.value);
        renderPromptDropdown();
      }

      window._waAICallback = function (text) {
        msgEl.value = text;
        msgEl.dispatchEvent(new Event('input'));
      };
    });
  }

  // ══════════════════════════════════════════════════════════════
  //  BOOTSTRAP
  // ══════════════════════════════════════════════════════════════
  async function bootstrap() {
    try {
      currentUser = await api('GET', '/api/auth/me');
    } catch (e) {
      showLogin();
      return;
    }
    renderUserInfo();
    renderStats();
    // Server URL display removed — hardcoded

    // Load data in parallel
    await Promise.all([loadFolders(), loadTags(), populateCategories()]);
    renderFolderTree();
    renderTagFilter();
    loadAndRenderSnippets();
  }

  // ── Modal wiring ──────────────────────────────────────────────
  function initModals() {
    $('#btn-new-snippet').addEventListener('click', function () { openSnippetModal(null); });
    $('#snippet-modal-close').addEventListener('click', closeSnippetModal);
    $('#snippet-modal-cancel').addEventListener('click', closeSnippetModal);
    $('#snippet-modal .modal-overlay').addEventListener('click', closeSnippetModal);
    $('#snippet-form').addEventListener('submit', saveSnippet);

    $('#btn-new-folder').addEventListener('click', function () { openFolderModal(null); });
    $('#folder-modal-close').addEventListener('click', closeFolderModal);
    $('#folder-modal-cancel').addEventListener('click', closeFolderModal);
    $('#folder-modal .modal-overlay').addEventListener('click', closeFolderModal);
    $('#folder-form').addEventListener('submit', saveFolder);
  }

  // ── Init ───────────────────────────────────────────────────────
  async function init() {
    await loadStorage();
    initTabs();
    initAuth();
    initSettings();
    initModals();
    initSnippetSearch();
    initEmailValidator();
    initAIGenerator();
    initWhatsApp();
    renderStats();

    if (token) {
      showApp();
      bootstrap();
    } else {
      showLogin();
    }
  }

  init();
})();
