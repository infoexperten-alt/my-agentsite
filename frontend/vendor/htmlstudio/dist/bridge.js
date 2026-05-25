import { ID_ATTR, BLOCK_ATTR } from './types.js';
const DEFAULT_DISCOVERY = 'main,nav,section,article,header,footer,aside,div,h1,h2,h3,h4,h5,h6,p,a,button,img,span,strong,em,li,figure,figcaption,input,textarea,label';
/**
 * Returns a `<style>` + `<script>` pair to inject into the preview iframe.
 *
 * Events posted to parent (channel: `ve`):
 *   - ready      { count }
 *   - hover      ElementInfo | null
 *   - select     ElementInfo | null            — single click
 *   - select-multi ElementInfo[]               — shift-click accumulates a set
 *   - dblclick-text { id, value }
 *   - query-result { queryId, results: ElementInfo[] }
 *
 * Commands accepted from parent:
 *   - highlight  { id }                        — outline that element
 *   - clear                                    — clear all outlines + selection
 *   - query      { queryId, selector }         — find elements, reply with query-result
 */
export function buildBridgeScript(options = {}) {
    const opts = {
        targetOrigin: options.targetOrigin ?? '*',
        discoverySelector: options.discoverySelector ?? DEFAULT_DISCOVERY,
        outlines: options.outlines ?? true,
        channel: options.channel ?? 've',
    };
    return `
<style data-ve-bridge-style>
  [data-ve-hover] { outline: 1px dashed rgba(59,130,246,0.7) !important; outline-offset: 2px; }
  [data-ve-selected] { outline: 2px solid rgba(59,130,246,1) !important; outline-offset: 2px; }
  [data-ve-multi] { outline: 2px solid rgba(168,85,247,1) !important; outline-offset: 2px; }
  [data-ve-editing] { outline: 2px solid rgba(16,185,129,1) !important; outline-offset: 2px; cursor: text; }
</style>
<script data-ve-bridge>(function(){
  var OPTS = ${JSON.stringify(opts)};
  var ID_ATTR = ${JSON.stringify(ID_ATTR)};
  var BLOCK_ATTR = ${JSON.stringify(BLOCK_ATTR)};
  var post = function(type, payload){
    parent.postMessage({ channel: OPTS.channel, type: type, payload: payload }, OPTS.targetOrigin);
  };

  function isEligible(el){
    return el && el.matches && el.matches(OPTS.discoverySelector) && el.getAttribute && el.getAttribute(ID_ATTR);
  }
  function infoFor(el){
    if (!el) return null;
    var rect = el.getBoundingClientRect();
    var attrs = {};
    for (var i = 0; i < el.attributes.length; i++) {
      var a = el.attributes[i];
      attrs[a.name] = a.value;
    }
    var tag = el.tagName.toLowerCase();
    var kind = tag === 'a' ? 'link' : tag === 'img' ? 'image' : hasChildren(el) ? 'container' : 'text';
    var block = el.getAttribute(BLOCK_ATTR) || undefined;
    return {
      id: el.getAttribute(ID_ATTR),
      tag: tag,
      kind: kind,
      text: kind === 'text' ? (el.textContent || '').trim() : undefined,
      attributes: attrs,
      block: block,
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
    };
  }
  function hasChildren(el){
    for (var i = 0; i < el.children.length; i++) return true;
    return false;
  }
  function closestEligible(node){
    while (node && node.nodeType === 1) {
      if (isEligible(node)) return node;
      node = node.parentElement;
    }
    return null;
  }

  var hovered = null, selected = null, editing = null;
  var multiSet = [];  // array of elements when shift-click is active

  function clearMulti(){
    multiSet.forEach(function(el){ el.removeAttribute('data-ve-multi'); });
    multiSet = [];
  }

  document.addEventListener('mousemove', function(e){
    var el = closestEligible(e.target);
    if (el === hovered) return;
    if (hovered && OPTS.outlines) hovered.removeAttribute('data-ve-hover');
    hovered = el;
    if (hovered && OPTS.outlines && hovered !== selected && multiSet.indexOf(hovered) < 0) {
      hovered.setAttribute('data-ve-hover', '');
    }
    post('hover', infoFor(hovered));
  }, true);

  document.addEventListener('click', function(e){
    if (editing) return; // let inline editor consume
    var el = closestEligible(e.target);
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();

    if (e.shiftKey) {
      // Multi-select toggle
      if (selected && OPTS.outlines && multiSet.indexOf(selected) < 0) {
        // Promote the existing single selection into the multi set first
        selected.removeAttribute('data-ve-selected');
        multiSet.push(selected);
        if (OPTS.outlines) selected.setAttribute('data-ve-multi', '');
      }
      var idx = multiSet.indexOf(el);
      if (idx >= 0) {
        // Toggle off
        el.removeAttribute('data-ve-multi');
        multiSet.splice(idx, 1);
      } else {
        if (OPTS.outlines) el.setAttribute('data-ve-multi', '');
        multiSet.push(el);
      }
      selected = null;
      post('select-multi', multiSet.map(infoFor));
      return;
    }

    // Plain click resets multi-select
    clearMulti();
    if (selected && OPTS.outlines) selected.removeAttribute('data-ve-selected');
    selected = el;
    if (OPTS.outlines) selected.setAttribute('data-ve-selected', '');
    post('select', infoFor(selected));
  }, true);

  document.addEventListener('dblclick', function(e){
    var el = closestEligible(e.target);
    if (!el) return;
    if (hasChildren(el)) return;
    e.preventDefault();
    e.stopPropagation();
    editing = el;
    el.setAttribute('data-ve-editing', '');
    el.setAttribute('contenteditable', 'plaintext-only');
    el.focus();
    var stop = function(){
      el.removeAttribute('contenteditable');
      el.removeAttribute('data-ve-editing');
      post('dblclick-text', { id: el.getAttribute(ID_ATTR), value: (el.textContent || '') });
      editing = null;
      el.removeEventListener('blur', stop);
    };
    el.addEventListener('blur', stop);
  }, true);

  // Escape clears selection
  document.addEventListener('keydown', function(e){
    if (e.key !== 'Escape') return;
    if (selected) selected.removeAttribute('data-ve-selected');
    clearMulti();
    selected = null;
    post('select', null);
  });

  // Host → iframe commands
  window.addEventListener('message', function(e){
    var msg = e.data;
    if (!msg || msg.channel !== OPTS.channel) return;
    if (msg.type === 'highlight') {
      var target = document.querySelector('[' + ID_ATTR + '="' + ((msg.payload && msg.payload.id) || '') + '"]');
      if (selected) selected.removeAttribute('data-ve-selected');
      selected = target;
      if (selected) selected.setAttribute('data-ve-selected', '');
    } else if (msg.type === 'clear') {
      if (selected) selected.removeAttribute('data-ve-selected');
      if (hovered) hovered.removeAttribute('data-ve-hover');
      clearMulti();
      selected = null; hovered = null;
    } else if (msg.type === 'query') {
      // Run a CSS selector inside the iframe; return ElementInfo[] for any
      // matches that carry a data-ve-id.
      var selector = (msg.payload && msg.payload.selector) || '';
      var queryId = (msg.payload && msg.payload.queryId) || '';
      var results = [];
      try {
        var matches = document.querySelectorAll(selector);
        for (var i = 0; i < matches.length; i++) {
          if (matches[i].getAttribute && matches[i].getAttribute(ID_ATTR)) {
            results.push(infoFor(matches[i]));
          }
        }
      } catch (err) {
        post('query-result', { queryId: queryId, error: String(err && err.message || err), results: [] });
        return;
      }
      post('query-result', { queryId: queryId, results: results });
    }
  });

  var count = document.querySelectorAll('[' + ID_ATTR + ']').length;
  post('ready', { count: count });
})();</script>`;
}
/**
 * Inject the bridge into a full HTML document string (before </body>).
 * Safe to call on already-bridged HTML — replaces the existing bridge tag.
 */
export function injectBridge(html, options = {}) {
    const script = buildBridgeScript(options);
    const stripped = html
        .replace(/<style data-ve-bridge-style>[\s\S]*?<\/style>/g, '')
        .replace(/<script data-ve-bridge>[\s\S]*?<\/script>/g, '');
    if (/<\/body>/i.test(stripped)) {
        return stripped.replace(/<\/body>/i, `${script}\n</body>`);
    }
    return stripped + script;
}
//# sourceMappingURL=bridge.js.map