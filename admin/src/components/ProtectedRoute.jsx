import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== 'admin') {
    return (
      <div className="access-denied">
        <h1>Access Denied</h1>
        <p>You do not have permission to access the admin panel.</p>
      </div>
    );
  }

  return children;
}
