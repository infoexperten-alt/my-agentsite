const http = require('http');
const https = require('https');

const PROXY_PORT = 3457;
const UPSTREAM_HOST = 'router.cheap';
const UPSTREAM_PATH = '/v1/chat/completions';
const API_KEY = 'sk-VFyv8sShImtIJEvqJCU0hyDPFyRJQawYSwypy4ZngvQpbTUo';

function tokenStr(len = 12) {
  const c = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: len }, () => c[Math.floor(Math.random() * c.length)]).join('');
}

function anthropicToOpenAI(abody) {
  const messages = [];

  if (abody.system) {
    const sys = typeof abody.system === 'string' ? abody.system : (abody.system.text || '');
    if (sys) messages.push({ role: 'system', content: sys });
  }

  for (const msg of (abody.messages || [])) {
    if (msg.role === 'system') {
      messages.push({ role: 'system', content: typeof msg.content === 'string' ? msg.content : msg.content.map(c => c.text).join('\n') });
      continue;
    }
    if (msg.role === 'user' && Array.isArray(msg.content)) {
      const textParts = msg.content.filter(c => c.type === 'text').map(c => c.text);
      const toolResults = msg.content.filter(c => c.type === 'tool_result');
      if (toolResults.length > 0) {
        for (const tr of toolResults) {
          const tc = typeof tr.content === 'string' ? tr.content : (Array.isArray(tr.content) ? tr.content.map(c => c.text || '').join('\n') : '');
          messages.push({ role: 'tool', tool_call_id: tr.tool_use_id || `call_${tokenStr()}`, content: tc });
        }
      }
      if (textParts.length > 0) {
        messages.push({ role: 'user', content: textParts.join('\n') });
      }
      if (textParts.length === 0 && toolResults.length === 0) {
        messages.push({ role: 'user', content: '' });
      }
      continue;
    }
    if (msg.role === 'assistant' && Array.isArray(msg.content)) {
      const textParts = msg.content.filter(c => c.type === 'text').map(c => c.text);
      const toolUses = msg.content.filter(c => c.type === 'tool_use');
      const content = textParts.join('\n');
      if (toolUses.length > 0) {
        messages.push({
          role: 'assistant',
          content: content || null,
          tool_calls: toolUses.map(tu => ({
            id: tu.id || `call_${tokenStr()}`,
            type: 'function',
            function: { name: tu.name, arguments: JSON.stringify(tu.input || {}) }
          }))
        });
      } else {
        messages.push({ role: 'assistant', content: content || '' });
      }
      continue;
    }
    messages.push(msg);
  }

  const oreq = {
    model: abody.model || 'gpt-5.6-sol',
    messages,
    max_tokens: Math.min(Number(abody.max_tokens) || 8192, 8192),
    stream: abody.stream === true,
    temperature: abody.temperature,
    top_p: abody.top_p,
  };
  if (abody.stop_sequences) oreq.stop = abody.stop_sequences;
  if (abody.tools && abody.tools.length > 0) {
    oreq.tools = abody.tools.map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description || '',
        parameters: t.input_schema || {}
      }
    }));
    if (abody.tool_choice) {
      if (abody.tool_choice.type === 'any') oreq.tool_choice = 'required';
      else if (abody.tool_choice.type === 'auto') oreq.tool_choice = 'auto';
      else if (abody.tool_choice.type === 'tool') oreq.tool_choice = { type: 'function', function: { name: abody.tool_choice.name } };
    }
  }

  return oreq;
}

function openaiToAnthropic(ores, reqModel) {
  const choice = ores.choices && ores.choices[0];
  if (!choice) return { id: `msg_${tokenStr()}`, type: 'message', role: 'assistant', content: [{ type: 'text', text: '' }], model: reqModel || '', stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 0, output_tokens: 0 } };

  const content = [];
  const msg = choice.message || {};

  if (msg.content) {
    content.push({ type: 'text', text: msg.content });
  }

  let stopReason = 'end_turn';
  if (choice.finish_reason === 'tool_calls') stopReason = 'tool_use';
  else if (choice.finish_reason === 'length') stopReason = 'max_tokens';
  else if (choice.finish_reason === 'stop') stopReason = 'end_turn';

  if (msg.tool_calls) {
    for (const tc of msg.tool_calls) {
      try {
        content.push({
          type: 'tool_use',
          id: tc.id || `toolu_${tokenStr()}`,
          name: tc.function?.name || '',
          input: JSON.parse(tc.function?.arguments || '{}')
        });
      } catch { }
    }
  }

  return {
    id: ores.id || `msg_${tokenStr()}`,
    type: 'message',
    role: 'assistant',
    content,
    model: ores.model || reqModel || '',
    stop_reason: stopReason,
    stop_sequence: null,
    usage: {
      input_tokens: ores.usage?.prompt_tokens || 0,
      output_tokens: ores.usage?.completion_tokens || 0
    }
  };
}

function handleStreaming(oResStream, anthropicRes, reqModel) {
  let buffer = '';
  let messageId = `msg_${tokenStr()}`;
  let hasStarted = false;
  let contentIndex = 0;
  let contentText = '';
  let finishReason = null;
  let usageOut = 0;
  let pendingToolCalls = {};

  function sendAnthropicEvent(event, data) {
    anthropicRes.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  oResStream.on('data', (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]' || !trimmed.startsWith('data: ')) continue;

      try {
        const parsed = JSON.parse(trimmed.slice(6));

        if (!hasStarted) {
          hasStarted = true;
          sendAnthropicEvent('message_start', {
            type: 'message_start',
            message: {
              id: messageId,
              type: 'message',
              role: 'assistant',
              content: [],
              model: reqModel || parsed.model || '',
              stop_reason: null,
              stop_sequence: null,
              usage: { input_tokens: parsed.usage?.prompt_tokens || 0, output_tokens: 0 }
            }
          });

          const deltaChoices = parsed.choices && parsed.choices[0]?.delta;
          if (deltaChoices) {
            if (deltaChoices.role) {
              contentIndex = 0;
            }
            if (deltaChoices.content) {
              sendAnthropicEvent('content_block_start', {
                type: 'content_block_start',
                index: contentIndex,
                content_block: { type: 'text', text: '' }
              });
              contentText = deltaChoices.content;
              sendAnthropicEvent('content_block_delta', {
                type: 'content_block_delta',
                index: contentIndex,
                delta: { type: 'text_delta', text: contentText }
              });
            }
            if (deltaChoices.tool_calls) {
              for (const tc of deltaChoices.tool_calls) {
                const idx = tc.index;
                pendingToolCalls[idx] = pendingToolCalls[idx] || { id: tc.id || `toolu_${tokenStr()}`, name: '', arguments: '' };
                if (tc.id) pendingToolCalls[idx].id = tc.id;
                if (tc.function?.name) pendingToolCalls[idx].name = tc.function.name;
                if (tc.function?.arguments) pendingToolCalls[idx].arguments += tc.function.arguments;
              }
            }
          }
          if (parsed.choices && parsed.choices[0]?.finish_reason) {
            finishReason = parsed.choices[0].finish_reason;
          }
          continue;
        }

        const delta = parsed.choices && parsed.choices[0]?.delta;
        const finish = parsed.choices && parsed.choices[0]?.finish_reason;

        if (delta) {
          if (delta.content) {
            if (!contentText) {
              sendAnthropicEvent('content_block_start', {
                type: 'content_block_start',
                index: contentIndex,
                content_block: { type: 'text', text: '' }
              });
            }
            contentText += delta.content;
            sendAnthropicEvent('content_block_delta', {
              type: 'content_block_delta',
              index: contentIndex,
              delta: { type: 'text_delta', text: delta.content }
            });
          }
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index;
              pendingToolCalls[idx] = pendingToolCalls[idx] || { id: tc.id || `toolu_${tokenStr()}`, name: '', arguments: '' };
              if (tc.id) pendingToolCalls[idx].id = tc.id;
              if (tc.function?.name) pendingToolCalls[idx].name = tc.function.name;
              if (tc.function?.arguments) pendingToolCalls[idx].arguments += tc.function.arguments;
            }
          }
        }
        if (finish) {
          finishReason = finish;
        }
        if (parsed.usage?.completion_tokens) {
          usageOut = parsed.usage.completion_tokens;
        }
      } catch { }
    }
  });

  oResStream.on('end', () => {
    if (contentText) {
      sendAnthropicEvent('content_block_stop', { type: 'content_block_stop', index: contentIndex });
      contentIndex++;
    }

    const toolUseIds = Object.keys(pendingToolCalls);
    if (toolUseIds.length > 0) {
      for (const idx of toolUseIds.sort()) {
        const tc = pendingToolCalls[idx];
        if (tc.name) {
          sendAnthropicEvent('content_block_start', {
            type: 'content_block_start',
            index: contentIndex,
            content_block: {
              type: 'tool_use',
              id: tc.id,
              name: tc.name,
              input: {}
            }
          });
          let parsedInput = {};
          try { parsedInput = JSON.parse(tc.arguments); } catch { parsedInput = {}; }
          sendAnthropicEvent('content_block_delta', {
            type: 'content_block_delta',
            index: contentIndex,
            delta: { type: 'input_json_delta', partial_json: JSON.stringify(parsedInput) }
          });
          sendAnthropicEvent('content_block_stop', { type: 'content_block_stop', index: contentIndex });
          contentIndex++;
        }
      }
    }

    let sr = 'end_turn';
    if (finishReason === 'tool_calls') sr = 'tool_use';
    else if (finishReason === 'length') sr = 'max_tokens';
    else if (finishReason === 'stop') sr = 'end_turn';

    sendAnthropicEvent('message_delta', {
      type: 'message_delta',
      delta: { stop_reason: sr, stop_sequence: null },
      usage: { output_tokens: usageOut || 0 }
    });
    sendAnthropicEvent('message_stop', { type: 'message_stop' });
    anthropicRes.end();
  });

  oResStream.on('error', (err) => {
    anthropicRes.end();
  });
}

const MODELS = [
  { id: 'gpt-5.4-mini', object: 'model', created: 1710000000, owned_by: 'router-cheap' },
  { id: 'gpt-5.6-luna', object: 'model', created: 1710000001, owned_by: 'router-cheap' },
  { id: 'grok-4.5', object: 'model', created: 1710000002, owned_by: 'router-cheap' },
  { id: 'gpt-5.6-sol', object: 'model', created: 1710000003, owned_by: 'router-cheap' },
  { id: 'claude-opus-4-8', object: 'model', created: 1710000004, owned_by: 'router-cheap' },
  { id: 'claude-fable-5', object: 'model', created: 1710000005, owned_by: 'router-cheap' },
];

function logReq(method, url, extra) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${method} ${url}${extra ? ' ' + extra : ''}`);
}

function proxyRequest(anthropicReq, anthropicRes) {
  const pathname = (anthropicReq.url || '').split('?')[0];
  logReq(anthropicReq.method, anthropicReq.url);

  // health check
  if ((anthropicReq.method === 'GET' || anthropicReq.method === 'HEAD') && (pathname === '/' || pathname === '/health')) {
    anthropicRes.writeHead(200, { 'Content-Type': 'application/json' });
    anthropicRes.end(JSON.stringify({ status: 'ok', proxy: 'anthropic-to-openai' }));
    return;
  }

  // auth check — Claude Code CLI calls GET /me to verify credentials
  if (anthropicReq.method === 'GET' && pathname === '/me') {
    anthropicRes.writeHead(200, { 'Content-Type': 'application/json' });
    anthropicRes.end(JSON.stringify({
      id: 'proxy-user',
      email: 'proxy@router.cheap',
      name: 'Proxy User',
      api_key: { type: 'proxy', last_four: '****' },
      organization_id: 'proxy-org'
    }));
    return;
  }

  // model listing
  if (anthropicReq.method === 'GET' && pathname === '/v1/models') {
    anthropicRes.writeHead(200, { 'Content-Type': 'application/json' });
    anthropicRes.end(JSON.stringify({ data: MODELS }));
    return;
  }

  // only POST /v1/messages is proxied
  if (anthropicReq.method !== 'POST' || pathname !== '/v1/messages') {
    anthropicRes.writeHead(404, { 'Content-Type': 'application/json' });
    anthropicRes.end(JSON.stringify({ error: { message: 'Not Found', url: anthropicReq.url, path: pathname, method: anthropicReq.method } }));
    return;
  }

  let body = '';
  anthropicReq.on('data', (chunk) => body += chunk);
  anthropicReq.on('end', () => {
    let abody;
    try { abody = JSON.parse(body); } catch {
      logReq('POST', '/v1/messages', `INVALID JSON: ${body.substring(0, 200)}`);
      anthropicRes.writeHead(400, { 'Content-Type': 'application/json' });
      anthropicRes.end(JSON.stringify({ error: { message: 'Invalid JSON' } }));
      return;
    }

    logReq('POST', '/v1/messages', `model=${abody.model} stream=${abody.stream} tools=${(abody.tools || []).length}`);

    const oreq = anthropicToOpenAI(abody);

    const postData = JSON.stringify(oreq);

    const opts = {
      hostname: UPSTREAM_HOST,
      port: 443,
      path: UPSTREAM_PATH,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Length': Buffer.byteLength(postData),
      }
    };

    const oReq = https.request(opts, (oRes) => {
      if (abody.stream) {
        anthropicRes.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        });
        handleStreaming(oRes, anthropicRes, abody.model);
      } else {
        let data = '';
        oRes.on('data', (chunk) => data += chunk);
        oRes.on('end', () => {
          try {
            const ojson = JSON.parse(data);
            const ajson = openaiToAnthropic(ojson, abody.model);
            anthropicRes.writeHead(200, { 'Content-Type': 'application/json' });
            anthropicRes.end(JSON.stringify(ajson));
          } catch {
            anthropicRes.writeHead(502, { 'Content-Type': 'application/json' });
            anthropicRes.end(JSON.stringify({ error: { message: 'Upstream response parse error', details: data.substring(0, 500) } }));
          }
        });
      }
    });

    oReq.on('error', (err) => {
      anthropicRes.writeHead(502, { 'Content-Type': 'application/json' });
      anthropicRes.end(JSON.stringify({ error: { message: `Upstream error: ${err.message}` } }));
    });

    oReq.write(postData);
    oReq.end();
  });
}

const server = http.createServer(proxyRequest);
server.listen(PROXY_PORT, '127.0.0.1', () => {
  console.log(`proxy ready on http://127.0.0.1:${PROXY_PORT}`);
});
