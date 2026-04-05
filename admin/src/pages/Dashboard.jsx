import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ users: 0, prompts: 0, folders: 0, snippets: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [users, prompts, folders, snippets] = await Promise.all([
          api.getUsers(),
          api.getPrompts(),
          api.getFolders(),
          api.getSnippets(),
        ]);
        setStats({
          users: users.length,
          prompts: prompts.length,
          folders: folders.length,
          snippets: snippets.length,
        });
      } catch (err) {
        console.error('Failed to fetch stats:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  const statCards = [
    { label: 'Team Members', value: stats.users, icon: 'users', color: '#3b82f6' },
    { label: 'AI Prompts', value: stats.prompts, icon: 'prompts', color: '#8b5cf6' },
    { label: 'Folders', value: stats.folders, icon: 'folders', color: '#10b981' },
    { label: 'Snippets', value: stats.snippets, icon: 'snippets', color: '#f59e0b' },
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p className="page-subtitle">Welcome back, {user?.name || 'Admin'}</p>
        </div>
      </div>

      {loading ? (
        <div className="loading-inline"><div className="spinner" /></div>
      ) : (
        <div className="stats-grid">
          {statCards.map((card) => (
            <div key={card.label} className="stat-card">
              <div className="stat-icon" style={{ backgroundColor: card.color + '15', color: card.color }}>
                {card.value}
              </div>
              <div className="stat-info">
                <span className="stat-value">{card.value}</span>
                <span className="stat-label">{card.label}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="dashboard-sections">
        <div className="card">
          <h3>Quick Actions</h3>
          <div className="quick-actions">
            <Link to="/team" className="quick-action-btn">
              <span className="qa-icon">+</span>
              Invite Team Member
            </Link>
            <Link to="/prompts" className="quick-action-btn">
              <span className="qa-icon">+</span>
              Create Prompt
            </Link>
            <Link to="/swipe-storage" className="quick-action-btn">
              <span className="qa-icon">+</span>
              Add Snippet
            </Link>
            <Link to="/api-keys" className="quick-action-btn">
              <span className="qa-icon">&#9881;</span>
              Configure API Keys
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
