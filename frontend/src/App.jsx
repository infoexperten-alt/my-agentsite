import { Outlet, useMatch } from "react-router-dom";
import AppSidebar from "./components/layout/AppSidebar";
import ProjectSidebar from "./components/layout/ProjectSidebar";
import TopHeader from "./components/layout/TopHeader";

export default function App() {
  const projectMatch = useMatch("/project/:projectId");

  return (
    <div className="h-screen flex overflow-hidden selection:bg-brand-500 selection:text-white">
      {projectMatch ? <ProjectSidebar /> : <AppSidebar />}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        <TopHeader />
        <Outlet />
      </main>
    </div>
  );
}
