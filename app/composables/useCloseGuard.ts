// Shared "click outside to close, but confirm if there are unsaved changes"
// behavior for native <dialog> sheets. isDirty is checked lazily so callers
// can pass a plain function reading current form state.
export function useCloseGuard(isDirty: () => boolean, doClose: () => void) {
  const confirmingClose = ref(false)

  function requestClose() {
    if (isDirty()) {
      confirmingClose.value = true
    } else {
      doClose()
    }
  }
  function cancelClose() {
    confirmingClose.value = false
  }
  function discardAndClose() {
    confirmingClose.value = false
    doClose()
  }
  function reset() {
    confirmingClose.value = false
  }

  return { confirmingClose, requestClose, cancelClose, discardAndClose, reset }
}
