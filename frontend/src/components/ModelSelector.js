/**
 * Model selector with auto-discovery from Prompture.
 */
export class ModelSelector {
  constructor(container, { onChange }) {
    this.container = container;
    this.onChange = onChange;
    this.models = [];
    this.selected = '';
    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div class="model-selector">
        <label class="control-label">Model</label>
        <select id="model-select" class="select">
          <option value="">Loading models...</option>
        </select>
        <button id="model-refresh" class="btn-ghost btn-sm" title="Refresh models">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
        </button>
      </div>
    `;

    this.container.querySelector('#model-select').addEventListener('change', (e) => {
      this.selected = e.target.value;
      if (this.onChange) this.onChange(this.selected);
    });

    this.container.querySelector('#model-refresh').addEventListener('click', () => {
      this.loadModels();
    });
  }

  async loadModels() {
    const select = this.container.querySelector('#model-select');
    select.innerHTML = '<option value="">Loading...</option>';
    select.disabled = true;

    try {
      const { api } = await import('../lib/api.js');
      const result = await api.getModels();
      this.models = result.models || [];

      if (!this.models.length) {
        select.innerHTML = '<option value="">No models found</option>';
      } else {
        // Default to first model if nothing selected yet
        if (!this.selected) {
          this.selected = this.models[0];
        }
        select.innerHTML = this.models
          .map((m) => `<option value="${m}" ${m === this.selected ? 'selected' : ''}>${m}</option>`)
          .join('');
      }
    } catch (e) {
      select.innerHTML = '<option value="">Failed to load models</option>';
    }

    select.disabled = false;
  }

  getValue() {
    return this.selected;
  }

  setValue(model) {
    this.selected = model;
    const select = this.container.querySelector('#model-select');
    if (select) select.value = model;
  }
}
