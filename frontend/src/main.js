/**
 * AgentSite main application — wires all components together.
 */
import { api } from './lib/api.js';
import { GenerationSocket } from './lib/websocket.js';
import { ChatPanel } from './components/ChatPanel.js';
import { PreviewPanel } from './components/PreviewPanel.js';
import { ProjectSidebar } from './components/ProjectSidebar.js';
import { ModelSelector } from './components/ModelSelector.js';
import { StyleControls } from './components/StyleControls.js';
import { ProgressTracker } from './components/ProgressTracker.js';
import { UsageDashboard } from './components/UsageDashboard.js';

class AgentSiteApp {
  constructor() {
    this.currentProject = null;
    this.socket = null;

    // Initialize components
    this.sidebar = new ProjectSidebar(document.getElementById('sidebar'), {
      onSelect: (id) => this.selectProject(id),
      onNew: () => this.createProject(),
      onDelete: (id) => this.deleteProject(id),
    });

    this.chat = new ChatPanel(document.getElementById('chat'), {
      onSubmit: (prompt) => this.handlePrompt(prompt),
      onImageUpload: (file) => this.handleImageUpload(file),
    });

    this.preview = new PreviewPanel(document.getElementById('preview'));

    this.modelSelector = new ModelSelector(document.getElementById('model-selector'), {
      onChange: (model) => {},
    });

    this.styleControls = new StyleControls(document.getElementById('style-controls'), {
      onChange: (values) => {},
    });

    this.progress = new ProgressTracker(document.getElementById('progress'));

    this.usage = new UsageDashboard(document.getElementById('usage'));

    // Export button
    document.getElementById('export-btn').addEventListener('click', () => this.exportProject());

    // Load initial data
    this.loadProjects();
    this.modelSelector.loadModels();
  }

  async loadProjects() {
    try {
      const projects = await api.listProjects();
      this.sidebar.setProjects(projects);
    } catch (e) {
      console.error('Failed to load projects:', e);
    }
  }

  async createProject() {
    try {
      const project = await api.createProject({ name: 'New Project' });
      await this.loadProjects();
      this.selectProject(project.id);
    } catch (e) {
      console.error('Failed to create project:', e);
    }
  }

  async selectProject(id) {
    try {
      this.currentProject = await api.getProject(id);
      this.sidebar.selectedId = id;

      // Load files
      const { files } = await api.getFiles(id);
      this.sidebar.setFiles(files);

      // Load preview if files exist
      if (files.length > 0) {
        this.preview.load(id);
      } else {
        this.preview.clear();
      }

      // Update usage
      if (this.currentProject.usage && Object.keys(this.currentProject.usage).length) {
        this.usage.setUsage(this.currentProject.usage);
      } else {
        this.usage.clear();
      }

      // Update style controls if style_spec exists
      if (this.currentProject.style_spec) {
        this.styleControls.setValues(this.currentProject.style_spec);
      }

      this.progress.reset();

      // Refresh sidebar to show active state
      const projects = await api.listProjects();
      this.sidebar.setProjects(projects);
    } catch (e) {
      console.error('Failed to select project:', e);
    }
  }

  async deleteProject(id) {
    if (!confirm('Delete this project and all its files?')) return;
    try {
      await api.deleteProject(id);
      if (this.currentProject && this.currentProject.id === id) {
        this.currentProject = null;
        this.preview.clear();
        this.usage.clear();
        this.sidebar.setFiles([]);
      }
      await this.loadProjects();
    } catch (e) {
      console.error('Failed to delete project:', e);
    }
  }

  async handlePrompt(prompt) {
    // Create project if none selected
    if (!this.currentProject) {
      try {
        const name = prompt.length > 50 ? prompt.substring(0, 50) + '...' : prompt;
        this.currentProject = await api.createProject({ name, prompt });
        await this.loadProjects();
        this.sidebar.selectedId = this.currentProject.id;
      } catch (e) {
        this.chat.addMessage('system', `Failed to create project: ${e.message}`);
        return;
      }
    }

    const model = this.modelSelector.getValue();
    this.chat.setLoading(true);
    this.progress.setGenerating();

    // Connect WebSocket for progress
    this.connectWebSocket(this.currentProject.id);

    try {
      await api.startGeneration(this.currentProject.id, { prompt, model });
      this.chat.addMessage('system', 'Generation started...');
    } catch (e) {
      this.chat.addMessage('system', `Error: ${e.message}`);
      this.chat.setLoading(false);
    }
  }

  connectWebSocket(projectId) {
    if (this.socket) {
      this.socket.disconnect();
    }

    this.socket = new GenerationSocket(projectId);

    this.socket
      .on('agent_start', (data) => {
        this.progress.setAgentStatus(data.agent, 'active');
        this.chat.addMessage('system', `[${data.agent}] Working...`);
      })
      .on('agent_complete', (data) => {
        this.progress.setAgentStatus(data.agent, 'complete');
        this.chat.addMessage('system', `[${data.agent}] Done`);
      })
      .on('file_written', (data) => {
        const path = data.data?.path || '';
        if (path) {
          this.chat.addMessage('system', `File written: ${path}`);
        }
      })
      .on('error', (data) => {
        const msg = data.data?.message || 'Unknown error';
        this.chat.addMessage('system', `Error: ${msg}`);
      })
      .on('generation_complete', async (data) => {
        this.chat.setLoading(false);
        this.chat.addMessage('system', 'Generation complete!');

        // Refresh project data
        if (this.currentProject) {
          await this.selectProject(this.currentProject.id);
        }

        this.socket.disconnect();
      })
      .connect();
  }

  async handleImageUpload(file) {
    if (!this.currentProject) return;
    try {
      await api.uploadAsset(this.currentProject.id, file);
      this.chat.addMessage('system', `Uploaded: ${file.name}`);
    } catch (e) {
      this.chat.addMessage('system', `Upload failed: ${e.message}`);
    }
  }

  async exportProject() {
    if (!this.currentProject) return;
    const url = api.getExportUrl(this.currentProject.id);
    window.open(url, '_blank');
  }
}

// Boot the app
document.addEventListener('DOMContentLoaded', () => {
  window.app = new AgentSiteApp();
});
