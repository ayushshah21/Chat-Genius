import { Navigate } from "react-router-dom";
import { useUserStatus } from "../contexts/UserStatusContext";

interface Props {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: Props) {
  const { isAuthenticated, isLoading } = useUserStatus();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#1A1D21] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  return <>{children}</>;
}
