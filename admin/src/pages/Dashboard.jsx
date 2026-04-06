import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const result = await api.getDashboard();
        setData(result);
      } catch (err) {
        console.error('Failed to fetch dashboard:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, []);

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const actionLabels = {
    generate: 'AI Generation',
    validate: 'Email Validated',
    send: 'Message Sent',
    create: 'Created',
    update: 'Updated',
    delete: 'Deleted',
  };

  const entityLabels = {
    ai_generation: 'AI Content',
    email_validation: 'Email',
    whatsapp_message: 'WhatsApp',
    snippet: 'Snippet',
    folder: 'Folder',
    prompt: 'Prompt',
  };

  if (loading) {
    return (
      <div className="page">
        <div className="loading-inline"><div className="spinner" /></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="page">
        <div className="page-header"><h1>Dashboard</h1></div>
        <div className="card"><p className="text-muted">Failed to load dashboard data.</p></div>
      </div>
    );
  }

  const { overview, usage, recentActivity, topContributors } = data;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p className="page-subtitle">Welcome back, {user?.name || 'Admin'}</p>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: '#3b82f615', color: '#3b82f6' }}>
            {overview.totalUsers}
          </div>
          <div className="stat-info">
            <span className="stat-value">{overview.totalUsers}</span>
            <span className="stat-label">Team Members</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: '#f59e0b15', color: '#f59e0b' }}>
            {overview.totalSnippets}
          </div>
          <div className="stat-info">
            <span className="stat-value">{overview.totalSnippets}</span>
            <span className="stat-label">Snippets</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: '#10b98115', color: '#10b981' }}>
            {overview.totalFolders}
          </div>
          <div className="stat-info">
            <span className="stat-value">{overview.totalFolders}</span>
            <span className="stat-label">Folders</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: '#8b5cf615', color: '#8b5cf6' }}>
            {overview.totalPrompts}
          </div>
          <div className="stat-info">
            <span className="stat-value">{overview.totalPrompts}</span>
            <span className="stat-label">AI Prompts</span>
          </div>
        </div>
      </div>

      {/* Usage Stats */}
      <div className="dashboard-sections">
        <div className="card">
          <h3>Usage Overview</h3>
          <div className="usage-grid">
            <div className="usage-card">
              <div className="usage-header">
                <span className="usage-icon" style={{ color: '#8b5cf6' }}>AI</span>
                <span className="usage-title">AI Generations</span>
              </div>
              <div className="usage-stats">
                <div className="usage-stat">
                  <span className="usage-number">{usage.aiGenerations.today}</span>
                  <span className="usage-period">Today</span>
                </div>
                <div className="usage-stat">
                  <span className="usage-number">{usage.aiGenerations.thisWeek}</span>
                  <span className="usage-period">This Week</span>
                </div>
                <div className="usage-stat">
                  <span className="usage-number">{usage.aiGenerations.total}</span>
                  <span className="usage-period">Total</span>
                </div>
              </div>
            </div>

            <div className="usage-card">
              <div className="usage-header">
                <span className="usage-icon" style={{ color: '#10b981' }}>@</span>
                <span className="usage-title">Email Validations</span>
              </div>
              <div className="usage-stats">
                <div className="usage-stat">
                  <span className="usage-number">{usage.emailValidations.today}</span>
                  <span className="usage-period">Today</span>
                </div>
                <div className="usage-stat">
                  <span className="usage-number">{usage.emailValidations.thisWeek}</span>
                  <span className="usage-period">This Week</span>
                </div>
                <div className="usage-stat">
                  <span className="usage-number">{usage.emailValidations.total}</span>
                  <span className="usage-period">Total</span>
                </div>
              </div>
            </div>

            <div className="usage-card">
              <div className="usage-header">
                <span className="usage-icon" style={{ color: '#22c55e' }}>W</span>
                <span className="usage-title">WhatsApp Messages</span>
              </div>
              <div className="usage-stats">
                <div className="usage-stat">
                  <span className="usage-number">{usage.whatsappMessages.today}</span>
                  <span className="usage-period">Today</span>
                </div>
                <div className="usage-stat">
                  <span className="usage-number">{usage.whatsappMessages.thisWeek}</span>
                  <span className="usage-period">This Week</span>
                </div>
                <div className="usage-stat">
                  <span className="usage-number">{usage.whatsappMessages.total}</span>
                  <span className="usage-period">Total</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row: Recent Activity + Top Contributors + Quick Actions */}
      <div className="dashboard-bottom-grid">
        {/* Recent Activity */}
        <div className="card">
          <h3>Recent Activity</h3>
          {recentActivity.length === 0 ? (
            <p className="text-muted">No activity recorded yet. Activity will appear here as the team uses the extension.</p>
          ) : (
            <div className="activity-list">
              {recentActivity.map((log) => (
                <div key={log.id} className="activity-item">
                  <div className="activity-dot" />
                  <div className="activity-content">
                    <span className="activity-user">{log.user?.name || log.user?.email || 'Unknown'}</span>
                    <span className="activity-action">
                      {actionLabels[log.action] || log.action}{' '}
                      {entityLabels[log.entityType] || log.entityType}
                    </span>
                    {log.entityId && (
                      <span className="activity-entity">{log.entityId.length > 30 ? log.entityId.slice(0, 30) + '...' : log.entityId}</span>
                    )}
                  </div>
                  <span className="activity-time">{formatDate(log.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="dashboard-right-col">
          {/* Top Contributors */}
          <div className="card">
            <h3>Top Contributors</h3>
            {topContributors.length === 0 ? (
              <p className="text-muted">No data yet.</p>
            ) : (
              <div className="contributors-list">
                {topContributors.map((c, i) => (
                  <div key={i} className="contributor-item">
                    <div className="contributor-rank">{i + 1}</div>
                    <div className="contributor-info">
                      <span className="contributor-name">{c.user.name || c.user.email}</span>
                      <span className="contributor-count">{c.totalActions} actions</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Stats */}
          <div className="card">
            <h3>This Period</h3>
            <div className="period-stats">
              <div className="period-stat-row">
                <span className="period-label">New users (30d)</span>
                <span className="period-value">{overview.newUsersThisMonth}</span>
              </div>
              <div className="period-stat-row">
                <span className="period-label">Snippets (7d)</span>
                <span className="period-value">{overview.snippetsThisWeek}</span>
              </div>
              <div className="period-stat-row">
                <span className="period-label">Pending invites</span>
                <span className="period-value">{overview.pendingInvites}</span>
              </div>
              <div className="period-stat-row">
                <span className="period-label">Total tags</span>
                <span className="period-value">{overview.totalTags}</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card">
            <h3>Quick Actions</h3>
            <div className="quick-actions">
              <Link to="/team" className="quick-action-btn">
                <span className="qa-icon">+</span>
                Invite Member
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
                API Keys
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
