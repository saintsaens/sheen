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

## Keyboard

The composer has focus when a ticket opens, so agents can start typing right away. Esc leaves it for reading mode, where single-key shortcuts work. Critical actions, like submitting, use ⌘ / Ctrl shortcuts that work in both modes.

Single-key shortcuts can be turned off, because they conflict with screen reader keys (WCAG 2.1.4).

## v0.1

A single ticket in three columns: the conversation (public replies, internal notes, attachments), an answer composer, and the ticket's properties.

The composer has public reply or internal note, "Submit as" a status, and ⌘Enter / Ctrl+Enter to submit. It doesn't send to Zendesk yet.

For now the backend uses one Zendesk API token from `.env` instead of per-agent sign-in.
