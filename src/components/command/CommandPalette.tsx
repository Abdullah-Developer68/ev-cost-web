import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import { CornerDownLeft, Search, X } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { groupCommands, searchCommands } from '../../lib/commands'
import { cn } from '../../lib/utils'
import { useCommands } from './useCommands'

const Kbd: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <kbd className="rounded border border-rule bg-paper px-1.5 font-mono text-caption text-ink-3">
    {children}
  </kbd>
)

/**
 * The command menu: one search box that reaches every page, action, project and
 * work package from the keyboard. Arrow keys move, Enter runs, Esc closes.
 */
const CommandMenu: React.FC = () => {
  const close = useAppStore((s) => s.setIsCommandOpen)
  const commands = useCommands()
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  const results = useMemo(() => searchCommands(commands, query), [commands, query])
  const groups = useMemo(() => groupCommands(results), [results])
  // The order the options are drawn in, which is what the arrow keys walk through.
  const ordered = useMemo(() => groups.flatMap((g) => g.commands), [groups])
  const active = Math.min(activeIndex, Math.max(ordered.length - 1, 0))

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    inputRef.current?.focus()
    return () => previous?.focus?.()
  }, [])

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>('[aria-selected="true"]')
      ?.scrollIntoView({ block: 'nearest' })
  }, [active, ordered])

  const run = (index: number): void => {
    const command = ordered[index]
    if (!command) return
    // Close first, so a command that opens a dialog is not fighting this one for focus.
    close(false)
    command.run()
  }

  const onKeyDown = (e: React.KeyboardEvent): void => {
    const last = ordered.length - 1
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(active >= last ? 0 : active + 1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(active <= 0 ? last : active - 1)
    } else if (e.key === 'Home') {
      e.preventDefault()
      setActiveIndex(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      setActiveIndex(last)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      run(active)
    } else if (e.key === 'Tab') {
      // The search box is the only stop; keep focus in it.
      e.preventDefault()
    }
  }

  const optionId = (index: number): string => `${listId}-option-${index}`

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-[var(--scrim)] px-3 pt-3 animate-fade-in sm:px-4 sm:pt-[12vh]"
      onMouseDown={(e) => e.target === e.currentTarget && close(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command menu"
        onKeyDown={onKeyDown}
        className="flex max-h-[min(520px,calc(100dvh-24px))] w-full max-w-xl flex-col sm:max-h-[min(520px,76dvh)] overflow-hidden rounded-xl border border-rule bg-paper shadow-lift animate-rise-in"
      >
        <div className="flex items-center gap-2.5 border-b border-rule px-4">
          <Search className="size-4 shrink-0 text-ink-3" aria-hidden />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={ordered.length > 0 ? optionId(active) : undefined}
            aria-autocomplete="list"
            aria-label="Search pages, actions and work packages"
            placeholder="Search or jump to"
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActiveIndex(0)
            }}
            className="h-12 min-w-0 flex-1 bg-transparent text-ui text-ink outline-none placeholder:text-ink-3"
          />
          <span className="[@media(pointer:coarse)]:hidden">
            <Kbd>Esc</Kbd>
          </span>
          <button
            type="button"
            onClick={() => close(false)}
            aria-label="Close the command menu"
            className="-mr-2 hidden size-10 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-subtle hover:text-ink [@media(pointer:coarse)]:flex"
          >
            <X className="size-4" />
          </button>
        </div>

        <div
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label="Results"
          className="min-h-0 flex-1 overflow-y-auto p-1.5"
        >
          {ordered.length === 0 ? (
            <p className="px-3 py-8 text-center text-body text-ink-3">
              Nothing matches “{query.trim()}”. Try a page, an action or a work package name.
            </p>
          ) : (
            groups.map((group) => (
              <div key={group.group} role="group" aria-label={group.group}>
                <div className="label-caps px-2.5 pb-1 pt-2.5" aria-hidden>
                  {group.group}
                </div>
                {group.commands.map((command) => {
                  const index = ordered.indexOf(command)
                  const selected = index === active
                  const Icon = command.icon
                  return (
                    <div
                      key={command.id}
                      id={optionId(index)}
                      role="option"
                      aria-selected={selected}
                      onMouseMove={() => index !== active && setActiveIndex(index)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => run(index)}
                      className={cn(
                        'flex h-9 cursor-default items-center gap-2.5 rounded-md px-2.5 text-body [@media(pointer:coarse)]:h-11',
                        selected ? 'bg-subtle-2 text-ink' : 'text-ink-2'
                      )}
                    >
                      {Icon && (
                        <Icon
                          className={cn('size-4 shrink-0', selected ? 'text-ink' : 'text-ink-3')}
                          aria-hidden
                        />
                      )}
                      <span className="truncate">{command.label}</span>
                      {command.detail && (
                        <span className="shrink-0 truncate text-small text-ink-3">
                          {command.detail}
                        </span>
                      )}
                      {command.shortcut && (
                        <span className="ml-auto shrink-0 [@media(pointer:coarse)]:hidden">
                          <Kbd>{command.shortcut}</Kbd>
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            ))
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-rule bg-plane px-4 py-2 text-caption text-ink-3">
          <span className="flex items-center gap-1.5 [@media(pointer:coarse)]:hidden">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd>
            to move
          </span>
          <span className="flex items-center gap-1.5 [@media(pointer:coarse)]:hidden">
            <Kbd>
              <CornerDownLeft className="inline size-3" aria-label="Enter" />
            </Kbd>
            to run
          </span>
          <span className="num ml-auto" aria-live="polite">
            {ordered.length} {ordered.length === 1 ? 'result' : 'results'}
          </span>
        </div>
      </div>
    </div>
  )
}

/** Mounts the menu only while it is open, so its search starts empty each time. */
export const CommandPalette: React.FC = () => {
  const isOpen = useAppStore((s) => s.isCommandOpen)
  return isOpen ? <CommandMenu /> : null
}
