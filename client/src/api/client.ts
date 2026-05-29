import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  timeout: 20000,
});

api.interceptors.response.use(
  (res) => res,
  (err: unknown) => {
    if (axios.isAxiosError(err) && typeof err.response?.data?.error === "string") {
      err.message = err.response.data.error;
    }
    return Promise.reject(err);
  }
);

export default api;
