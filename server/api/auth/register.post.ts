import { defineEventHandler, readBody, createError } from 'h3';
import { eq } from 'drizzle-orm';
import { useDb } from '#server/utils/db';
import { users } from '#server/db/schema';
import { hashPassword } from '#server/utils/password';

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

export default defineEventHandler(async (event) => {
    const body = await readBody(event);
    const { username, password, confirmPassword } = body ?? {};

    // ── Validate input ────────────────────────────────────────────────────────
    if (!username || !password || !confirmPassword) {
        throw createError({ statusCode: 400, message: '请填写所有字段' });
    }

    if (!USERNAME_RE.test(username)) {
        throw createError({ statusCode: 400, message: '用户名需为 3-20 位，只能包含字母、数字或下划线' });
    }

    if (password.length < 8) {
        throw createError({ statusCode: 400, message: '密码至少 8 位' });
    }

    if (password.length > 1024) {
        throw createError({ statusCode: 400, message: '密码不能超过 1024 位' });
    }

    if (password !== confirmPassword) {
        throw createError({ statusCode: 400, message: '两次输入的密码不一致' });
    }

    const db = useDb();

    // ── Check username uniqueness ─────────────────────────────────────────────
    let existing;
    try {
        existing = await db.query.users.findFirst({
            where: eq(users.username, username),
        });
    } catch (err) {
        throw createError({ statusCode: 500, message: '服务器错误，请稍后重试' });
    }

    if (existing) {
        throw createError({ statusCode: 409, message: '该用户名已被使用' });
    }

    // ── Create user ───────────────────────────────────────────────────────────
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const passwordHash = await hashPassword(password);

    try {
        await db.insert(users).values({
            id,
            username,
            passwordHash,
            provider: 'local',
            providerAccountId: username,
            name: username,
            email: null,
            avatarUrl: null,
            createdAt: now,
            updatedAt: now,
        });
    } catch (err) {
        // Unique constraint violation means a concurrent registration won the race
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('UNIQUE') || msg.includes('unique')) {
            throw createError({ statusCode: 409, message: '该用户名已被使用' });
        }
        throw createError({ statusCode: 500, message: '注册失败，请稍后重试' });
    }

    // ── Set session ───────────────────────────────────────────────────────────
    await setUserSession(event, {
        user: {
            id,
            username,
            provider: 'local',
            providerAccountId: username,
            name: username,
            email: null,
            avatarUrl: null,
            createdAt: now,
            updatedAt: now,
        },
    });

    return { ok: true };
});
