import React, { createContext, useContext, useState } from "react";

export type AiContextKey = "dashboard" | "inventory" | "expenses" | "staff" | "menu" | "profile";

const Ctx = createContext<{
  key: AiContextKey;
  setKey: (k: AiContextKey) => void;
}>({ key: "dashboard", setKey: () => {} });

export function AiContextProvider({ children }: { children: React.ReactNode }) {
  const [key, setKey] = useState<AiContextKey>("dashboard");
  return <Ctx.Provider value={{ key, setKey }}>{children}</Ctx.Provider>;
}

export function useAiContext() {
  return useContext(Ctx);
}
