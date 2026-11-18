# Getting access in Codex's sandbox

Read this only when running in Codex's sandbox (the Codex CLI, the IDE extension, or Codex in the ChatGPT
desktop app); `SKILL.md` beside this file sends you here.

When running in Codex's sandbox, run every Kombai command outside it **from the first try**: use
`sandbox_permissions: "require_escalated"` on the execution tool call for the first command and every later Kombai
CLI command, and do not try the restricted command first. The commands need network access and write `~/.kombai`,
npm's cache and, for `mcp install codex`, Codex's config folder; `npx` may contact the package registry before
Kombai starts. Retry only a confirmed sandbox denial before any write was sent; for an unknown write outcome, inspect
state first. If this chat is in ChatGPT's Chat or Work, run nothing and reply only that Kombai's plugin works only
in Codex, not in ChatGPT's Chat or Work, and to switch to Codex and ask there. Otherwise, if this chat can't run a command outside the sandbox, or the user declines, run nothing and do not retry
inside the sandbox. Reply with only this, word for word:

> Kombai needs to run outside Codex's sandbox to design, and this Codex session blocks it. Fix it one of these ways, then send your message again:
> - In the Codex app: approve Kombai when Codex asks (if the chat never asks, pick a project for it), or pick **Full access** in the permissions menu under the message box.
> - In Codex in a terminal: start it with `codex --sandbox danger-full-access`, or run your request with `codex exec -s danger-full-access "<your request>"`.
>
> Kombai doesn't run in ChatGPT's Chat or Work tabs.
