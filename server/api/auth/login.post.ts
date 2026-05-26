import { defineEventHandler, readBody, createError } from 'h3';
import { eq } from 'drizzle-orm';
import { useDb } from '#server/utils/db';
import { users } from '#server/db/schema';

export default defineEventHandler(async (event) => {
    const body = await readBody(event);
    const { username, password } = body ?? {};

    if (!username || !password) {
        throw createError({ statusCode: 400, message: '请填写用户名和密码' });
    }

    if ((password as string).length > 1024) {
        // Reject before scrypt to prevent CPU DoS via oversized passwords
        throw createError({ statusCode: 401, message: '用户名或密码错误' });
    }

    const db = useDb();

    // ── Look up user ──────────────────────────────────────────────────────────
    let user;
    try {
        user = await db.query.users.findFirst({
            where: eq(users.username, username),
        });
    } catch {
        throw createError({ statusCode: 500, message: '服务器错误，请稍后重试' });
    }

    // Generic message — don't reveal whether username exists
    if (!user || !user.passwordHash) {
        throw createError({ statusCode: 401, message: '用户名或密码错误' });
    }

    const valid = await verifyPassword(user.passwordHash, password);

    if (!valid) {
        throw createError({ statusCode: 401, message: '用户名或密码错误' });
    }

    // ── Set session ───────────────────────────────────────────────────────────
    await setUserSession(event, {
        user: {
            id: user.id,
            username: user.username,
            provider: user.provider,
            providerAccountId: user.providerAccountId,
            name: user.name,
            email: user.email,
            avatarUrl: user.avatarUrl,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        },
    });

    return { ok: true };
});
