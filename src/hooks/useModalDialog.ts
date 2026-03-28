import { useEffect, useId, useRef, type KeyboardEventHandler, type RefObject } from 'react'

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

function getFocusableElements(container: HTMLElement | null) {
  if (!container) {
    return []
  }

  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((element) => {
    if (element.hasAttribute('disabled') || element.getAttribute('aria-hidden') === 'true') {
      return false
    }

    return element.offsetParent !== null || element.getClientRects().length > 0
  })
}

interface UseModalDialogOptions {
  open: boolean
  onClose?: () => void
  initialFocusRef?: RefObject<HTMLElement | null>
}

export function useModalDialog({
  open,
  onClose,
  initialFocusRef,
}: UseModalDialogOptions) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const previousActiveElementRef = useRef<HTMLElement | null>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    if (!open || typeof document === 'undefined') {
      return
    }

    previousActiveElementRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null

    const frame = window.requestAnimationFrame(() => {
      const focusTarget =
        initialFocusRef?.current ?? getFocusableElements(containerRef.current)[0] ?? containerRef.current

      focusTarget?.focus()
    })

    return () => {
      window.cancelAnimationFrame(frame)
      previousActiveElementRef.current?.focus?.()
    }
  }, [initialFocusRef, open])

  const handleKeyDownCapture: KeyboardEventHandler<HTMLDivElement> = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onClose?.()
      return
    }

    if (event.key !== 'Tab') {
      return
    }

    const focusableElements = getFocusableElements(containerRef.current)

    if (!focusableElements.length) {
      event.preventDefault()
      containerRef.current?.focus()
      return
    }

    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]
    const activeElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    const activeIndex = activeElement ? focusableElements.indexOf(activeElement) : -1

    if (event.shiftKey) {
      if (activeElement === firstElement || activeIndex === -1) {
        event.preventDefault()
        lastElement.focus()
      }
      return
    }

    if (activeElement === lastElement) {
      event.preventDefault()
      firstElement.focus()
    }
  }

  return {
    containerRef,
    titleId,
    descriptionId,
    handleKeyDownCapture,
  }
}
