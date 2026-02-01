import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import DashboardPage from "./pages/DashboardPage";
import ProjectPage from "./pages/ProjectPage";
import ProjectSettingsPage from "./pages/ProjectSettingsPage";
import PageBuilderPage from "./pages/PageBuilderPage";
import AgentsPage from "./pages/AgentsPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import { AppProvider } from "./context/AppContext";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<App />}>
            <Route index element={<DashboardPage />} />
            <Route path="agents" element={<AgentsPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="project/:projectId" element={<ProjectPage />} />
            <Route path="project/:projectId/settings" element={<ProjectSettingsPage />} />
          </Route>
          <Route
            path="project/:projectId/page/:slug"
            element={<PageBuilderPage />}
          />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  </React.StrictMode>
);
