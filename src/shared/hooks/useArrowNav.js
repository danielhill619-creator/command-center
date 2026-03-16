import { useEffect } from 'react'

/**
 * useArrowNav
 * Intercepts left/right arrow keys (when not typing in an input) and
 * cycles through the provided items array, updating current selection.
 *
 * @param {string[]} items    - ordered list of section keys
 * @param {string}   current  - currently active key
 * @param {Function} setCurrent - state setter
 */
export function useArrowNav(items, current, setCurrent) {
  useEffect(() => {
    function handleKey(e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return

      // Don't hijack when the user is typing
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (document.activeElement?.isContentEditable) return

      e.preventDefault()

      const idx = items.indexOf(current)
      if (idx === -1) return

      if (e.key === 'ArrowLeft') {
        setCurrent(items[(idx - 1 + items.length) % items.length])
      } else {
        setCurrent(items[(idx + 1) % items.length])
      }
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [items, current, setCurrent])
}
