/**
 * Chat/prompt input panel with image upload support.
 */
export class ChatPanel {
  constructor(container, { onSubmit, onImageUpload }) {
    this.container = container;
    this.onSubmit = onSubmit;
    this.onImageUpload = onImageUpload;
    this.messages = [];
    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div class="chat-panel">
        <div class="chat-messages" id="chat-messages"></div>
        <div class="chat-input-area">
          <div class="chat-input-row">
            <textarea
              id="chat-input"
              placeholder="Describe the website you want to build..."
              rows="3"
            ></textarea>
            <div class="chat-actions">
              <label class="upload-btn" title="Upload reference image">
                <input type="file" id="image-upload" accept="image/*" hidden />
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
              </label>
              <button id="chat-submit" class="btn-primary" title="Generate website">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="22" y1="2" x2="11" y2="13"/>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </button>
            </div>
          </div>
          <div id="upload-preview" class="upload-preview" hidden></div>
        </div>
      </div>
    `;

    this._bindEvents();
  }

  _bindEvents() {
    const input = this.container.querySelector('#chat-input');
    const submit = this.container.querySelector('#chat-submit');
    const upload = this.container.querySelector('#image-upload');

    submit.addEventListener('click', () => this._handleSubmit());
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this._handleSubmit();
      }
    });

    upload.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file && this.onImageUpload) {
        this.onImageUpload(file);
        this._showUploadPreview(file);
      }
    });
  }

  _handleSubmit() {
    const input = this.container.querySelector('#chat-input');
    const prompt = input.value.trim();
    if (!prompt) return;

    this.addMessage('user', prompt);
    input.value = '';
    if (this.onSubmit) this.onSubmit(prompt);
  }

  _showUploadPreview(file) {
    const preview = this.container.querySelector('#upload-preview');
    const url = URL.createObjectURL(file);
    preview.innerHTML = `
      <img src="${url}" alt="Reference" />
      <span>${file.name}</span>
      <button class="btn-ghost" onclick="this.parentElement.hidden=true">x</button>
    `;
    preview.hidden = false;
  }

  addMessage(role, content) {
    this.messages.push({ role, content });
    const messagesDiv = this.container.querySelector('#chat-messages');

    const msg = document.createElement('div');
    msg.className = `chat-message chat-message--${role}`;
    msg.textContent = content;
    messagesDiv.appendChild(msg);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  setLoading(loading) {
    const submit = this.container.querySelector('#chat-submit');
    const input = this.container.querySelector('#chat-input');
    submit.disabled = loading;
    input.disabled = loading;
    if (loading) {
      submit.classList.add('loading');
    } else {
      submit.classList.remove('loading');
    }
  }
}
