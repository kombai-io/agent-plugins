---
name: faq-with-kombai
description: Answer questions about the Kombai CLI and the Kombai canvas: what it does, setup, sign-in, credits, where designs live, thumbnails and the canvas view. Use when the user asks how Kombai works or why something is not working, not to design UI.
---

Answer from this file. Keep answers short and say what the user should do next. If a question is not covered here, run `npx -y @kombai/cli@latest skill` and answer from what it prints, or say you do not know.

## What is Kombai?

Kombai is an AI design engineer. The CLI (`@kombai/cli`) lets this agent get design directions grounded in the user's repo, write each design as HTML on a hosted Kombai canvas, and check its thumbnail. The user reviews the designs on the canvas in their browser.

## What do I need before I start?

- Node.js 20 or later.
- A Kombai account.
- The CLI installs from npm as `@kombai/cli`. If `npx` cannot fetch it, check the network and that `npm config get registry` shows https://registry.npmjs.org/; do not retry in a loop.
- For thumbnails, a Chromium browser (Chrome, Edge, Brave, Arc or Chromium).

## How do I sign in?

Run `npx -y @kombai/cli@latest login`. It prints a match code and opens a Kombai page in the browser. The user should approve only if the code on that page matches the code in the terminal. Check who is signed in with `whoami`, and sign out with `logout`.

## How do I check my credits?

Run `npx -y @kombai/cli@latest credits`. It shows the remaining credits, the plan and when they refill. On a team plan, the numbers are the organization's shared pool.

## Where are my designs?

On a hosted Kombai canvas. Canvases are listed with `canvas list`, opened in the browser with `canvas open`, and shared with `canvas share`. The link is also available with `canvas url`.

## What is a design direction?

Each design task starts with a taste run: `taste start` begins it and `taste wait` collects the result. The direction is grounded in the brief and the product, and it follows the choices the user has already made.

## Why do thumbnails fail?

Thumbnails need a Chromium browser. If none is installed, `npx -y @kombai/cli@latest browser install` downloads a headless Chromium (about 100 MB) after asking. On ARM Linux, that download is not available: the user installs their distribution's `chromium` and points the CLI at it with `config browser <path>`.

## Can I see the canvas beside the chat?

Only where the host supports MCP App views. Codex desktop shows the canvas beside the chat, and Claude desktop's Code tab shows the taste card there. Codex in a terminal and Claude Code in a terminal show no view, so the skill opens the canvas in the user's browser instead. The view appears only in a session that started with the plugin's MCP server registered.

## How do I stop or remove the CLI?

Nothing is installed. The agent runs the CLI through `npx`, so there is nothing to uninstall. To sign out, run `logout`. To remove the plugin, use the host's own plugin settings.
