import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Channels from "./pages/Channels";
import Profile from "./pages/Profile";
import ProtectedRoute from "./components/ProtectedRoute";
import { UserStatusProvider } from "./contexts/UserStatusContext";

function App() {
  return (
    <BrowserRouter>
      <UserStatusProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/channels"
            element={
              <ProtectedRoute>
                <Channels />
              </ProtectedRoute>
            }
          />
          <Route
            path="/channels/:channelId"
            element={
              <ProtectedRoute>
                <Channels />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dm/:userId"
            element={
              <ProtectedRoute>
                <Channels />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
        </Routes>
      </UserStatusProvider>
    </BrowserRouter>
  );
}

export default App;
