import { Outlet, useMatch } from "react-router-dom";
import AppSidebar from "./components/layout/AppSidebar";
import ProjectSidebar from "./components/layout/ProjectSidebar";
import TopHeader from "./components/layout/TopHeader";

function ProjectLayout() {
  return (
    <>
      <ProjectSidebar />
      <main className="flex-1 flex flex-col relative overflow-hidden">
        <TopHeader />
        <Outlet />
      </main>
    </>
  );
}

export default function App() {
  const projectMatch = useMatch("/project/:projectId");
  const settingsMatch = useMatch("/project/:projectId/settings");

  if (projectMatch || settingsMatch) {
    return (
      <div className="h-screen flex overflow-hidden selection:bg-brand-500 selection:text-white">
        <ProjectLayout />
      </div>
    );
  }

  return (
    <div className="h-screen flex overflow-hidden selection:bg-brand-500 selection:text-white">
      <AppSidebar />
      <main className="flex-1 flex flex-col relative overflow-hidden">
        <TopHeader />
        <Outlet />
      </main>
    </div>
  );
}
