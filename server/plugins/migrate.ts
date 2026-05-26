import { migrate } from 'drizzle-orm/libsql/migrator';
import { useDb } from '#server/utils/db';

// ── Auto-migrate on server startup ────────────────────────────────────────────
// Runs pending migrations from server/db/migrations/ each time Nitro starts.
// Safe to run on every boot — only applies new migrations.
// In production (Vercel), migrations are run during build via `db:migrate` in
// the build command, so this plugin is a no-op there.

export default defineNitroPlugin(async () => {
    if (process.env.NODE_ENV === 'production') {
        return;
    }

    try {
        const db = useDb();

        await migrate(db, { migrationsFolder: './server/db/migrations' });

        // eslint-disable-next-line no-console
        console.info('[db] Migrations applied successfully.');
    } catch (err) {
        console.error('[db] Migration failed:', err);

        throw err;
    }
});
