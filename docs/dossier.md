# Досье: Hermes Agent + ClawRouter

> Сервер: **64.188.115.45** (root / Appella1)  
> OS: Ubuntu 22.04.5 LTS · Python 3.11 · Node 24.18  
> Дата аудита: 2026-07-20

---

## 1. Архитектура

```
Браузер (https://64.188.115.45:9090)
    │
    ▼
Nginx (:9090 SSL → :9119)
    │
    ▼
Hermes Dashboard (hermes dashboard --port 9119)
    │  ├── / ............ SPA (web_dist/)
    │  ├── /api/pty ..... PTY WebSocket → hermes chat
    │  ├── /api/auth .... WS ticket, /me, etc
    │  └── /api/plugins . hermes-achievements, kanban
    │
    ▼
Hermes Agent (hermes chat в PTY)
    │  provider: openrouter
    │  model: free/deepseek-v4-flash
    │
    ▼
OpenClaw Gateway (:18789)  ← systemd openclaw.service
    │  plugin: clawrouter (x402-proxy :8402)
    │
    ▼
x402 Proxy (:8402)  ← OpenAI-compatible endpoint
    │  key: x402-proxy-handles-auth
    │  routing: auto / eco / free tier
    │
    ▼
blockrun → бесплатные модели
    ├── free/deepseek-v4-flash
    ├── free/mistral-large-3-675b
    ├── free/seed-oss-36b
    ├── free/nemotron-3-nano-omni-30b-a3b-reasoning
    ├── free/gpt-oss-120b
    └── ... (всего ~80 free моделей)
```

---

## 2. Конфигурация

### 2.1 Hermes (`/root/.hermes/config.yaml`)
```yaml
model:
  default: free/deepseek-v4-flash
  provider: openrouter
dashboard:
  enabled: true
reasoning: true
_config_version: 33
```

### 2.2 Hermes Env (`/root/.hermes/.env`)
```bash
OPENROUTER_BASE_URL=http://127.0.0.1:8402/v1
OPENROUTER_API_KEY=x402-proxy-handles-auth
```

### 2.3 OpenClaw (`/root/.openclaw/openclaw.json`)
```json
{
  "models": {
    "mode": "merge",
    "providers": {
      "blockrun": {
        "apiKey": "x402-proxy-handles-auth"
      }
    }
  },
  "agents": {
    "defaults": {
      "workspace": "/root/.openclaw/workspace",
      "model": {
        "primary": "blockrun/free/deepseek-v4-flash",
        "fallbacks": [
          "blockrun/free/mistral-large-3-675b",
          "blockrun/free/seed-oss-36b",
          "blockrun/free/nemotron-3-nano-omni-30b-a3b-reasoning",
          "blockrun/free/step-3.7-flash"
        ]
      }
    }
  }
}
```

### 2.4 Nginx — Hermes Dashboard (`/etc/nginx/sites-enabled/hermes-dashboard`)
```nginx
server {
    listen 9090 ssl;
    ssl_certificate     /etc/nginx/ssl/openclaw.crt;
    ssl_certificate_key /etc/nginx/ssl/openclaw.key;

    location / {
        proxy_pass http://127.0.0.1:9119;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400s;   # ← КРИТИЧНО для WebSocket
        proxy_send_timeout 86400s;
    }
}
```

### 2.5 OpenClaw systemd (`/etc/systemd/system/openclaw.service`)
```
ExecStart=/usr/bin/node /usr/lib/node_modules/openclaw/dist/index.js gateway --port 18789 --allow-unconfigured
```

---

## 3. Сервисы

| Сервис | Порт | Управление | Статус |
|---|---|---|---|
| OpenClaw Gateway | 18789 | `systemctl [start/stop] openclaw` | active |
| x402-proxy (встроен в OpenClaw) | 8402 | часть gateway | up |
| Hermes Dashboard | 9119 → 9090 | `pkill hermes; hermes dashboard ...` | ручной запуск |
| Nginx | 443, 9090, 8444 | `systemctl reload nginx` | active |
| Code-server | 8443 → 8444 | `systemctl [start/stop] code-server@root` | active |

### Запуск Hermes Dashboard
```bash
nohup hermes dashboard --host 127.0.0.1 --port 9119 --no-open --skip-build \
  > /tmp/hermes-dashboard.log 2>&1 &
```

---

## 4. Патчи (web_server.py)

Файл: `/usr/local/lib/python3.11/dist-packages/hermes_cli/web_server.py`

### 4.1 Dashboard Embedded Chat
```python
# line 279
_DASHBOARD_EMBEDDED_CHAT_ENABLED = True
```

### 4.2 Auth bypass
```python
# should_require_auth() → return False
# _ws_auth_reason → принимает ticket/token/anonymous
# _ws_request_is_allowed → return True
# _ws_host_origin_reason → return None
# _ws_client_reason → пропускает
```

### 4.3 PTY fallback (line 14143–14155)
```python
try:
    from hermes_cli.main import _make_tui_argv
    argv, cwd = _make_tui_argv(PROJECT_ROOT / "ui-tui", tui_dev=False)
except SystemExit:
    _log.warning("TUI workspace missing -- falling back to hermes chat CLI")
    argv = [sys.executable, "-m", "hermes_cli.main", "chat"]
    cwd = str(PROJECT_ROOT)
```

### 4.4 Dashboard auth routes
Файл: `/usr/local/lib/python3.11/dist-packages/hermes_cli/dashboard_auth/routes.py`
- `/api/auth/me` → `{"user_id": "anonymous"}`
- `/api/auth/ws-ticket` → монтирует ticket для anonymous

---

## 5. Ключевые файлы

| Файл | Назначение |
|---|---|
| `/root/.hermes/config.yaml` | Конфиг Hermes (модель, провайдер) |
| `/root/.hermes/.env` | OpenRouter endpoint + API key |
| `/root/.hermes/logs/gui.log` | Логи всех hermes процессов |
| `/tmp/hermes-dashboard.log` | Логи dashboard |
| `/root/.openclaw/openclaw.json` | Конфиг OpenClaw (модели, агенты) |
| `/etc/nginx/sites-enabled/hermes-dashboard` | Nginx прокси :9090 → :9119 |
| `/etc/nginx/sites-enabled/openclaw-dashboard` | Nginx прокси :8081 → :18789 |
| `/etc/nginx/sites-enabled/code-server.conf` | Nginx прокси :8444 → :8443 |
| `/etc/nginx/ssl/openclaw.crt` | Самоподписанный SSL |
| `/etc/systemd/system/openclaw.service` | systemd unit для OpenClaw |
| `/usr/local/lib/python3.11/dist-packages/hermes_cli/web_server.py` | Патченный сервер |

---

## 6. Проблемы и решения

### Исправлено
| # | Симптом | Причина | Решение |
|---|---|---|---|
| 1 | PTY WebSocket дроп каждые 60с | Nginx `proxy_read_timeout` по умолчанию 60с | Добавлен `proxy_read_timeout 86400s` |
| 2 | Streaming error `tencent/hy3:free` | Модель не поддерживается ClawRouter | Сменена на `free/deepseek-v4-flash` |
| 3 | Сиротские hermes chat процессы | Каждый дроп spawn-ил новый процесс | Дропы исчезли, старые убиты |
| 4 | Диск 92% | Логи, /tmp, кеш | Очищено до 91% (7.4GB free) |

### Известные нюансы
| # | Симптом | Причина | Влияние |
|---|---|---|---|
| 1 | Plugin reload каждые 6с | Frontend polling плагинов | Только косметика в логах |
| 2 | "TUI workspace missing" | ui-tui/ отстутсвует в pip установке | Косметика, fallback работает |
| 3 | Медленный ответ агента | reasoning: true + free tier | Можно отключить reasoning |
| 4 | Диск 91% | /root/.openclaw/plugin-skills (1.8GB) | Стоит расширить диск |

---

## 7. Дежурные команды

```bash
# Перезапуск Hermes dashboard
pkill -9 -f hermes; sleep 2
nohup hermes dashboard --host 127.0.0.1 --port 9119 --no-open --skip-build > /tmp/hermes-dashboard.log 2>&1 &

# Перезапуск OpenClaw
systemctl restart openclaw

# Проверка x402 proxy
curl -s http://127.0.0.1:8402/v1/models -H "Authorization: Bearer x402-proxy-handles-auth" | head -c 200

# Тест chat completions
curl -s http://127.0.0.1:8402/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer x402-proxy-handles-auth" \
  -d '{"model":"free/deepseek-v4-flash","messages":[{"role":"user","content":"hi"}],"max_tokens":10}'

# Проверка процессов
ps aux | grep hermes | grep -v grep
ps aux | grep openclaw | grep -v grep

# Свободное место
df -h /

# Логи
tail -f /root/.hermes/logs/gui.log
tail -f /tmp/hermes-dashboard.log

# Проверка PTY сессий
grep 'pty ' /root/.hermes/logs/gui.log | tail -10

# Мониторинг памяти
free -h; ps -o pid,rss,%mem,cmd -p $(pgrep -f hermes) 2>/dev/null
```

---

## 8. Совместимость с AI-инструментами

| Инструмент | API формат | ClawRouter | Статус |
|---|---|---|---|
| Hermes Agent | Chat Completions | ✅ | Работает |
| OpenClaw Agents | Chat Completions | ✅ | Работает |
| Continue (VS Code) | Chat Completions | ✅ | Настроен |
| Aider | Chat Completions | ✅ | Совместим |
| Codex CLI/Desktop | Responses API | ❌ | Несовместим |
| Claude Code | Anthropic Messages | ❌ | Несовместим |

---

## 9. Доступ

| URL | Сервис | Пароль |
|---|---|---|
| `https://64.188.115.45:9090` | Hermes Dashboard | — |
| `https://64.188.115.45:8081` | OpenClaw Dashboard | — |
| `https://64.188.115.45:8444` | Code-server (VS Code) | `hermes2026` |

---

*Досье создано 2026-07-20. Обновлять при изменениях конфигурации.*
