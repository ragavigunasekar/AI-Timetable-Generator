import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useSchoolStore } from "../../store/schoolStore";
import api from "../../services/api";
import { useToast } from "../../components/ui/ToastProvider";
import { getApiErrorMessage } from "../../utils/errorUtils";
import {
  Users,
  BookOpen,
  Layers,
  Briefcase,
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Loader2,
  Sparkles,
  ArrowRight,
  CalendarDays,
  ShieldCheck,
} from "lucide-react";

function DashboardPage() {
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const teachers = useSchoolStore((state) => state.teachers);
  const subjects = useSchoolStore((state) => state.subjects);
  const classes = useSchoolStore((state) => state.classes);
  const allocations = useSchoolStore((state) => state.allocations);
  const generatedTimetable = useSchoolStore((state) => state.generatedTimetable);
  const conflicts = useSchoolStore((state) => state.conflicts);
  const healthScore = useSchoolStore((state) => state.timetableHealthScore);
  const setInitialData = useSchoolStore((state) => state.setInitialData);

  useEffect(() => {
    let cancelled = false;
    const loadInitial = async () => {
      try {
        setIsLoading(true);
        const [settingsRes, teachersRes, subjectsRes, classesRes, allocationsRes] = await Promise.all([
          api.get("/settings"),
          api.get("/teachers"),
          api.get("/subjects"),
          api.get("/classes"),
          api.get("/allocations"),
        ]);
        if (!cancelled) {
          setInitialData({
            schoolSettings: settingsRes.data,
            teachers: teachersRes.data,
            subjects: subjectsRes.data,
            classes: classesRes.data,
            allocations: allocationsRes.data,
          });
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const message = getApiErrorMessage(err, "Failed to load dashboard overview.");
          showToast("error", message);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };
    loadInitial();
    return () => { cancelled = true; };
  }, [setInitialData, showToast]);

  const timetableExists = Object.keys(generatedTimetable).length > 0;

  const criticalConflicts = conflicts.filter((c) => c.severity === "critical");
  const warningConflicts = conflicts.filter((c) => c.severity === "warning");
  const infoConflicts = conflicts.filter((c) => c.severity === "info");

  const totalConflictsCount = conflicts.length;
  const criticalConflictsCount = criticalConflicts.length;
  const warningConflictsCount = warningConflicts.length;
  const infoConflictsCount = infoConflicts.length;

  // Timetable status logic
  let statusText = "Ready to Generate";
  let statusColorClass = "text-blue-600 bg-blue-50 border-blue-200";
  let StatusIcon = HelpCircle;

  if (timetableExists) {
    statusText = "Generated Successfully";
    statusColorClass = "text-green-700 bg-green-50 border-green-200";
    StatusIcon = CheckCircle2;
  } else if (criticalConflictsCount > 0 || warningConflictsCount > 0) {
    statusText = "Generation Blocked";
    statusColorClass = "text-red-700 bg-red-50 border-red-200";
    StatusIcon = XCircle;
  } else if (allocations.length === 0) {
    statusText = "Missing Allocations";
    statusColorClass = "text-amber-700 bg-amber-50 border-amber-200";
    StatusIcon = AlertTriangle;
  }

  // Health score color scheme
  let healthColorClass = "text-green-600 border-green-200 bg-green-50/50";
  let healthBarColor = "bg-green-500";
  if (healthScore < 60) {
    healthColorClass = "text-red-600 border-red-200 bg-red-50/50";
    healthBarColor = "bg-red-500";
  } else if (healthScore < 90) {
    healthColorClass = "text-amber-600 border-amber-200 bg-amber-50/50";
    healthBarColor = "bg-amber-500";
  }

  const todayLabel = useMemo(() => new Date().toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }), []);

  if (isLoading && teachers.length === 0 && allocations.length === 0) {
    return (
      <div className="p-8 max-w-7xl mx-auto flex flex-col items-center justify-center py-24">
        <div className="flex items-center gap-3 text-indigo-600">
          <Loader2 className="w-7 h-7 animate-spin" />
          <span className="font-semibold text-sm">Loading dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto animate-fade-in">
      <div className="mb-8 rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-indigo-900 to-violet-700 p-6 text-white shadow-[0_20px_60px_-20px_rgba(79,70,229,0.65)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-indigo-100">
              <Sparkles className="h-3.5 w-3.5" />
              Welcome back
            </div>
            <h1 className="mt-4 text-3xl sm:text-4xl font-extrabold tracking-tight">Your timetable workspace is ready</h1>
            <p className="mt-2 max-w-2xl text-sm text-indigo-100/90">Keep allocations, conflicts, and timetable generation moving smoothly with a cleaner overview.</p>
          </div>
          <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur">
            <div className="flex items-center gap-2 text-sm font-semibold text-indigo-100">
              <CalendarDays className="h-4 w-4" />
              {todayLabel}
            </div>
            <div className="mt-2 text-xl font-semibold">{teachers.length + subjects.length + classes.length} records managed</div>
          </div>
        </div>
      </div>

      {/* Overview stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[
          { label: "Total Teachers", value: teachers.length, icon: Users, color: "bg-blue-50 text-blue-600" },
          { label: "Total Subjects", value: subjects.length, icon: BookOpen, color: "bg-indigo-50 text-indigo-600" },
          { label: "Total Classes", value: classes.length, icon: Layers, color: "bg-emerald-50 text-emerald-600" },
          { label: "Total Allocations", value: allocations.length, icon: Briefcase, color: "bg-purple-50 text-purple-600" },
        ].map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg transition-all duration-300 flex items-center space-x-4">
              <div className={`p-3 rounded-xl ${stat.color}`}>
                <Icon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-500">{stat.label}</h3>
                <p className="text-3xl font-bold text-slate-900 mt-1" style={{ animationDelay: `${index * 80}ms` }}>
                  {stat.value}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        
        {/* Health Score Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm lg:col-span-1 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-800">Timetable Health</h3>
              <Activity className="text-slate-400 h-5 w-5" />
            </div>
            <p className="text-xs text-slate-400 mb-6">
              A metric computed dynamically from allocations and active constraint violations.
            </p>
          </div>
          
          <div className="flex items-center justify-center my-2">
            <div className={`flex flex-col items-center justify-center h-32 w-32 rounded-full border-4 ${healthColorClass} relative`}>
              <span className="text-4xl font-extrabold">{healthScore}</span>
              <span className="text-xs font-semibold uppercase tracking-wider mt-1">Score</span>
            </div>
          </div>

          <div className="mt-6">
            <div className="w-full bg-slate-100 rounded-full h-3.5 mb-2 overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${healthBarColor}`} 
                style={{ width: `${healthScore}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-xs font-medium text-slate-500">
              <span>0 (Poor)</span>
              <span>100 (Flawless)</span>
            </div>
          </div>
        </div>

        {/* Conflicts Breakdown Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm lg:col-span-1 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-800">Active Conflicts</h3>
              <AlertTriangle className="text-slate-400 h-5 w-5" />
            </div>
            <p className="text-xs text-slate-400 mb-6">
              Critical and Warning issues will block timetable generation until corrected.
            </p>
          </div>

          <div className="space-y-4 my-2">
            <div className="flex items-center justify-between p-3 bg-red-50/50 border border-red-100 rounded-xl">
              <div className="flex items-center space-x-3">
                <div className="h-3 w-3 rounded-full bg-red-500"></div>
                <span className="text-sm font-semibold text-red-950">Critical Issues</span>
              </div>
              <span className="text-lg font-extrabold text-red-700">{criticalConflictsCount}</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-amber-50/50 border border-amber-100 rounded-xl">
              <div className="flex items-center space-x-3">
                <div className="h-3 w-3 rounded-full bg-amber-500"></div>
                <span className="text-sm font-semibold text-amber-950">Warning Limits</span>
              </div>
              <span className="text-lg font-extrabold text-amber-700">{warningConflictsCount}</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-blue-50/50 border border-blue-100 rounded-xl">
              <div className="flex items-center space-x-3">
                <div className="h-3 w-3 rounded-full bg-blue-500"></div>
                <span className="text-sm font-semibold text-blue-950">Informational Logs</span>
              </div>
              <span className="text-lg font-extrabold text-blue-700">{infoConflictsCount}</span>
            </div>
          </div>

          <div className="mt-6 flex justify-between items-center text-xs font-semibold text-slate-500 border-t border-slate-50 pt-4">
            <span>Total Conflicts</span>
            <span className="px-2.5 py-1 bg-slate-100 rounded-md text-slate-700 font-bold">{totalConflictsCount}</span>
          </div>
        </div>

        {/* Timetable Status Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm lg:col-span-1 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-800">Scheduler Workflow</h3>
              <StatusIcon className="text-slate-400 h-5 w-5" />
            </div>
            <p className="text-xs text-slate-400 mb-6">
              Status indicator for timetable generation. Issues must be resolved in Allocations.
            </p>
          </div>

          <div className={`p-5 rounded-2xl border flex flex-col items-center justify-center text-center ${statusColorClass} my-4`}>
            <StatusIcon className="h-10 w-10 mb-2" />
            <h4 className="text-lg font-extrabold tracking-tight uppercase">{statusText}</h4>
            <p className="text-xs font-medium opacity-90 mt-1">
              {criticalConflictsCount > 0 || warningConflictsCount > 0
                ? "Resolve issues to unlock the AI generator."
                : timetableExists
                ? "The active schedule is ready for viewing."
                : "All constraints pass. Generation ready."}
            </p>
          </div>

          <div className="mt-4 flex space-x-3">
            <Link
              to="/allocations"
              className="flex-1 text-center bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold py-3 px-4 rounded-xl transition duration-200"
            >
              Manage Allocations
            </Link>
            {timetableExists && (
              <Link
                to="/timetable"
                className="flex-1 text-center bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold py-3 px-4 rounded-xl transition duration-200"
              >
                View Timetable
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.3em] text-indigo-600">
            <ShieldCheck className="h-4 w-4" />
            Quick actions
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Link to="/allocations" className="rounded-2xl border border-slate-200 p-4 transition hover:border-indigo-300 hover:shadow-sm">
              <div className="flex items-center justify-between text-slate-800">
                <span className="font-semibold">Manage allocations</span>
                <ArrowRight className="h-4 w-4" />
              </div>
              <p className="mt-2 text-sm text-slate-500">Review and refine the data feeding the scheduling engine.</p>
            </Link>
            <Link to="/settings" className="rounded-2xl border border-slate-200 p-4 transition hover:border-indigo-300 hover:shadow-sm">
              <div className="flex items-center justify-between text-slate-800">
                <span className="font-semibold">Update school settings</span>
                <ArrowRight className="h-4 w-4" />
              </div>
              <p className="mt-2 text-sm text-slate-500">Fine-tune timing, days, and timetable structure.</p>
            </Link>
            <Link to="/timetable" className="rounded-2xl border border-slate-200 p-4 transition hover:border-indigo-300 hover:shadow-sm">
              <div className="flex items-center justify-between text-slate-800">
                <span className="font-semibold">Review timetable</span>
                <ArrowRight className="h-4 w-4" />
              </div>
              <p className="mt-2 text-sm text-slate-500">Inspect the generated schedule and resolve conflicts.</p>
            </Link>
            <Link to="/reports" className="rounded-2xl border border-slate-200 p-4 transition hover:border-indigo-300 hover:shadow-sm">
              <div className="flex items-center justify-between text-slate-800">
                <span className="font-semibold">Export reports</span>
                <ArrowRight className="h-4 w-4" />
              </div>
              <p className="mt-2 text-sm text-slate-500">Generate CSV and JSON exports for school leadership.</p>
            </Link>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">
            <Activity className="h-4 w-4" />
            Scheduler health
          </div>
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="flex items-center justify-between text-sm font-semibold text-slate-700">
                <span>Health score</span>
                <span className="text-lg font-bold text-slate-900">{healthScore}%</span>
              </div>
              <div className="mt-3 h-2.5 rounded-full bg-slate-200">
                <div className={`h-2.5 rounded-full transition-all duration-500 ${healthBarColor}`} style={{ width: `${healthScore}%` }} />
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-600">
              {timetableExists ? "A generated timetable is available for review and export." : "Generate a timetable when allocations and conflicts are ready."}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
