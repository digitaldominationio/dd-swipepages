import { useState, useEffect } from 'react';
import api from '../api';
import { useToast } from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';

export default function SwipeStorage() {
  const [folders, setFolders] = useState([]);
  const [snippets, setSnippets] = useState([]);
  const [tags, setTags] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [selectedTag, setSelectedTag] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Folder form
  const [showFolderForm, setShowFolderForm] = useState(false);
  const [folderForm, setFolderForm] = useState({ name: '', parentId: '' });
  const [editingFolderId, setEditingFolderId] = useState(null);

  // Snippet form
  const [showSnippetForm, setShowSnippetForm] = useState(false);
  const [snippetForm, setSnippetForm] = useState({
    title: '', content: '', type: 'snippet', folderId: '', tagIds: [],
  });
  const [editingSnippetId, setEditingSnippetId] = useState(null);

  // Tag form
  const [showTagForm, setShowTagForm] = useState(false);
  const [tagForm, setTagForm] = useState({ name: '', color: '#3b82f6' });
  const [editingTagId, setEditingTagId] = useState(null);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);

  const toast = useToast();

  const fetchAll = async () => {
    try {
      const [f, t] = await Promise.all([api.getFolders(), api.getTags()]);
      setFolders(f);
      setTags(t);
    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const fetchSnippets = async () => {
    try {
      const params = {};
      if (selectedFolder) params.folder = selectedFolder;
      if (selectedTag) params.tag = selectedTag;
      if (searchQuery) params.search = searchQuery;
      const data = await api.getSnippets(params);
      setSnippets(data);
    } catch (err) {
      toast.error('Failed to load snippets');
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  useEffect(() => {
    fetchSnippets();
  }, [selectedFolder, selectedTag, searchQuery]);

  // --- Folder tree helpers ---
  const buildTree = (items, parentId = null) => {
    return items
      .filter((f) => f.parentId === parentId)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
      .map((f) => ({ ...f, children: buildTree(items, f.id) }));
  };

  const folderTree = buildTree(folders);

  function FolderNode({ folder, depth = 0 }) {
    const isActive = selectedFolder === folder.id;
    return (
      <>
        <div
          className={`folder-node ${isActive ? 'folder-node-active' : ''}`}
          style={{ paddingLeft: `${12 + depth * 16}px` }}
          onClick={() => setSelectedFolder(isActive ? null : folder.id)}
        >
          <span className="folder-icon">
            {folder.children?.length > 0 ? (isActive ? '&#9660;' : '&#9654;') : '&#128193;'}
          </span>
          <span className="folder-name">{folder.name}</span>
          <div className="folder-actions-inline" onClick={(e) => e.stopPropagation()}>
            <button className="btn-icon" title="Edit" onClick={() => openEditFolder(folder)}>
              &#9998;
            </button>
            <button className="btn-icon btn-icon-danger" title="Delete" onClick={() => setDeleteTarget({ type: 'folder', item: folder })}>
              &times;
            </button>
          </div>
        </div>
        {folder.children?.map((child) => (
          <FolderNode key={child.id} folder={child} depth={depth + 1} />
        ))}
      </>
    );
  }

  // --- Folder CRUD ---
  const openCreateFolder = () => {
    setFolderForm({ name: '', parentId: selectedFolder || '' });
    setEditingFolderId(null);
    setShowFolderForm(true);
  };

  const openEditFolder = (folder) => {
    setFolderForm({ name: folder.name, parentId: folder.parentId || '' });
    setEditingFolderId(folder.id);
    setShowFolderForm(true);
  };

  const handleFolderSubmit = async (e) => {
    e.preventDefault();
    if (!folderForm.name) { toast.error('Folder name required'); return; }
    setSaving(true);
    try {
      const data = { name: folderForm.name, parentId: folderForm.parentId || null };
      if (editingFolderId) {
        await api.updateFolder(editingFolderId, data);
        toast.success('Folder updated');
      } else {
        await api.createFolder(data);
        toast.success('Folder created');
      }
      setShowFolderForm(false);
      const f = await api.getFolders();
      setFolders(f);
    } catch (err) {
      toast.error(err.message || 'Failed to save folder');
    } finally {
      setSaving(false);
    }
  };

  // --- Snippet CRUD ---
  const openCreateSnippet = () => {
    setSnippetForm({
      title: '', content: '', type: 'snippet',
      folderId: selectedFolder || (folders[0]?.id || ''),
      tagIds: [],
    });
    setEditingSnippetId(null);
    setShowSnippetForm(true);
  };

  const openEditSnippet = (snippet) => {
    setSnippetForm({
      title: snippet.title,
      content: snippet.content,
      type: snippet.type || 'snippet',
      folderId: snippet.folderId,
      tagIds: snippet.tags?.map((st) => st.tag?.id || st.tagId) || [],
    });
    setEditingSnippetId(snippet.id);
    setShowSnippetForm(true);
  };

  const handleSnippetSubmit = async (e) => {
    e.preventDefault();
    if (!snippetForm.title || !snippetForm.content || !snippetForm.folderId) {
      toast.error('Title, content, and folder are required');
      return;
    }
    setSaving(true);
    try {
      if (editingSnippetId) {
        await api.updateSnippet(editingSnippetId, snippetForm);
        toast.success('Snippet updated');
      } else {
        await api.createSnippet(snippetForm);
        toast.success('Snippet created');
      }
      setShowSnippetForm(false);
      fetchSnippets();
    } catch (err) {
      toast.error(err.message || 'Failed to save snippet');
    } finally {
      setSaving(false);
    }
  };

  // --- Tag CRUD ---
  const openCreateTag = () => {
    setTagForm({ name: '', color: '#3b82f6' });
    setEditingTagId(null);
    setShowTagForm(true);
  };

  const openEditTag = (tag) => {
    setTagForm({ name: tag.name, color: tag.color });
    setEditingTagId(tag.id);
    setShowTagForm(true);
  };

  const handleTagSubmit = async (e) => {
    e.preventDefault();
    if (!tagForm.name || !tagForm.color) { toast.error('Name and color required'); return; }
    setSaving(true);
    try {
      if (editingTagId) {
        await api.updateTag(editingTagId, tagForm);
        toast.success('Tag updated');
      } else {
        await api.createTag(tagForm);
        toast.success('Tag created');
      }
      setShowTagForm(false);
      const t = await api.getTags();
      setTags(t);
    } catch (err) {
      toast.error(err.message || 'Failed to save tag');
    } finally {
      setSaving(false);
    }
  };

  // --- Delete handler ---
  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { type, item } = deleteTarget;
    try {
      if (type === 'folder') {
        await api.deleteFolder(item.id);
        if (selectedFolder === item.id) setSelectedFolder(null);
        const f = await api.getFolders();
        setFolders(f);
      } else if (type === 'snippet') {
        await api.deleteSnippet(item.id);
        fetchSnippets();
      } else if (type === 'tag') {
        await api.deleteTag(item.id);
        if (selectedTag === item.id) setSelectedTag(null);
        const t = await api.getTags();
        setTags(t);
      }
      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} deleted`);
    } catch (err) {
      toast.error(err.message || `Failed to delete ${type}`);
    } finally {
      setDeleteTarget(null);
    }
  };

  const toggleTagId = (tagId) => {
    setSnippetForm((prev) => ({
      ...prev,
      tagIds: prev.tagIds.includes(tagId)
        ? prev.tagIds.filter((id) => id !== tagId)
        : [...prev.tagIds, tagId],
    }));
  };

  if (loading) {
    return (
      <div className="page">
        <div className="loading-inline"><div className="spinner" /></div>
      </div>
    );
  }

  return (
    <div className="page swipe-storage-page">
      <div className="page-header">
        <h1>Swipe Storage</h1>
        <div className="page-header-actions">
          <button className="btn btn-secondary" onClick={openCreateFolder}>+ Folder</button>
          <button className="btn btn-secondary" onClick={openCreateTag}>+ Tag</button>
          <button className="btn btn-primary" onClick={openCreateSnippet}>+ Snippet</button>
        </div>
      </div>

      {/* Forms */}
      {showFolderForm && (
        <div className="card form-card">
          <h3>{editingFolderId ? 'Edit Folder' : 'New Folder'}</h3>
          <form onSubmit={handleFolderSubmit} className="inline-form-col">
            <div className="form-group">
              <label>Name</label>
              <input value={folderForm.name} onChange={(e) => setFolderForm((p) => ({ ...p, name: e.target.value }))} placeholder="Folder name" disabled={saving} />
            </div>
            <div className="form-group">
              <label>Parent Folder</label>
              <select value={folderForm.parentId} onChange={(e) => setFolderForm((p) => ({ ...p, parentId: e.target.value }))} disabled={saving}>
                <option value="">None (root)</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowFolderForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {showTagForm && (
        <div className="card form-card">
          <h3>{editingTagId ? 'Edit Tag' : 'New Tag'}</h3>
          <form onSubmit={handleTagSubmit} className="inline-form">
            <input value={tagForm.name} onChange={(e) => setTagForm((p) => ({ ...p, name: e.target.value }))} placeholder="Tag name" disabled={saving} />
            <input type="color" value={tagForm.color} onChange={(e) => setTagForm((p) => ({ ...p, color: e.target.value }))} disabled={saving} className="color-input" />
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            <button type="button" className="btn btn-secondary" onClick={() => setShowTagForm(false)}>Cancel</button>
          </form>
        </div>
      )}

      {showSnippetForm && (
        <div className="card form-card">
          <h3>{editingSnippetId ? 'Edit Snippet' : 'New Snippet'}</h3>
          <form onSubmit={handleSnippetSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>Title</label>
                <input value={snippetForm.title} onChange={(e) => setSnippetForm((p) => ({ ...p, title: e.target.value }))} placeholder="Snippet title" disabled={saving} />
              </div>
              <div className="form-group">
                <label>Folder</label>
                <select value={snippetForm.folderId} onChange={(e) => setSnippetForm((p) => ({ ...p, folderId: e.target.value }))} disabled={saving}>
                  <option value="">Select folder</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Type</label>
                <select value={snippetForm.type} onChange={(e) => setSnippetForm((p) => ({ ...p, type: e.target.value }))} disabled={saving}>
                  <option value="snippet">Snippet</option>
                  <option value="template">Template</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Content</label>
              <textarea value={snippetForm.content} onChange={(e) => setSnippetForm((p) => ({ ...p, content: e.target.value }))} rows={6} placeholder="Snippet content..." disabled={saving} />
            </div>
            <div className="form-group">
              <label>Tags</label>
              <div className="tag-selector">
                {tags.map((tag) => (
                  <button
                    type="button"
                    key={tag.id}
                    className={`tag-chip ${snippetForm.tagIds.includes(tag.id) ? 'tag-chip-selected' : ''}`}
                    style={{ '--tag-color': tag.color }}
                    onClick={() => toggleTagId(tag.id)}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowSnippetForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="swipe-layout">
        {/* Sidebar: folders + tags */}
        <div className="swipe-sidebar">
          <div className="swipe-sidebar-section">
            <h4>Folders</h4>
            <div className="folder-tree">
              <div
                className={`folder-node ${!selectedFolder ? 'folder-node-active' : ''}`}
                onClick={() => setSelectedFolder(null)}
              >
                <span className="folder-icon">&#128194;</span>
                <span className="folder-name">All Snippets</span>
              </div>
              {folderTree.map((f) => (
                <FolderNode key={f.id} folder={f} />
              ))}
            </div>
          </div>
          <div className="swipe-sidebar-section">
            <h4>Tags</h4>
            <div className="tag-list-sidebar">
              {tags.map((tag) => (
                <div key={tag.id} className={`tag-item ${selectedTag === tag.id ? 'tag-item-active' : ''}`}>
                  <button
                    className="tag-btn"
                    style={{ '--tag-color': tag.color }}
                    onClick={() => setSelectedTag(selectedTag === tag.id ? null : tag.id)}
                  >
                    <span className="tag-dot" style={{ backgroundColor: tag.color }} />
                    {tag.name}
                  </button>
                  <div className="tag-actions-inline">
                    <button className="btn-icon" title="Edit" onClick={() => openEditTag(tag)}>&#9998;</button>
                    <button className="btn-icon btn-icon-danger" title="Delete" onClick={() => setDeleteTarget({ type: 'tag', item: tag })}>&times;</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main: snippets */}
        <div className="swipe-main">
          <div className="swipe-search">
            <input
              type="text"
              placeholder="Search snippets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {snippets.length === 0 ? (
            <div className="empty-state">
              <p>No snippets found.</p>
            </div>
          ) : (
            <div className="snippet-list">
              {snippets.map((snippet) => (
                <div key={snippet.id} className="card snippet-card">
                  <div className="snippet-card-header">
                    <h4>{snippet.title}</h4>
                    <div className="snippet-card-actions">
                      <button className="btn btn-sm btn-secondary" onClick={() => openEditSnippet(snippet)}>Edit</button>
                      <button className="btn btn-sm btn-danger" onClick={() => setDeleteTarget({ type: 'snippet', item: snippet })}>Delete</button>
                    </div>
                  </div>
                  <pre className="snippet-content">{snippet.content}</pre>
                  <div className="snippet-meta">
                    {snippet.folder && (
                      <span className="snippet-folder">
                        &#128193; {snippet.folder.name}
                      </span>
                    )}
                    {snippet.tags?.map((st) => (
                      <span
                        key={st.tag?.id || st.tagId}
                        className="tag-chip-sm"
                        style={{ backgroundColor: (st.tag?.color || '#888') + '20', color: st.tag?.color || '#888' }}
                      >
                        {st.tag?.name || 'tag'}
                      </span>
                    ))}
                    <span className="snippet-type badge">{snippet.type}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title={`Delete ${deleteTarget?.type || 'item'}`}
        message={`Are you sure you want to delete this ${deleteTarget?.type}? This action cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
