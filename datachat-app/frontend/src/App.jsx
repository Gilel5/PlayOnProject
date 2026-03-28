import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { DarkModeProvider } from "./components/DarkModeContext";
import Login from "./pages/Login";
import Register from "./pages/Register";
import AppHome from "./pages/AppHome";
import ProtectedRoute from "./components/ProtectedRoute";

export default function App() {
  return (
    <DarkModeProvider>
      <BrowserRouter>
        <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />

        <Route path="/login" element={<Login/>}/>
        <Route path="/register" element={<Register/>} />

        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <AppHome />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/login" replace/>}/>
      </Routes>
    </BrowserRouter>
  </DarkModeProvider>
  );
}

