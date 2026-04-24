import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE = "https://mall-nroh.onrender.com";

export const api = axios.create({
  baseURL: `${BASE}/api`,
  withCredentials: true,
  timeout: 30000,
});

api.interceptors.request.use(async (config) => {
  try {
    const token = await AsyncStorage.getItem("session_token");
    if (token) {
      config.headers = config.headers || {};
      (config.headers as any).Authorization = `Bearer ${token}`;
    }
  } catch {}
  return config;
});

export default api;
