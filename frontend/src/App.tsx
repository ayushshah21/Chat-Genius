import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Register from "./pages/Register";
import Login from "./pages/Login";
import Channels from "./pages/Channels";
import ProtectedRoute from "./components/ProtectedRoute";
import { UserStatusProvider } from "./contexts/UserStatusContext";

function App() {
  return (
    <BrowserRouter>
      <UserStatusProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/channels"
            element={
              <ProtectedRoute>
                <Channels />
              </ProtectedRoute>
            }
          >
            <Route path=":channelId" element={<Channels />} />
          </Route>
        </Routes>
      </UserStatusProvider>
    </BrowserRouter>
  );
}

export default App;
