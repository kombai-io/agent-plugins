---
name: get-started-with-kombai
description: Set up Kombai for first use in Qwen Code, check sign-in, and show design prompts to try. Use when the user asks to get started with Kombai or check its setup. Do not use for a design request; use work-with-kombai for that.
---

This Qwen Code extension already supplies Kombai's skills. It has no MCP server or canvas view to install; the Kombai canvas opens in the browser. Do not run a host-specific MCP install command.

Run Kombai's CLI (`kombai` below) from `node "$HOME/.kombai/cli/install/latest/launch.mjs"` if that file exists; if not, fall back to `npx -y @kombai/cli@0.3.1`.

Run `kombai whoami` to check whether the user is signed in. If not, run `kombai skill sign-in` and follow its instructions. The user completes sign-in in their own browser and checks the match code. Do not sign in or sign up on their behalf unless they explicitly ask.

Then tell the user Kombai is ready and suggest these requests, without starting a design task for them:

- Use Kombai to design a standout UI for my website.
- Use Kombai to explore design directions on canvas.
- Use Kombai to redesign this section of my app.

If `npx` or `node` is missing, tell the user Kombai needs Node.js 20 or later. If the shell blocks network access, ask the user to enable it for Qwen Code; do not treat that as a missing Node install.
