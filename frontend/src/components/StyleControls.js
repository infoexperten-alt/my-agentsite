/**
 * Style controls — color pickers and font selectors.
 */
export class StyleControls {
  constructor(container, { onChange }) {
    this.container = container;
    this.onChange = onChange;
    this.values = {
      primaryColor: '#2563eb',
      secondaryColor: '#1e40af',
      accentColor: '#f59e0b',
      backgroundColor: '#ffffff',
      textColor: '#1f2937',
      fontHeading: 'Inter',
      fontBody: 'Inter',
    };
    this.render();
  }

  render() {
    const fonts = ['Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins', 'Playfair Display', 'Merriweather', 'Source Code Pro', 'Space Grotesk'];

    this.container.innerHTML = `
      <div class="style-controls">
        <h3 class="control-section-title">Colors</h3>
        <div class="color-grid">
          ${this._colorInput('primaryColor', 'Primary')}
          ${this._colorInput('secondaryColor', 'Secondary')}
          ${this._colorInput('accentColor', 'Accent')}
          ${this._colorInput('backgroundColor', 'Background')}
          ${this._colorInput('textColor', 'Text')}
        </div>
        <h3 class="control-section-title">Typography</h3>
        <div class="font-controls">
          <div class="control-group">
            <label class="control-label">Headings</label>
            <select id="font-heading" class="select">
              ${fonts.map((f) => `<option value="${f}" ${f === this.values.fontHeading ? 'selected' : ''}>${f}</option>`).join('')}
            </select>
          </div>
          <div class="control-group">
            <label class="control-label">Body</label>
            <select id="font-body" class="select">
              ${fonts.map((f) => `<option value="${f}" ${f === this.values.fontBody ? 'selected' : ''}>${f}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>
    `;

    this._bindEvents();
  }

  _colorInput(key, label) {
    return `
      <div class="color-control">
        <input type="color" id="color-${key}" value="${this.values[key]}" />
        <label for="color-${key}">${label}</label>
      </div>
    `;
  }

  _bindEvents() {
    ['primaryColor', 'secondaryColor', 'accentColor', 'backgroundColor', 'textColor'].forEach((key) => {
      this.container.querySelector(`#color-${key}`).addEventListener('input', (e) => {
        this.values[key] = e.target.value;
        this._notify();
      });
    });

    this.container.querySelector('#font-heading').addEventListener('change', (e) => {
      this.values.fontHeading = e.target.value;
      this._notify();
    });

    this.container.querySelector('#font-body').addEventListener('change', (e) => {
      this.values.fontBody = e.target.value;
      this._notify();
    });
  }

  _notify() {
    if (this.onChange) this.onChange(this.values);
  }

  getValues() {
    return { ...this.values };
  }

  setValues(spec) {
    if (spec.primary_color) this.values.primaryColor = spec.primary_color;
    if (spec.secondary_color) this.values.secondaryColor = spec.secondary_color;
    if (spec.accent_color) this.values.accentColor = spec.accent_color;
    if (spec.background_color) this.values.backgroundColor = spec.background_color;
    if (spec.text_color) this.values.textColor = spec.text_color;
    if (spec.font_heading) this.values.fontHeading = spec.font_heading;
    if (spec.font_body) this.values.fontBody = spec.font_body;
    this.render();
  }
}
