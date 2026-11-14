import React, { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { Modal } from '../ui/overlay'
import { Button } from '../ui/button'

export const ConfirmDialog: React.FC = () => {
  const confirm = useAppStore((s) => s.confirm)
  const requestConfirm = useAppStore((s) => s.requestConfirm)
  const [busy, setBusy] = useState(false)

  if (!confirm) return null

  const close = (): void => requestConfirm(null)
  const run = async (): Promise<void> => {
    setBusy(true)
    try {
      await confirm.onConfirm()
      close()
    } catch {
      // The action reports its own error; keep the dialog open so the user can retry.
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={confirm.title}
      icon={confirm.tone === 'danger' ? <AlertTriangle className="size-5 text-bad" /> : undefined}
      onClose={close}
      width="sm"
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button
            variant={confirm.tone === 'danger' ? 'danger' : 'primary'}
            onClick={run}
            loading={busy}
            data-autofocus
          >
            {confirm.confirmLabel}
          </Button>
        </>
      }
    >
      <p className="px-6 py-5 text-ui text-ink-2">{confirm.body}</p>
    </Modal>
  )
}
