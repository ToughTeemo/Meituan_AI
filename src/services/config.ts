export type ApiMode = "mock" | "api" | "demo";

function readApiMode(value: unknown): ApiMode {
  if (value === "api" || value === "demo" || value === "mock") return value;
  return "mock";
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export const API_MODE = readApiMode(import.meta.env.VITE_API_MODE);

export const USE_MOCK_FALLBACK =
  API_MODE !== "api"
    ? true
    : readBoolean(import.meta.env.VITE_USE_MOCK_FALLBACK, true);
