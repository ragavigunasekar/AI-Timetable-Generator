import { useEffect, useState } from "react";
import { useAuthStore } from "../../store/authStore";
import { useToast } from "../../components/ui/ToastProvider";
import { getApiErrorMessage } from "../../utils/errorUtils";
import api from "../../services/api";
import {
  User,
  Mail,
  Shield,
  Save,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { LoadingState } from "../../components/common/LoadingState";

interface UserProfile {
  id: number;
  email: string;
  role: string;
}

function ProfilePage() {
  const { logout } = useAuthStore();
  const { showToast } = useToast();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Edit email
  const [email, setEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

  // Change password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/auth/profile");
      setProfile(response.data);
      setEmail(response.data.email);
    } catch (err: unknown) {
      const message = getApiErrorMessage(err, "Failed to load profile");
      setError(message);
      showToast("error", message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateEmail = async () => {
    if (!email || !email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    setSavingEmail(true);
    setError("");
    try {
      const response = await api.put("/auth/profile", { email: email.trim() });
      setProfile(response.data);
      showToast("success", "Email updated successfully.");
    } catch (err: unknown) {
      const message = getApiErrorMessage(err, "Failed to update email.");
      setError(message);
      showToast("error", message);
    } finally {
      setSavingEmail(false);
    }
  };

  const validatePassword = (p: string): { valid: boolean; message: string } => {
    if (p.length < 8) return { valid: false, message: "At least 8 characters" };
    if (!/[a-z]/.test(p)) return { valid: false, message: "Needs one lowercase letter" };
    if (!/[A-Z]/.test(p)) return { valid: false, message: "Needs one uppercase letter" };
    if (!/\d/.test(p)) return { valid: false, message: "Needs one digit" };
    return { valid: true, message: "Password is strong." };
  };

  const handleChangePassword = async () => {
    setPasswordError("");
    setPasswordSuccess("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("All password fields are required.");
      return;
    }

    const passwordCheck = validatePassword(newPassword);
    if (!passwordCheck.valid) {
      setPasswordError(`New password is invalid: ${passwordCheck.message}.`);
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    setSavingPassword(true);
    try {
      await api.put("/auth/profile/password", {
        currentPassword,
        newPassword,
      });
      setPasswordSuccess("Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      showToast("success", "Password updated successfully.");
    } catch (err: unknown) {
      const message = getApiErrorMessage(err, "Failed to change password.");
      setPasswordError(message);
      showToast("error", message);
    } finally {
      setSavingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      setDeletingAccount(true);
      await api.delete("/auth/profile");
      showToast("info", "Account deleted.");
      logout();
    } catch (err: unknown) {
      const message = getApiErrorMessage(err, "Failed to delete account.");
      showToast("error", message);
    } finally {
      setDeletingAccount(false);
      setConfirmingDelete(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <LoadingState title="Loading profile" message="Fetching your account details." compact />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-slate-900 mb-8">Profile Settings</h1>

      {error && (
        <div className="mb-6 flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Profile Info Card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-indigo-100 rounded-xl">
            <User className="w-5 h-5 text-indigo-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-800">Account Information</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 border border-slate-100">
            <Mail className="w-5 h-5 text-slate-400" />
            <div>
              <p className="text-xs text-slate-500 font-semibold uppercase">Email</p>
              <p className="text-sm font-bold text-slate-800">{profile?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 border border-slate-100">
            <Shield className="w-5 h-5 text-slate-400" />
            <div>
              <p className="text-xs text-slate-500 font-semibold uppercase">Role</p>
              <p className="text-sm font-bold text-slate-800 capitalize">{profile?.role || "Teacher"}</p>
            </div>
          </div>
        </div>

        {/* Update Email */}
        <div className="border-t border-slate-100 pt-6">
          <h3 className="text-sm font-bold text-slate-700 mb-4">Update Email</h3>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label htmlFor="profile-email" className="block text-sm font-semibold text-slate-700 mb-1.5">Email Address <span className="text-rose-500">*</span></label>
              <input
                id="profile-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-indigo-500 focus:outline-none"
                placeholder="you@school.edu"
                autoComplete="email"
              />
              <p className="mt-1 text-xs text-slate-500">We never share your email with third parties.</p>
            </div>
            <button
              onClick={handleUpdateEmail}
              disabled={savingEmail}
              className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-3 rounded-xl transition text-sm disabled:opacity-70"
            >
              <Save className="w-4 h-4" />
              {savingEmail ? "Saving..." : "Update Email"}
            </button>
          </div>
        </div>
      </div>

      {/* Change Password Card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-amber-100 rounded-xl">
            <Eye className="w-5 h-5 text-amber-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-800">Change Password</h2>
        </div>

        {passwordError && (
          <div className="mb-4 flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {passwordError}
          </div>
        )}

        {passwordSuccess && (
          <div className="mb-4 flex items-center gap-2 text-green-600 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            {passwordSuccess}
          </div>
        )}

        <div className="space-y-4">
          <div className="relative">
            <label htmlFor="current-password" className="block text-sm font-semibold text-slate-700 mb-1.5">Current Password <span className="text-rose-500">*</span></label>
            <div className="relative">
              <input
                id="current-password"
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-3 text-sm pr-10 focus:border-indigo-500 focus:outline-none"
                placeholder="Enter your current password"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label={showCurrent ? "Hide password" : "Show password"}
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="relative">
            <label htmlFor="new-password" className="block text-sm font-semibold text-slate-700 mb-1.5">New Password <span className="text-rose-500">*</span></label>
            <div className="relative">
              <input
                id="new-password"
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-3 text-sm pr-10 focus:border-indigo-500 focus:outline-none"
                placeholder="Create a strong password"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label={showNew ? "Hide password" : "Show password"}
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="confirm-password" className="block text-sm font-semibold text-slate-700 mb-1.5">Confirm New Password <span className="text-rose-500">*</span></label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-indigo-500 focus:outline-none"
              placeholder="Re-enter the new password"
              autoComplete="new-password"
            />
          </div>

          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs space-y-1">
            <p className="font-bold text-amber-900 mb-1">Password requirements:</p>
            <ul className="space-y-0.5 text-amber-800 pl-4 list-disc">
              <li>At least 8 characters long</li>
              <li>One lowercase letter (a–z)</li>
              <li>One uppercase letter (A–Z)</li>
              <li>One digit (0–9)</li>
            </ul>
          </div>

          <button
            onClick={handleChangePassword}
            disabled={savingPassword}
            className="flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-bold px-6 py-3 rounded-xl transition text-sm disabled:opacity-70"
          >
            <Save className="w-4 h-4" />
            {savingPassword ? "Changing..." : "Change Password"}
          </button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-6">
        <h2 className="text-lg font-bold text-red-700 mb-4">Danger Zone</h2>
        <p className="text-sm text-slate-500 mb-4">
          Deleting your account is irreversible. All your teachers, subjects, classes, allocations, timetables and settings will be permanently removed.
        </p>
        {confirmingDelete ? (
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleDeleteAccount}
              disabled={deletingAccount}
              className="bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-3 rounded-xl transition text-sm disabled:opacity-70"
            >
              {deletingAccount ? "Deleting Account..." : "Yes, Permanently Delete My Account"}
            </button>
            <button
              onClick={() => setConfirmingDelete(false)}
              disabled={deletingAccount}
              className="rounded-xl border border-slate-200 px-6 py-3 font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-70 text-sm"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmingDelete(true)}
            className="bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-3 rounded-xl transition text-sm"
          >
            Delete Account
          </button>
        )}
      </div>
    </div>
  );
}

export default ProfilePage;