import { BrowserRouter, Routes, Route } from "react-router-dom";

import LoginPage from "../pages/auth/LoginPage";
import RegisterPage from "../pages/auth/RegisterPage";
import DashboardPage from "../pages/dashboard/DashboardPage";
import TeachersPage from "../pages/teachers/TeachersPage";
import SubjectsPage from "../pages/subjects/SubjectsPage";
import ClassesPage from "../pages/classes/ClassesPage";
import SchoolSettingsPage from "../pages/settings/SchoolSettingsPage";
import AllocationPage from "../pages/allocations/AllocationPage";
import TimetablePage from "../pages/timetable/TimetableGeneratorPage";
import ProtectedRoute from "./ProtectedRoute";
import MainLayout from "../layout/MainLayout.tsx";

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/teachers" element={<TeachersPage />} />
          <Route path="/subjects" element={<SubjectsPage />} />
          <Route path="/classes" element={<ClassesPage />} />
          <Route path="/settings" element={<SchoolSettingsPage />} />
          <Route path="/allocations" element={<AllocationPage />} />
          <Route path="/timetable" element={<TimetablePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default AppRoutes;
