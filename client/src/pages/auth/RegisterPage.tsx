import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../../services/api";
import { useAuthStore } from "../../store/authStore";

function RegisterPage() {
  const navigate = useNavigate();
  const setToken = useAuthStore((state) => state.setToken);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleRegister = async () => {
    try {
      const response = await api.post("/auth/register", {
        email: email.trim(),
        password: password.trim(),
      });

      if (!response.data?.token) {
        throw new Error("No token received from server");
      }

      setToken(response.data.token);
      localStorage.setItem("ragavi_token", response.data.token);
      navigate("/dashboard");
    } catch (err: unknown) {
      const axiosError = err as {
        response?: { data?: { message?: string } };
        message?: string;
      };

      setError(axiosError?.response?.data?.message || axiosError?.message || "Registration failed. Try a different email.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <div className="bg-white w-full max-w-md p-8 rounded-2xl shadow-lg">
        <h1 className="text-3xl font-bold text-center">Register</h1>

        <div className="mt-6 space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border rounded-lg p-3"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border rounded-lg p-3"
          />

          {error && <div className="text-red-600">{error}</div>}

          <button
            type="button"
            onClick={handleRegister}
            className="w-full bg-black text-white p-3 rounded-lg"
          >
            Register
          </button>

          <p className="text-sm text-center text-slate-500 mt-4">
            Already have an account? <Link to="/" className="text-blue-600">Login</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default RegisterPage;
