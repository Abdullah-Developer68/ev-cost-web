import React, { useId } from 'react'
import { cn } from '@/lib/utils'

export const inputClass =
  'h-9 w-full rounded border border-rule-strong bg-paper px-3 text-body text-ink placeholder:text-ink-3 transition-[border-color,box-shadow] duration-150 hover:border-ink-3 focus:border-spot focus:outline-none focus:ring-2 focus:ring-spot/20 disabled:bg-plane disabled:text-ink-3 aria-[invalid=true]:border-bad aria-[invalid=true]:ring-bad/15'

interface FieldProps {
  label: string
  hint?: React.ReactNode
  error?: string
  required?: boolean
  className?: string
  children: (props: {
    id: string
    'aria-describedby'?: string
    'aria-invalid'?: boolean
  }) => React.ReactNode
}

/** Label + control + hint/error, wired for screen readers. */
export function Field({
  label,
  hint,
  error,
  required,
  className,
  children
}: FieldProps): React.JSX.Element {
  const id = useId()
  const messageId = useId()
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-small font-semibold text-ink-2">
        {label}
        {required && (
          <span className="ml-0.5 text-bad" aria-hidden>
            *
          </span>
        )}
      </label>
      {children({
        id,
        'aria-describedby': hint || error ? messageId : undefined,
        'aria-invalid': error ? true : undefined
      })}
      {(error || hint) && (
        <p
          id={messageId}
          className={cn('text-caption', error ? 'font-semibold text-bad' : 'text-ink-3')}
        >
          {error || hint}
        </p>
      )}
    </div>
  )
}

interface AffixInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  prefix?: string
  suffix?: string
}

/** Numeric input with a currency prefix or % suffix. */
export const AffixInput = React.forwardRef<HTMLInputElement, AffixInputProps>(
  ({ prefix, suffix, className, ...props }, ref) => (
    <div className="relative">
      {prefix && (
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-body text-ink-3">
          {prefix.trim()}
        </span>
      )}
      <input
        ref={ref}
        className={cn(
          inputClass,
          'num',
          prefix && (prefix.trim().length > 1 ? 'pl-11' : 'pl-7'),
          suffix && 'pr-8',
          className
        )}
        {...props}
      />
      {suffix && (
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-body text-ink-3">
          {suffix}
        </span>
      )}
    </div>
  )
)
AffixInput.displayName = 'AffixInput'
