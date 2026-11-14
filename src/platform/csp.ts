import { z } from 'zod'

/**
 * zod v4 probes `new Function('')` to decide whether it may compile fast
 * parsers. The app's Content-Security-Policy forbids eval, so that probe shows
 * up as a CSP violation in the console. Jitless mode skips it; parsing is the
 * same, only without the compiled fast path. Imported first in main.tsx.
 */
z.config({ jitless: true })
