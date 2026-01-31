/**
 * Live preview panel with iframe for generated sites.
 */
export class PreviewPanel {
  constructor(container) {
    this.container = container;
    this.projectId = null;
    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div class="preview-panel">
        <div class="preview-toolbar">
          <div class="preview-device-buttons">
            <button class="device-btn active" data-width="100%" title="Desktop">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
            </button>
            <button class="device-btn" data-width="768px" title="Tablet">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12" y2="18"/>
              </svg>
            </button>
            <button class="device-btn" data-width="375px" title="Mobile">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12" y2="18"/>
              </svg>
            </button>
          </div>
          <button id="preview-refresh" class="btn-ghost" title="Refresh preview">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
          </button>
          <a id="preview-open" class="btn-ghost" target="_blank" title="Open in new tab">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
          </a>
        </div>
        <div class="preview-frame-container">
          <div class="preview-empty" id="preview-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
            <p>Generate a website to see the preview</p>
          </div>
          <iframe id="preview-iframe" class="preview-iframe" hidden></iframe>
        </div>
      </div>
    `;

    this._bindEvents();
  }

  _bindEvents() {
    // Device toggle buttons
    this.container.querySelectorAll('.device-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.container.querySelectorAll('.device-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const iframe = this.container.querySelector('#preview-iframe');
        iframe.style.maxWidth = btn.dataset.width;
      });
    });

    this.container.querySelector('#preview-refresh').addEventListener('click', () => {
      this.refresh();
    });
  }

  load(projectId) {
    this.projectId = projectId;
    const iframe = this.container.querySelector('#preview-iframe');
    const empty = this.container.querySelector('#preview-empty');
    const openBtn = this.container.querySelector('#preview-open');

    const url = `${window.location.origin}/preview/${projectId}`;
    iframe.src = url;
    iframe.hidden = false;
    empty.hidden = true;
    openBtn.href = url;
  }

  refresh() {
    if (this.projectId) {
      this.load(this.projectId);
    }
  }

  clear() {
    this.projectId = null;
    const iframe = this.container.querySelector('#preview-iframe');
    const empty = this.container.querySelector('#preview-empty');
    iframe.hidden = true;
    iframe.src = '';
    empty.hidden = false;
  }
}
