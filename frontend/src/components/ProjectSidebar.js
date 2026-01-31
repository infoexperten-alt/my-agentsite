/**
 * Left sidebar — project list and file explorer.
 */
export class ProjectSidebar {
  constructor(container, { onSelect, onNew, onDelete }) {
    this.container = container;
    this.onSelect = onSelect;
    this.onNew = onNew;
    this.onDelete = onDelete;
    this.projects = [];
    this.files = [];
    this.selectedId = null;
    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div class="sidebar">
        <div class="sidebar-header">
          <h1 class="sidebar-logo">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
            AgentSite
          </h1>
          <button id="new-project-btn" class="btn-primary btn-sm" title="New Project">+</button>
        </div>
        <div class="sidebar-section">
          <h3 class="sidebar-section-title">Projects</h3>
          <div id="project-list" class="project-list"></div>
        </div>
        <div class="sidebar-section" id="file-section" hidden>
          <h3 class="sidebar-section-title">Files</h3>
          <div id="file-list" class="file-list"></div>
        </div>
      </div>
    `;

    this.container.querySelector('#new-project-btn').addEventListener('click', () => {
      if (this.onNew) this.onNew();
    });
  }

  setProjects(projects) {
    this.projects = projects;
    const list = this.container.querySelector('#project-list');

    if (!projects.length) {
      list.innerHTML = '<p class="sidebar-empty">No projects yet</p>';
      return;
    }

    list.innerHTML = projects
      .map(
        (p) => `
      <div class="project-item ${p.id === this.selectedId ? 'active' : ''}" data-id="${p.id}">
        <div class="project-item-info">
          <span class="project-item-name">${this._escapeHtml(p.name)}</span>
          <span class="project-item-status status-${p.status}">${p.status}</span>
        </div>
        <button class="project-item-delete btn-ghost" data-id="${p.id}" title="Delete">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>
    `
      )
      .join('');

    list.querySelectorAll('.project-item').forEach((el) => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('.project-item-delete')) return;
        const id = el.dataset.id;
        this.selectedId = id;
        this.setProjects(this.projects);
        if (this.onSelect) this.onSelect(id);
      });
    });

    list.querySelectorAll('.project-item-delete').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.onDelete) this.onDelete(btn.dataset.id);
      });
    });
  }

  setFiles(files) {
    this.files = files;
    const section = this.container.querySelector('#file-section');
    const list = this.container.querySelector('#file-list');

    if (!files.length) {
      section.hidden = true;
      return;
    }

    section.hidden = false;
    list.innerHTML = files
      .map((f) => {
        const ext = f.split('.').pop();
        return `<div class="file-item" title="${f}">
          <span class="file-icon file-icon--${ext}">.${ext}</span>
          <span class="file-name">${f}</span>
        </div>`;
      })
      .join('');
  }

  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
