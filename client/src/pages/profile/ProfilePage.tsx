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
      const response = await api.put("/profile", { email: email.trim() });
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

  const handleChangePassword = async () => {
    setPasswordError("");
    setPasswordSuccess("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("All password fields are required.");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    setSavingPassword(true);
    try {
      await api.put("/profile/password", {
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
    if (!window.confirm("Are you sure you want to delete your account? This action cannot be undone.")) {
      return;
    }

    try {
      await api.delete("/profile");
      showToast("info", "Account deleted.");
      logout();
    } catch (err: unknown) {
      const message = getApiErrorMessage(err, "Failed to delete account.");
      showToast("error", message);
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
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 rounded-xl border border-slate-200 p-3 text-sm focus:border-indigo-500 focus:outline-none"
              placeholder="New email address"
            />
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
            <input
              type={showCurrent ? "text" : "password"}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-3 text-sm pr-10 focus:border-indigo-500 focus:outline-none"
              placeholder="Current Password"
            />
            <button
              type="button"
              onClick={() => setShowCurrent(!showCurrent)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <div className="relative">
            <input
              type={showNew ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-3 text-sm pr-10 focus:border-indigo-500 focus:outline-none"
              placeholder="New Password (min 8 characters)"
            />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-indigo-500 focus:outline-none"
            placeholder="Confirm New Password"
          />

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
          Deleting your account is irreversible. All your data will be permanently removed.
        </p>
        <button
          onClick={handleDeleteAccount}
          className="bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-3 rounded-xl transition text-sm"
        >
          Delete Account
        </button>
      </div>
    </div>
  );
}

export default ProfilePage;