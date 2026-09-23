// Keyboard model (see SPEC.md): single-key shortcuts work in reading mode, i.e. when focus isn't in a text
// field, and can be turned off. Mod shortcuts (⌘ on macOS, Ctrl elsewhere) work everywhere.

import { useEffect, useRef, useSyncExternalStore } from 'react'

const STORAGE_KEY = 'sheen.singleKeyShortcuts'
const listeners = new Set<() => void>()

function readEnabled() {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off'
  } catch {
    return true
  }
}

let singleKeysEnabled = readEnabled()

export function setSingleKeysEnabled(enabled: boolean) {
  singleKeysEnabled = enabled
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off')
  } catch {
    // Storage unavailable (private mode): the setting lasts for this session only.
  }
  listeners.forEach((listener) => listener())
}

export function useSingleKeysEnabled() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => singleKeysEnabled,
  )
}

function isEditable(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.isContentEditable || target.matches('input, textarea, select'))
}

// Keys are either a single character ("r", "?") or "Mod+<key>" ("Mod+Enter").
function matches(shortcut: string, e: KeyboardEvent) {
  if (shortcut.startsWith('Mod+')) return (e.metaKey || e.ctrlKey) && !e.altKey && e.key === shortcut.slice(4)
  return !e.metaKey && !e.ctrlKey && !e.altKey && e.key === shortcut
}

export function useShortcuts(shortcuts: Record<string, () => void>) {
  // Keep the latest handlers without re-binding the listener on every render.
  const current = useRef(shortcuts)
  current.current = shortcuts

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return
      // Dialogs and menus handle their own keys.
      if (e.target instanceof Element && e.target.closest('[role="dialog"], [role="menu"], [role="listbox"]')) return
      for (const [shortcut, handler] of Object.entries(current.current)) {
        if (!matches(shortcut, e)) continue
        const singleKey = !shortcut.startsWith('Mod+')
        if (singleKey && (!singleKeysEnabled || isEditable(e.target))) return
        e.preventDefault()
        handler()
        return
      }
    }
    addEventListener('keydown', onKeyDown)
    return () => removeEventListener('keydown', onKeyDown)
  }, [])
}
