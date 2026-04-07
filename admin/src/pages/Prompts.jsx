import { useState, useEffect } from 'react';
import api from '../api';
import { useToast } from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';

const EMPTY_PROMPT = { name: '', category: 'email', promptText: '', sortOrder: 0 };

export default function Prompts() {
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_PROMPT });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const toast = useToast();

  const fetchPrompts = async () => {
    try {
      const data = await api.getPrompts();
      setPrompts(data);
    } catch (err) {
      toast.error('Failed to load prompts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrompts();
  }, []);

  const openCreate = () => {
    setForm({ ...EMPTY_PROMPT });
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (prompt) => {
    setForm({
      name: prompt.name,
      category: prompt.category,
      promptText: prompt.promptText,
      sortOrder: prompt.sortOrder || 0,
    });
    setEditingId(prompt.id);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ ...EMPTY_PROMPT });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.promptText || !form.category) {
      toast.error('Name, category, and prompt text are required');
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await api.updatePrompt(editingId, form);
        toast.success('Prompt updated');
      } else {
        await api.createPrompt(form);
        toast.success('Prompt created');
      }
      closeForm();
      fetchPrompts();
    } catch (err) {
      toast.error(err.message || 'Failed to save prompt');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.deletePrompt(deleteTarget.id);
      setPrompts((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      toast.success('Prompt deleted');
    } catch (err) {
      toast.error(err.message || 'Failed to delete prompt');
    } finally {
      setDeleteTarget(null);
    }
  };

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Prompts Management</h1>
        <button className="btn btn-primary" onClick={openCreate}>
          + New Prompt
        </button>
      </div>

      {showForm && (
        <div className="card prompt-form-card">
          <h3>{editingId ? 'Edit Prompt' : 'Create Prompt'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="prompt-name">Name</label>
                <input
                  id="prompt-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="Prompt name"
                  disabled={saving}
                />
              </div>
              <div className="form-group">
                <label htmlFor="prompt-category">Category</label>
                <select
                  id="prompt-category"
                  value={form.category}
                  onChange={(e) => updateField('category', e.target.value)}
                  disabled={saving}
                >
                  <option value="email">Email</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="upwork">Upwork</option>
                  <option value="linkedin">LinkedIn</option>
                </select>
              </div>
              <div className="form-group form-group-sm">
                <label htmlFor="prompt-sort">Sort Order</label>
                <input
                  id="prompt-sort"
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => updateField('sortOrder', parseInt(e.target.value) || 0)}
                  disabled={saving}
                />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="prompt-text">Prompt Text</label>
              <textarea
                id="prompt-text"
                value={form.promptText}
                onChange={(e) => updateField('promptText', e.target.value)}
                placeholder="Enter the AI prompt text..."
                rows={10}
                disabled={saving}
              />
              <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
                {form.category === 'upwork' ? (
                  <>Variables: {'{JOB_TITLE}'}, {'{JOB_DESCRIPTION}'}, {'{BUDGET}'}, {'{SKILLS}'}, {'{HIGHLIGHTS}'}, {'{TONE}'}</>
                ) : form.category === 'email' || form.category === 'linkedin' ? (
                  <>Variable: {'{PASTE_SELECTED_WEBSITE_TEXT}'} — replaced with the selected text</>
                ) : (
                  <>Variable: {'{PASTE_SELECTED_WEBSITE_TEXT}'} — replaced with the selected text</>
                )}
              </p>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={closeForm} disabled={saving}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="loading-inline"><div className="spinner" /></div>
      ) : prompts.length === 0 ? (
        <div className="card">
          <p className="text-muted text-center">No prompts yet. Create your first prompt above.</p>
        </div>
      ) : (
        <div className="prompts-grid">
          {prompts.map((prompt) => (
            <div key={prompt.id} className="card prompt-card">
              <div className="prompt-card-header">
                <h4>{prompt.name}</h4>
                <span className={`badge badge-${prompt.category}`}>{prompt.category}</span>
              </div>
              <p className="prompt-text-preview">{prompt.promptText}</p>
              <div className="prompt-card-footer">
                <span className="text-muted">Order: {prompt.sortOrder}</span>
                <div className="prompt-card-actions">
                  <button className="btn btn-sm btn-secondary" onClick={() => openEdit(prompt)}>
                    Edit
                  </button>
                  <button className="btn btn-sm btn-danger" onClick={() => setDeleteTarget(prompt)}>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Prompt"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
