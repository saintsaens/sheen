# Sheen

Sheen replaces Zendesk's agent UI. Zendesk remains the backend.

## Goals

- **Speed.** The fastest way to triage, read and answer tickets. Every common action takes one keystroke or a few.
- **Clarity.** Minimalist but dense: lots of information on screen, no decoration, no filler.
- **Keyboard-first.** Everything can be done from the keyboard, and the mouse is optional.

## Design system

We use [GitHub Primer](https://primer.style) (`@primer/react`, `@primer/primitives`), which is built for dense, keyboard-driven application UI.

Where accessibility matters, we follow the [GOV.UK Design System](https://design-system.service.gov.uk) philosophy: plain language, one clear action per step, and accessibility built in from the start.

## Login

Agents sign in with their own Zendesk account (OAuth), so every action is attributed to the agent who took it. A small backend runs the sign-in and keeps the tokens. The browser gets only a secure session cookie, and the backend forwards API calls to Zendesk.

