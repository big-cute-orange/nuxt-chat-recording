import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  out: './server/db/migrations',
  schema: './server/db/schema.ts',
  dialect: 'sqlite',
  dbCredentials: {
    url: './server/db/sqlite.db',
  },
})

// Drizzle ORM 的配置文件
// 告诉工具：用 SQLite 数据库，表结构在哪，数据库文件存在哪，迁移文件生成到哪

// Drizzle ORM = 轻量、类型安全的数据库操作工具
// 替代手写 SQL，在 TS/JS 里用对象写法操作数据库，比 Prisma 轻、比原生 SQL 好维护

// 通俗类比
// 原生 SQL：自己写 SELECT * FROM user 字符串，容易写错、无类型提示
// Drizzle ORM：先定义表结构，然后调用方法 db.select().from(user) 自动生成 SQL
// 全程 TS 强类型：字段名、类型错了编辑器直接爆红

// 核心作用
// 定义数据表
// 在 schema.ts 里声明用户表、行程表、景点表，规定字段名、类型、主键、外键
// 数据库迁移
// 改了表结构（加字段 / 删表），一键生成变更脚本，同步更新数据库
// 增删改查
// 不用拼 SQL，链式调用读写数据，写法优雅
// 适配多数据库
// 切换 sqlite / mysql / postgres 几乎不用改业务代码
