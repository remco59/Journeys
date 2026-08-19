import { pgEnum } from 'drizzle-orm/pg-core'

/** How much the system trusts an automatically derived value. */
export const confidenceEnum = pgEnum('confidence', ['high', 'medium', 'low', 'inferred'])

/** Provenance: has a human decided this value, or is it still algorithm output? */
export const provenanceEnum = pgEnum('provenance', ['auto', 'user_override'])
