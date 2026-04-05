import { useState, useEffect } from 'react';
import api from '../api';
import { useToast } from '../components/Toast';

const KEY_LABELS = {
  reoon_api_key: 'Reoon API Key',
  openai_api_key: 'OpenAI API Key',
  walytic_session_id: 'Walytic Session ID',
  walytic_api_key: 'Walytic API Key',
};

const KEY_NAMES = Object.keys(KEY_LABELS);

export default function ApiKeys() {
  const [maskedValues, setMaskedValues] = useState({});
  const [editValues, setEditValues] = useState({});
  const [editing, setEditing] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const toast = useToast();

  useEffect(() => {
    async function fetchSettings() {
      try {
        const data = await api.getSettings();
        setMaskedValues(data);
      } catch (err) {
        toast.error('Failed to load settings');
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, []);

  const startEdit = (key) => {
    setEditing((prev) => ({ ...prev, [key]: true }));
    setEditValues((prev) => ({ ...prev, [key]: '' }));
  };

  const cancelEdit = (key) => {
    setEditing((prev) => ({ ...prev, [key]: false }));
    setEditValues((prev) => ({ ...prev, [key]: '' }));
  };

  const saveKey = async (key) => {
    const value = editValues[key];
    if (!value) {
      toast.error('Please enter a value');
      return;
    }

    setSaving((prev) => ({ ...prev, [key]: true }));
    try {
      await api.updateSettings({ [key]: value });
      const updated = await api.getSettings();
      setMaskedValues(updated);
      setEditing((prev) => ({ ...prev, [key]: false }));
      toast.success(`${KEY_LABELS[key]} updated successfully`);
    } catch (err) {
      toast.error(err.message || 'Failed to update setting');
    } finally {
      setSaving((prev) => ({ ...prev, [key]: false }));
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>API Keys</h1>
        <p className="page-subtitle">Configure external service credentials</p>
      </div>

      {loading ? (
        <div className="loading-inline"><div className="spinner" /></div>
      ) : (
        <div className="api-keys-list">
          {KEY_NAMES.map((key) => (
            <div key={key} className="card api-key-card">
              <div className="api-key-header">
                <div>
                  <h3>{KEY_LABELS[key]}</h3>
                  <code className="masked-value">
                    {maskedValues[key] || '(not set)'}
                  </code>
                </div>
                {!editing[key] && (
                  <button className="btn btn-secondary" onClick={() => startEdit(key)}>
                    Edit
                  </button>
                )}
              </div>
              {editing[key] && (
                <div className="api-key-edit">
                  <input
                    type="text"
                    value={editValues[key] || ''}
                    onChange={(e) =>
                      setEditValues((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                    placeholder={`Enter new ${KEY_LABELS[key]}`}
                    disabled={saving[key]}
                  />
                  <div className="api-key-actions">
                    <button
                      className="btn btn-primary"
                      onClick={() => saveKey(key)}
                      disabled={saving[key]}
                    >
                      {saving[key] ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => cancelEdit(key)}
                      disabled={saving[key]}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
