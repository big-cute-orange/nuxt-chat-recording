/**
 * Auth middleware: validates that the session user still exists in the database.
 * Clears the session if the user has been deleted.
 * On DB errors, preserves the session to avoid logging out users during outages.
 */
import { defineEventHandler, type H3Event } from 'h3'
import { useDb } from '#server/utils/db'
import { users } from '#server/db/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event: H3Event) => {
    const session = await getUserSession(event)

    if (!session?.user?.id) return

    const db = useDb()

    let existing: { id: string } | undefined
    let dbError = false

    try {
        existing = await db.query.users.findFirst({
            where: eq(users.id, session.user.id),
        })
    } catch {
        // DB unavailable — preserve the session rather than logging everyone out
        dbError = true
    }

    if (!dbError && !existing) {
        // User was deleted — clear stale session
        await clearUserSession(event)
    }
})
