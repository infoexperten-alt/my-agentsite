import { createContext, useContext, useState } from "react";
import useModels from "../hooks/useModels";
import useProviders from "../hooks/useProviders";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const modelsState = useModels();
  const providersState = useProviders();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [search, setSearch] = useState("");

  return (
    <AppContext.Provider
      value={{
        models: modelsState,
        providers: providersState,
        settingsOpen,
        setSettingsOpen,
        search,
        setSearch,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
