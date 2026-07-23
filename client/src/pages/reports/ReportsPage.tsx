import { useMemo, useState } from "react";
import { useSchoolStore } from "../../store/schoolStore";
import { parseWorkingDays } from "../../utils/dateUtils";
import {
  BarChart3,
  Download,
  FileText,
  Users,
  BookOpen,
  Layers,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

type ReportType = "summary" | "teacher" | "class" | "utilization";
type ExportFormat = "csv" | "json";

export function ReportsPage() {
  const teachers = useSchoolStore((state) => state.teachers);
  const subjects = useSchoolStore((state) => state.subjects);
  const classes = useSchoolStore((state) => state.classes);
  const allocations = useSchoolStore((state) => state.allocations);
  const settings = useSchoolStore((state) => state.schoolSettings);
  const generatedTimetable = useSchoolStore((state) => state.generatedTimetable);
  const conflicts = useSchoolStore((state) => state.conflicts);

  const [reportType, setReportType] = useState<ReportType>("summary");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("csv");

  const days = useMemo(() => parseWorkingDays(settings.workingDays), [settings.workingDays]);
  const periodsPerDay = Number(settings.periodsPerDay) || 8;
  const weeklyCapacity = days.length * periodsPerDay;
  const totalAllocated = allocations.reduce((sum, a) => sum + Number(a.periods), 0);
  const timetableExists = Object.keys(generatedTimetable).length > 0;

  // Teacher workload analysis
  const teacherWorkloadData = useMemo(() => {
    const teacherPeriods: Record<string, number> = {};
    allocations.forEach((a) => {
      if (a.teacherId) {
        teacherPeriods[a.teacherId] = (teacherPeriods[a.teacherId] || 0) + Number(a.periods);
      }
    });

    return teachers.map((t) => ({
      name: t.name,
      subject: t.subject,
      workload: Number(t.workload) || 0,
      allocated: teacherPeriods[t.id] || 0,
      utilization: Number(t.workload) ? Math.round(((teacherPeriods[t.id] || 0) / Number(t.workload)) * 100) : 0,
    }));
  }, [teachers, allocations]);

  // Class allocation analysis
  const classAllocationData = useMemo(() => {
    const classPeriods: Record<string, number> = {};
    allocations.forEach((a) => {
      if (a.classId) {
        classPeriods[a.classId] = (classPeriods[a.classId] || 0) + Number(a.periods);
      }
    });

    return classes.map((c) => ({
      name: `${c.className}-${c.section}`,
      allocated: classPeriods[c.id] || 0,
      capacity: weeklyCapacity,
      utilization: Math.round(((classPeriods[c.id] || 0) / weeklyCapacity) * 100),
    }));
  }, [classes, allocations, weeklyCapacity]);

  // Subject period distribution
  const subjectDistribution = useMemo(() => {
    const subjectPeriods: Record<string, number> = {};
    allocations.forEach((a) => {
      subjectPeriods[a.subjectId] = (subjectPeriods[a.subjectId] || 0) + Number(a.periods);
    });

    return subjects.map((s) => ({
      name: s.name,
      periods: subjectPeriods[s.id] || 0,
      targetPerWeek: Number(s.periodsPerWeek) || 0,
    }));
  }, [subjects, allocations]);

  const criticalCount = conflicts.filter((c) => c.severity === "critical").length;
  const warningCount = conflicts.filter((c) => c.severity === "warning").length;

  const generateCSV = () => {
    let csv = "";
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;

    switch (reportType) {
      case "teacher":
        csv = "Teacher,Subject,Max Workload,Allocated Periods,Utilization%\n";
        teacherWorkloadData.forEach((t) => {
          csv += `${escape(t.name)},${escape(t.subject)},${t.workload},${t.allocated},${t.utilization}\n`;
        });
        break;
      case "class":
        csv = "Class,Allocated Periods,Weekly Capacity,Utilization%\n";
        classAllocationData.forEach((c) => {
          csv += `${escape(c.name)},${c.allocated},${c.capacity},${c.utilization}\n`;
        });
        break;
      case "utilization":
        csv = "Subject,Allocated Periods,Target/Week\n";
        subjectDistribution.forEach((s) => {
          csv += `${escape(s.name)},${s.periods},${s.targetPerWeek}\n`;
        });
        break;
      default:
        csv = "Metric,Value\n";
        csv += `Teachers,${teachers.length}\n`;
        csv += `Subjects,${subjects.length}\n`;
        csv += `Classes,${classes.length}\n`;
        csv += `Allocations,${allocations.length}\n`;
        csv += `Total Periods Allocated,${totalAllocated}\n`;
        csv += `Weekly Capacity,${weeklyCapacity}\n`;
        csv += `Working Days,${days.length}\n`;
        csv += `Periods Per Day,${periodsPerDay}\n`;
        csv += `Conflicts (Critical),${criticalCount}\n`;
        csv += `Conflicts (Warning),${warningCount}\n`;
        csv += `Timetable Generated,${timetableExists ? "Yes" : "No"}\n`;
    }

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${reportType}-report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const generateJSON = () => {
    let data: Record<string, unknown>;

    switch (reportType) {
      case "teacher":
        data = { report: "Teacher Workload Analysis", generatedAt: new Date().toISOString(), teachers: teacherWorkloadData };
        break;
      case "class":
        data = { report: "Class Allocation Analysis", generatedAt: new Date().toISOString(), classes: classAllocationData };
        break;
      case "utilization":
        data = { report: "Subject Distribution", generatedAt: new Date().toISOString(), subjects: subjectDistribution };
        break;
      default:
        data = {
          report: "Timetable Summary",
          generatedAt: new Date().toISOString(),
          overview: {
            teachers: teachers.length,
            subjects: subjects.length,
            classes: classes.length,
            allocations: allocations.length,
            totalPeriodsAllocated: totalAllocated,
            weeklyCapacity,
            workingDays: days.length,
            periodsPerDay,
            timetableGenerated: timetableExists,
            conflicts: { critical: criticalCount, warning: warningCount },
          },
        };
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${reportType}-report.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExport = () => {
    if (exportFormat === "csv") generateCSV();
    else generateJSON();
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Reports & Analytics</h1>
          <p className="text-sm text-slate-500 mt-1">
            View and export timetable reports, workload analysis, and utilization metrics.
          </p>
        </div>
      </div>

      {/* Report type selector */}
      <div className="flex flex-wrap gap-2 mb-6">
        {[
          { key: "summary" as ReportType, label: "Summary", icon: BarChart3 },
          { key: "teacher" as ReportType, label: "Teacher Workload", icon: Users },
          { key: "class" as ReportType, label: "Class Allocation", icon: Layers },
          { key: "utilization" as ReportType, label: "Subject Distribution", icon: BookOpen },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setReportType(tab.key)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                reportType === tab.key
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Report content */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-6">
        {reportType === "summary" && (
          <div>
            <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              Timetable Summary Report
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
              {[
                { label: "Teachers", value: teachers.length, icon: Users, color: "bg-blue-50 text-blue-600" },
                { label: "Subjects", value: subjects.length, icon: BookOpen, color: "bg-green-50 text-green-600" },
                { label: "Classes", value: classes.length, icon: Layers, color: "bg-purple-50 text-purple-600" },
                { label: "Allocations", value: allocations.length, icon: Calendar, color: "bg-indigo-50 text-indigo-600" },
                { label: "Periods Allocated", value: totalAllocated, icon: Clock, color: "bg-amber-50 text-amber-600" },
              ].map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} className={`rounded-xl p-4 ${stat.color} border`}>
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase">{stat.label}</span>
                    </div>
                    <div className="text-2xl font-extrabold">{stat.value}</div>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-200 p-4">
                <h3 className="text-sm font-bold text-slate-700 mb-3">Schedule Settings</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">Working Days</span><span className="font-semibold">{days.length} days</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Periods Per Day</span><span className="font-semibold">{periodsPerDay}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Weekly Capacity</span><span className="font-semibold">{weeklyCapacity} slots</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Total Allocated</span><span className="font-semibold">{totalAllocated} slots</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Utilization</span><span className="font-semibold">{weeklyCapacity > 0 ? Math.round((totalAllocated / (classes.length * weeklyCapacity || 1)) * 100) : 0}%</span></div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <h3 className="text-sm font-bold text-slate-700 mb-3">Conflict Status</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-2 text-slate-500">
                      <AlertTriangle className="w-4 h-4 text-red-500" /> Critical
                    </span>
                    <span className="font-bold text-red-600">{criticalCount}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-2 text-slate-500">
                      <AlertTriangle className="w-4 h-4 text-amber-500" /> Warnings
                    </span>
                    <span className="font-bold text-amber-600">{warningCount}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-2 text-slate-500">
                      <CheckCircle2 className="w-4 h-4 text-green-500" /> Timetable
                    </span>
                    <span className="font-bold text-green-600">{timetableExists ? "Generated" : "Not Generated"}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {reportType === "teacher" && (
          <div>
            <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600" />
              Teacher Workload Analysis
            </h2>

            {teacherWorkloadData.length === 0 ? (
              <p className="text-slate-400 text-center py-8">No teachers found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead>
                    <tr className="text-left text-slate-500">
                      <th className="px-3 py-3 font-semibold">Teacher</th>
                      <th className="px-3 py-3 font-semibold">Subject</th>
                      <th className="px-3 py-3 font-semibold text-right">Max Workload</th>
                      <th className="px-3 py-3 font-semibold text-right">Allocated</th>
                      <th className="px-3 py-3 font-semibold text-right">Utilization</th>
                      <th className="px-3 py-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {teacherWorkloadData.map((t) => (
                      <tr key={t.name} className="hover:bg-slate-50">
                        <td className="px-3 py-3 text-slate-700 font-medium">{t.name}</td>
                        <td className="px-3 py-3 text-slate-600">{t.subject}</td>
                        <td className="px-3 py-3 text-right text-slate-700">{t.workload}</td>
                        <td className="px-3 py-3 text-right text-slate-700">{t.allocated}</td>
                        <td className="px-3 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  t.utilization > 100 ? "bg-red-500" : t.utilization > 80 ? "bg-amber-500" : "bg-green-500"
                                }`}
                                style={{ width: `${Math.min(t.utilization, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs font-bold">{t.utilization}%</span>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          {t.utilization > 100 ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">Overloaded</span>
                          ) : t.utilization > 80 ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Near Limit</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">OK</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {reportType === "class" && (
          <div>
            <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-600" />
              Class Allocation Analysis
            </h2>

            {classAllocationData.length === 0 ? (
              <p className="text-slate-400 text-center py-8">No classes found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead>
                    <tr className="text-left text-slate-500">
                      <th className="px-3 py-3 font-semibold">Class</th>
                      <th className="px-3 py-3 font-semibold text-right">Allocated</th>
                      <th className="px-3 py-3 font-semibold text-right">Capacity</th>
                      <th className="px-3 py-3 font-semibold text-right">Utilization</th>
                      <th className="px-3 py-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {classAllocationData.map((c) => (
                      <tr key={c.name} className="hover:bg-slate-50">
                        <td className="px-3 py-3 text-slate-700 font-medium">{c.name}</td>
                        <td className="px-3 py-3 text-right text-slate-700">{c.allocated}</td>
                        <td className="px-3 py-3 text-right text-slate-700">{c.capacity}</td>
                        <td className="px-3 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  c.utilization > 100 ? "bg-red-500" : c.utilization > 80 ? "bg-amber-500" : "bg-green-500"
                                }`}
                                style={{ width: `${Math.min(c.utilization, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs font-bold">{c.utilization}%</span>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          {c.utilization > 100 ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">Over-allocated</span>
                          ) : c.utilization > 80 ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Near Capacity</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">OK</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {reportType === "utilization" && (
          <div>
            <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-600" />
              Subject Distribution
            </h2>

            {subjectDistribution.length === 0 ? (
              <p className="text-slate-400 text-center py-8">No subjects found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead>
                    <tr className="text-left text-slate-500">
                      <th className="px-3 py-3 font-semibold">Subject</th>
                      <th className="px-3 py-3 font-semibold text-right">Allocated Periods</th>
                      <th className="px-3 py-3 font-semibold text-right">Target/Week</th>
                      <th className="px-3 py-3 font-semibold text-right">Distribution</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {subjectDistribution.map((s) => (
                      <tr key={s.name} className="hover:bg-slate-50">
                        <td className="px-3 py-3 text-slate-700 font-medium">{s.name}</td>
                        <td className="px-3 py-3 text-right text-slate-700">{s.periods}</td>
                        <td className="px-3 py-3 text-right text-slate-700">{s.targetPerWeek}</td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full bg-indigo-500"
                                style={{ width: `${s.targetPerWeek > 0 ? Math.min((s.periods / s.targetPerWeek) * 100, 100) : s.periods > 0 ? 100 : 0}%` }}
                              />
                            </div>
                            <span className="text-xs text-slate-500">
                              {s.targetPerWeek > 0 ? `${Math.round((s.periods / s.targetPerWeek) * 100)}%` : "N/A"}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Export controls */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Download className="w-5 h-5 text-indigo-600" />
          Export Report
        </h3>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white"
          >
            <option value="csv">CSV</option>
            <option value="json">JSON</option>
          </select>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-2.5 rounded-xl transition text-sm"
          >
            <Download className="w-4 h-4" />
            Export {reportType === "summary" ? "Summary" : reportType === "teacher" ? "Workload" : reportType === "class" ? "Class" : "Subject"} Report
          </button>
        </div>
      </div>
    </div>
  );
}

export default ReportsPage;