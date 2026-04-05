import { useState, useEffect } from 'react';
import api from '../api';
import { useToast } from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';

export default function TeamManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const toast = useToast();

  const fetchUsers = async () => {
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch (err) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail) return;

    setInviting(true);
    setInviteResult(null);
    try {
      const result = await api.inviteUser(inviteEmail);
      setInviteResult(result);
      setInviteEmail('');
      toast.success(`Invite sent to ${result.email}`);
    } catch (err) {
      toast.error(err.message || 'Failed to send invite');
    } finally {
      setInviting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.deleteUser(deleteTarget.id);
      setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));
      toast.success('User removed successfully');
    } catch (err) {
      toast.error(err.message || 'Failed to remove user');
    } finally {
      setDeleteTarget(null);
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Team Management</h1>
      </div>

      <div className="card">
        <h3>Invite New Member</h3>
        <form onSubmit={handleInvite} className="inline-form">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="team@example.com"
            disabled={inviting}
          />
          <button type="submit" className="btn btn-primary" disabled={inviting || !inviteEmail}>
            {inviting ? 'Sending...' : 'Send Invite'}
          </button>
        </form>
        {inviteResult && (
          <div className="invite-result">
            <p>Invite token created for <strong>{inviteResult.email}</strong></p>
            <code className="invite-token">{inviteResult.inviteToken}</code>
            <p className="text-muted">
              Expires: {formatDate(inviteResult.expiresAt)}
            </p>
          </div>
        )}
      </div>

      <div className="card">
        <h3>Team Members ({users.length})</h3>
        {loading ? (
          <div className="loading-inline"><div className="spinner" /></div>
        ) : users.length === 0 ? (
          <p className="text-muted">No team members found.</p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="user-cell">
                        <div className="avatar-sm">
                          {u.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <span>{u.name || '(no name)'}</span>
                      </div>
                    </td>
                    <td>{u.email}</td>
                    <td>
                      <span className={`badge badge-${u.role}`}>{u.role}</span>
                    </td>
                    <td>{formatDate(u.createdAt)}</td>
                    <td>
                      {u.role !== 'admin' && (
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => setDeleteTarget(u)}
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Remove Team Member"
        message={`Are you sure you want to remove ${deleteTarget?.name || deleteTarget?.email}? This action cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
