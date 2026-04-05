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
      chrome.storage.local.get(['serverUrl', 'token'], function (data) {
        if (data.serverUrl) serverUrl = data.serverUrl;
        if (data.token) token = data.token;
        resolve();
      });
    });
  }

  function saveToken(t) {
    token = t;
    chrome.storage.local.set({ token: t });
  }

  function saveServerUrl(url) {
    serverUrl = url;
    chrome.storage.local.set({ serverUrl: url });
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
    var tabBtn = document.querySelector('[data-tab="' + tabName + '"]');
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

    $('#login-settings-btn').addEventListener('click', function () {
      var url = prompt('Server URL:', serverUrl);
      if (url) { saveServerUrl(url.replace(/\/+$/, '')); toast('Server URL saved', 'success'); }
    });
  }

  // ══════════════════════════════════════════════════════════════
  //  SETTINGS
  // ══════════════════════════════════════════════════════════════
  function initSettings() {
    $('#settings-server').value = serverUrl;

    $('#btn-save-settings').addEventListener('click', function () {
      var url = $('#settings-server').value.trim().replace(/\/+$/, '');
      if (!url) return toast('Enter a valid URL', 'error');
      saveServerUrl(url);
      toast('Settings saved', 'success');
    });

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
    iconSpan.textContent = '\uD83D\uDCC1'; // folder emoji
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

      // Toggle arrow
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
      icon.textContent = '\uD83D\uDCC2'; // open folder emoji
      item.appendChild(icon);

      var name = document.createElement('span');
      name.className = 'folder-name';
      name.textContent = f.name;
      item.appendChild(name);

      // Actions
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
      empty.textContent = 'No snippets found.';
      list.appendChild(empty);
      return;
    }

    snippets.forEach(function (s) {
      var card = document.createElement('div');
      card.className = 'snippet-card';

      // Header
      var header = document.createElement('div');
      header.className = 'snippet-card-header';

      var title = document.createElement('span');
      title.className = 'snippet-card-title';
      title.textContent = s.title;
      header.appendChild(title);

      var actionsSpan = document.createElement('span');
      actionsSpan.className = 'snippet-card-actions';

      var copyBtn = document.createElement('button');
      copyBtn.className = 'btn-icon btn-copy-snippet';
      copyBtn.title = 'Copy';
      copyBtn.textContent = '\uD83D\uDCCB'; // clipboard emoji
      copyBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        navigator.clipboard.writeText(s.content).then(function () { toast('Copied!', 'success'); });
      });
      actionsSpan.appendChild(copyBtn);

      var editBtnS = document.createElement('button');
      editBtnS.className = 'btn-icon btn-edit-snippet';
      editBtnS.title = 'Edit';
      editBtnS.textContent = '\u270E';
      editBtnS.addEventListener('click', function (e) {
        e.stopPropagation();
        openSnippetModal(s);
      });
      actionsSpan.appendChild(editBtnS);

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

      list.appendChild(card);
    });
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
      // Apply status class to the Status row
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

      // Try to set category to "whatsapp"
      var catSel = $('#ai-category');
      var waOption = Array.from(catSel.options).find(function (o) { return o.value.toLowerCase().indexOf('whatsapp') !== -1; });
      if (waOption) {
        catSel.value = waOption.value;
        await loadPrompts(waOption.value);
        renderPromptDropdown();
      }

      // Set up callback: when AI generates, populate WA message
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
    $('#settings-server').value = serverUrl;

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

    if (token) {
      showApp();
      bootstrap();
    } else {
      showLogin();
    }
  }

  init();
})();
