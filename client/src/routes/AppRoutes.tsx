import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import LoginPage from "../pages/auth/LoginPage";
import RegisterPage from "../pages/auth/RegisterPage";
import NotFoundPage from "../pages/errors/NotFoundPage";
import ProtectedRoute from "./ProtectedRoute";
import MainLayout from "../layout/MainLayout";

const DashboardPage = lazy(() => import("../pages/dashboard/DashboardPage"));
const TeachersPage = lazy(() => import("../pages/teachers/TeachersPage"));
const SubjectsPage = lazy(() => import("../pages/subjects/SubjectsPage"));
const ClassesPage = lazy(() => import("../pages/classes/ClassesPage"));
const SchoolSettingsPage = lazy(() => import("../pages/settings/SchoolSettingsPage"));
const AllocationPage = lazy(() => import("../pages/allocations/AllocationPage"));
const TimetablePage = lazy(() => import("../pages/timetable/TimetableGeneratorPage"));
const ReportsPage = lazy(() => import("../pages/reports/ReportsPage").then((m) => ({ default: m.ReportsPage })));
const ProfilePage = lazy(() => import("../pages/profile/ProfilePage"));

function LazyFallback() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-8">
      <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      <p className="text-slate-500 text-sm">Loading...</p>
    </div>
  );
}

function AppRoutes() {
  return (
    <BrowserRouter>
      <Suspense fallback={<LazyFallback />}>
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/teachers" element={<TeachersPage />} />
            <Route path="/subjects" element={<SubjectsPage />} />
            <Route path="/classes" element={<ClassesPage />} />
            <Route path="/settings" element={<SchoolSettingsPage />} />
            <Route path="/allocations" element={<AllocationPage />} />
            <Route path="/timetable" element={<TimetablePage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default AppRoutes;
