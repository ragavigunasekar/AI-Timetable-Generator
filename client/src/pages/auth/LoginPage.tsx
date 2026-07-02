import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../../services/api";
import { useAuthStore } from "../../store/authStore";

function LoginPage() {
  const navigate = useNavigate();
  const setToken = useAuthStore((state) => state.setToken);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async () => {
    try {
      setError("");

      const response = await api.post("/auth/login", {
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

      const message = axiosError?.response?.data?.message || axiosError?.message || "Login failed. Please try again.";
      setError(message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <div className="bg-white w-full max-w-md p-8 rounded-2xl shadow-lg">

        <h1 className="text-3xl font-bold text-center">
          Ragavi Scheduler AI
        </h1>

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

          {error && (
            <div className="text-red-600 text-sm bg-red-50 p-2 rounded">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleLogin}
            className="w-full bg-black text-white p-3 rounded-lg hover:bg-gray-800"
          >
            Login
          </button>

          <p className="text-sm text-center text-slate-500 mt-4">
            Don't have an account?{" "}
            <Link to="/register" className="text-blue-600">
              Register
            </Link>
          </p>

        </div>
      </div>
    </div>
  );
}

export default LoginPage;