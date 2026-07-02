import { Link } from "react-router-dom";
import { useSchoolStore } from "../../store/schoolStore";
import { 
  Users, 
  BookOpen, 
  Layers, 
  Briefcase, 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle,
  HelpCircle
} from "lucide-react";

function DashboardPage() {
  const teachers = useSchoolStore((state) => state.teachers);
  const subjects = useSchoolStore((state) => state.subjects);
  const classes = useSchoolStore((state) => state.classes);
  const allocations = useSchoolStore((state) => state.allocations);
  const generatedTimetable = useSchoolStore((state) => state.generatedTimetable);
  const conflicts = useSchoolStore((state) => state.conflicts);
  const healthScore = useSchoolStore((state) => state.timetableHealthScore);

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

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-8">Dashboard</h1>

      {/* Overview stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-300 flex items-center space-x-4">
          <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
            <Users className="h-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-500">Total Teachers</h3>
            <p className="text-3xl font-bold text-slate-900 mt-1">{teachers.length}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-300 flex items-center space-x-4">
          <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
            <BookOpen className="h-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-500">Total Subjects</h3>
            <p className="text-3xl font-bold text-slate-900 mt-1">{subjects.length}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-300 flex items-center space-x-4">
          <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
            <Layers className="h-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-500">Total Classes</h3>
            <p className="text-3xl font-bold text-slate-900 mt-1">{classes.length}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-300 flex items-center space-x-4">
          <div className="p-3 bg-purple-50 rounded-xl text-purple-600">
            <Briefcase className="h-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-500">Total Allocations</h3>
            <p className="text-3xl font-bold text-slate-900 mt-1">{allocations.length}</p>
          </div>
        </div>
      </div>

      {/* Intelligence layer metrics (Health Score & Conflict Counters) */}
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
    </div>
  );
}

export default DashboardPage;
