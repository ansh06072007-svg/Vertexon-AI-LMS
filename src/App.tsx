import { Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './components/AppShell';
import { RequireAuth, PublicOnly } from './components/RouteGuards';
import { useAuth } from './context/AuthContext';
import Dashboard from './pages/Dashboard';
import Tutor from './pages/Tutor';
import Lesson from './pages/Lesson';
import Quiz from './pages/Quiz';
import Learn from './pages/Learn';
import Achievements from './pages/Achievements';
import AuthPage from './pages/Auth';
import InstructorDashboard from './pages/InstructorDashboard';
import InstructorCourses from './pages/InstructorCourses';
import InstructorAnalytics from './pages/InstructorAnalytics';
import AdminDashboard from './pages/AdminDashboard';
import AdminUsers from './pages/AdminUsers';
import AdminCourses from './pages/AdminCourses';
import AdminModeration from './pages/AdminModeration';
import Assignments from './pages/Assignments';
import Community from './pages/Community';

function RoleHome() {
  const { user } = useAuth();
  if (user?.role === 'instructor') return <Navigate to="/instructor" replace />;
  if (user?.role === 'admin') return <Navigate to="/admin" replace />;
  return <Dashboard />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<PublicOnly><AuthPage mode="login" /></PublicOnly>} />
      <Route path="/register" element={<PublicOnly><AuthPage mode="register" /></PublicOnly>} />

      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<RoleHome />} />
        <Route path="learn" element={<Learn />} />
        <Route path="tutor" element={<RequireAuth roles={['student', 'instructor']}><Tutor /></RequireAuth>} />
        <Route path="assignments" element={<Assignments />} />
        <Route path="community" element={<Community />} />

        <Route path="lesson" element={<RequireAuth roles={['student']}><Lesson /></RequireAuth>} />
        <Route path="quiz" element={<RequireAuth roles={['student']}><Quiz /></RequireAuth>} />
        <Route path="achievements" element={<RequireAuth roles={['student']}><Achievements /></RequireAuth>} />

        <Route path="instructor" element={<RequireAuth roles={['instructor', 'admin']}><InstructorDashboard /></RequireAuth>} />
        <Route path="instructor/courses" element={<RequireAuth roles={['instructor', 'admin']}><InstructorCourses /></RequireAuth>} />
        <Route path="instructor/analytics" element={<RequireAuth roles={['instructor', 'admin']}><InstructorAnalytics /></RequireAuth>} />

        <Route path="admin" element={<RequireAuth roles={['admin']}><AdminDashboard /></RequireAuth>} />
        <Route path="admin/users" element={<RequireAuth roles={['admin']}><AdminUsers /></RequireAuth>} />
        <Route path="admin/courses" element={<RequireAuth roles={['admin']}><AdminCourses /></RequireAuth>} />
        <Route path="admin/moderation" element={<RequireAuth roles={['admin']}><AdminModeration /></RequireAuth>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
