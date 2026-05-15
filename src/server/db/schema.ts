import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export type UserRole = "admin" | "editor";
export type PostStatus = "draft" | "published" | "archived";
export type Locale = "en" | "zh";

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    password: text("password").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    avatar: text("avatar"),
    isAdmin: boolean("is_admin").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    membershipLevel: varchar("membership_level", { length: 20 })
      .notNull()
      .default("free"),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    lastLoginAt: timestamp("last_login_at"),
    role: varchar("role", { length: 20 }).notNull().default("editor"),
    deletedAt: timestamp("deleted_at")
  },
  (table) => ({
    emailIdx: uniqueIndex("users_email_key").on(table.email)
  })
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull()
  },
  (table) => ({
    tokenHashIdx: uniqueIndex("sessions_token_hash_idx").on(table.tokenHash),
    userIdx: index("sessions_user_idx").on(table.userId)
  })
);

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 100 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull(),
    description: text(),
    color: varchar("color", { length: 7 }).default("#3B82F6"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    isLocked: boolean("is_locked").notNull().default(true),
    seoTitle: varchar("seo_title", { length: 255 }),
    seoDescription: text("seo_description"),
    deletedAt: timestamp("deleted_at")
  },
  (table) => ({
    slugIdx: uniqueIndex("categories_slug_key").on(table.slug),
    nameIdx: uniqueIndex("categories_name_key").on(table.name)
  })
);

export const categoryTranslations = pgTable(
  "category_translations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    locale: varchar("locale", { length: 10 }).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull()
  },
  (table) => ({
    categoryLocaleIdx: uniqueIndex("category_translations_category_locale_unique").on(
      table.categoryId,
      table.locale
    )
  })
);

export const tags = pgTable(
  "tags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 100 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull(),
    color: varchar("color", { length: 7 }).default("#6B7280"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    seoTitle: varchar("seo_title", { length: 255 }),
    seoDescription: text("seo_description"),
    deletedAt: timestamp("deleted_at")
  },
  (table) => ({
    slugIdx: uniqueIndex("tags_slug_key").on(table.slug),
    nameIdx: uniqueIndex("tags_name_key").on(table.name)
  })
);

export const tagTranslations = pgTable(
  "tag_translations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    locale: varchar("locale", { length: 10 }).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description").notNull().default("")
  },
  (table) => ({
    tagLocaleIdx: uniqueIndex("tag_translations_tag_locale_unique").on(
      table.tagId,
      table.locale
    )
  })
);

export const posts = pgTable(
  "posts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: varchar("slug", { length: 255 }).notNull(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    featured: boolean("featured").notNull().default(false),
    coverImage: text("cover_image").notNull().default(""),
    publishedAt: timestamp("published_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    status: varchar("status", { length: 20 }).notNull().default("draft"),
    sortOrder: integer("sort_order").notNull().default(0),
    pinned: boolean("pinned").notNull().default(false),
    authorId: uuid("author_id").references(() => users.id, {
      onDelete: "set null"
    }),
    deletedAt: timestamp("deleted_at")
  },
  (table) => ({
    slugIdx: uniqueIndex("posts_slug_unique").on(table.slug),
    categoryIdx: index("posts_category_idx").on(table.categoryId),
    statusIdx: index("posts_status_idx").on(table.status)
  })
);

export const postTranslations = pgTable(
  "post_translations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    locale: varchar("locale", { length: 10 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    excerpt: text("excerpt").notNull(),
    content: text("content").notNull(),
    readingMinutes: integer("reading_minutes").notNull().default(1),
    seoTitle: varchar("seo_title", { length: 255 }).notNull().default(""),
    seoDescription: varchar("seo_description", { length: 500 })
      .notNull()
      .default(""),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull()
  },
  (table) => ({
    postLocaleIdx: uniqueIndex("post_translations_post_locale_unique").on(
      table.postId,
      table.locale
    )
  })
);

export const postTags = pgTable(
  "post_tags",
  {
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" })
  },
  (table) => ({
    pk: primaryKey({ columns: [table.postId, table.tagId] }),
    tagIdx: index("post_tags_tag_idx").on(table.tagId)
  })
);

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  posts: many(posts)
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id]
  })
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  posts: many(posts),
  translations: many(categoryTranslations)
}));

export const categoryTranslationsRelations = relations(
  categoryTranslations,
  ({ one }) => ({
    category: one(categories, {
      fields: [categoryTranslations.categoryId],
      references: [categories.id]
    })
  })
);

export const tagsRelations = relations(tags, ({ many }) => ({
  translations: many(tagTranslations),
  postTags: many(postTags)
}));

export const tagTranslationsRelations = relations(tagTranslations, ({ one }) => ({
  tag: one(tags, {
    fields: [tagTranslations.tagId],
    references: [tags.id]
  })
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  category: one(categories, {
    fields: [posts.categoryId],
    references: [categories.id]
  }),
  author: one(users, {
    fields: [posts.authorId],
    references: [users.id]
  }),
  translations: many(postTranslations),
  postTags: many(postTags)
}));

export const postTranslationsRelations = relations(postTranslations, ({ one }) => ({
  post: one(posts, {
    fields: [postTranslations.postId],
    references: [posts.id]
  })
}));

export const postTagsRelations = relations(postTags, ({ one }) => ({
  post: one(posts, {
    fields: [postTags.postId],
    references: [posts.id]
  }),
  tag: one(tags, {
    fields: [postTags.tagId],
    references: [tags.id]
  })
}));
