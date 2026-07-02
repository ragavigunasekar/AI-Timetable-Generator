import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Layers,
  Settings,
  ClipboardList,
  Calendar,
  LogOut,
  GraduationCap,
} from "lucide-react";

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  section?: string;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard",   label: "Dashboard",   icon: <LayoutDashboard className="w-4 h-4" />, section: "Overview" },
  { to: "/teachers",    label: "Teachers",    icon: <Users className="w-4 h-4" />, section: "School Data" },
  { to: "/subjects",    label: "Subjects",    icon: <BookOpen className="w-4 h-4" /> },
  { to: "/classes",     label: "Classes",     icon: <Layers className="w-4 h-4" /> },
  { to: "/allocations", label: "Allocations", icon: <ClipboardList className="w-4 h-4" />, section: "Scheduling" },
  { to: "/timetable",   label: "Timetable",   icon: <Calendar className="w-4 h-4" /> },
  { to: "/settings",    label: "Settings",    icon: <Settings className="w-4 h-4" />, section: "Configuration" },
];

export default function MainLayout() {
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside
        className="w-64 flex-shrink-0 flex flex-col"
        style={{
          background: "linear-gradient(180deg, #0f172a 0%, #1e1b4b 100%)",
          minHeight: "100vh",
        }}
      >
        {/* Brand */}
        <div className="px-5 pt-7 pb-6 border-b border-white/10">
          <div className="flex items-center space-x-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
            >
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-white font-extrabold text-sm leading-tight">Scheduler AI</p>
              <p className="text-indigo-300/70 text-[10px] font-semibold mt-0.5">Smart Timetable Engine</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map((item, idx) => {
            const prevItem = NAV_ITEMS[idx - 1];
            const showSection = item.section && item.section !== prevItem?.section;

            return (
              <div key={item.to}>
                {showSection && (
                  <p className="text-[9px] font-extrabold uppercase tracking-widest text-indigo-300/50 px-3 pt-4 pb-1.5">
                    {item.section}
                  </p>
                )}
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center space-x-3 px-3 py-2.5 rounded-xl transition-all duration-150 group ${
                      isActive
                        ? "bg-indigo-600/90 text-white shadow-md"
                        : "text-indigo-200/70 hover:bg-white/8 hover:text-white"
                    }`
                  }
                  style={({ isActive }) =>
                    isActive ? {} : {}
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={`flex-shrink-0 transition-colors ${
                          isActive ? "text-white" : "text-indigo-300/60 group-hover:text-indigo-200"
                        }`}
                      >
                        {item.icon}
                      </span>
                      <span className="text-sm font-semibold">{item.label}</span>
                      {item.to === "/allocations" && (
                        <span
                          className="ml-auto text-[9px] font-extrabold px-1.5 py-0.5 rounded-md"
                          style={{
                            background: isActive ? "rgba(255,255,255,0.2)" : "rgba(99,102,241,0.3)",
                            color: isActive ? "white" : "#a5b4fc",
                          }}
                        >
                          AI
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              </div>
            );
          })}
        </nav>

        {/* Allocations workflow hint */}
        <div className="mx-3 mb-3 px-3 py-3 rounded-xl" style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.2)" }}>
          <p className="text-[9px] font-extrabold uppercase tracking-wider text-indigo-300/70 mb-1.5">
            Scheduling Workflow
          </p>
          <ol className="space-y-1">
            {["Allocations", "Conflicts", "Optimize", "Generate"].map((step, i) => (
              <li key={step} className="flex items-center space-x-2">
                <span
                  className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-extrabold flex-shrink-0"
                  style={{ background: "rgba(99,102,241,0.4)", color: "#c7d2fe" }}
                >
                  {i + 1}
                </span>
                <span className="text-[10px] font-semibold text-indigo-200/60">{step}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Logout */}
        <div className="px-3 pb-5">
          <button
            onClick={handleLogout}
            className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-150 group"
            style={{
              background: "rgba(251, 146, 60, 0.12)",
              color: "#fdba74",
              border: "1px solid rgba(251,146,60,0.2)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(251,146,60,0.22)";
              e.currentTarget.style.color = "#fff";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(251,146,60,0.12)";
              e.currentTarget.style.color = "#fdba74";
            }}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-slate-50">
        <Outlet />
      </main>
    </div>
  );
}
