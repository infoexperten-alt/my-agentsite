# Muxer Agent Routing Setup

> Дата: 2026-07-22

## Установка

Muxer plugin установлен из локального репозитория:

`ash
claude plugin marketplace add /tmp/muxer-repo
claude plugin install muxer@muxer-local
`

## Агенты

| Агент | Модель | Назначение |
|---|---|---|
| scouter | gpt-5.4-mini | Разведка (read-only) |
| writer | gpt-5.6-luna | Документация, бойлерплейт |
| codex | gpt-5.4-mini | OpenAI Codex dispatch |
| gemini | gpt-5.4-mini | Gemini dispatch |
| builder | gpt-5.6-sol | Имплементация |
| reviewer | claude-opus-4-8 | Code review |
| arbiter | claude-fable-5 | Быстрые top-tier решения |
| oracle | claude-fable-5 | Глубокий анализ |

## Прокси

Claude Code CLI → proxy.js (:3457) → router.cheap (:443/v1/chat/completions)

Прокси конвертирует Anthropic Messages API в OpenAI Chat Completions API.

## Файлы

- ops/proxy.js — прокси-сервер
- ops/muxer-agents/*.md — определения агентов Muxer
- gentsite/ — основное приложение
- gentsite/we-dev-next/ — Next.js проект @we-dev/next
