import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  check,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

export type UserRole = "admin" | "editor";
export type PostStatus = "draft" | "published" | "archived";
export type Locale = "en" | "zh";
export type PostMark = "" | "featured" | "pinned" | "sponsored";
export type PostPlacementScope = "home" | "category";
export type PostPlacementSlot = "featured" | "promoted";
export type AnalyticsEventName =
  | "page_view"
  | "article_view"
  | "article_click"
  | "category_click"
  | "tag_click"
  | "nav_click"
  | "locale_switch"
  | "section_jump"
  | "section_view"
  | "outbound_click"
  | "article_depth";

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

export const appSettings = pgTable("app_settings", {
  key: varchar("key", { length: 120 }).primaryKey(),
  value: text("value").notNull(),
  encrypted: boolean("encrypted").notNull().default(false),
  updatedBy: uuid("updated_by").references(() => users.id, {
    onDelete: "set null"
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

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
    seoTitle: varchar("seo_title", { length: 255 }).notNull().default(""),
    seoDescription: varchar("seo_description", { length: 500 }).notNull().default(""),
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
    description: text("description").notNull().default(""),
    seoTitle: varchar("seo_title", { length: 255 }).notNull().default(""),
    seoDescription: varchar("seo_description", { length: 500 }).notNull().default("")
  },
  (table) => ({
    tagLocaleIdx: uniqueIndex("tag_translations_tag_locale_unique").on(
      table.tagId,
      table.locale
    )
  })
);

export const mediaAssets = pgTable(
  "media_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    url: text("url").notNull(),
    altText: varchar("alt_text", { length: 255 }).notNull().default(""),
    caption: text("caption").notNull().default(""),
    storageProvider: varchar("storage_provider", { length: 40 })
      .notNull()
      .default("external_url"),
    storageKey: text("storage_key"),
    originalFilename: varchar("original_filename", { length: 255 }),
    checksum: varchar("checksum", { length: 128 }),
    mimeType: varchar("mime_type", { length: 120 }),
    width: integer("width"),
    height: integer("height"),
    fileSize: integer("file_size"),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null"
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at")
  },
  (table) => ({
    urlIdx: uniqueIndex("media_assets_url_unique").on(table.url),
    createdAtIdx: index("media_assets_created_at_idx").on(table.createdAt)
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
    coverImageId: uuid("cover_image_id").references(() => mediaAssets.id, {
      onDelete: "set null"
    }),
    publishedAt: timestamp("published_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    status: varchar("status", { length: 20 }).notNull().default("draft"),
    mark: varchar("mark", { length: 20 }).notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
    pinned: boolean("pinned").notNull().default(false),
    authorId: uuid("author_id").references(() => users.id, {
      onDelete: "set null"
    }),
    aiAuthorRole: varchar("ai_author_role", { length: 80 }),
    aiAuthorZhName: varchar("ai_author_zh_name", { length: 120 }),
    aiAuthorEnName: varchar("ai_author_en_name", { length: 120 }),
    aiAuthorAvatar: text("ai_author_avatar"),
    deletedAt: timestamp("deleted_at")
  },
  (table) => ({
    slugIdx: uniqueIndex("posts_slug_unique").on(table.slug),
    categoryIdx: index("posts_category_idx").on(table.categoryId),
    statusIdx: index("posts_status_idx").on(table.status),
    coverImageIdx: index("posts_cover_image_idx").on(table.coverImageId)
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

export const postPlacements = pgTable(
  "post_placements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "cascade"
    }),
    scope: varchar("scope", { length: 40 }).notNull(),
    slot: varchar("slot", { length: 40 }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    enabled: boolean("enabled").notNull().default(true),
    startsAt: timestamp("starts_at"),
    endsAt: timestamp("ends_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull()
  },
  (table) => ({
    postIdx: index("post_placements_post_idx").on(table.postId),
    scopeSlotIdx: index("post_placements_scope_slot_idx").on(
      table.scope,
      table.slot
    ),
    categorySlotIdx: index("post_placements_category_slot_idx").on(
      table.categoryId,
      table.slot
    ),
    uniquePlacementIdx: uniqueIndex("post_placements_unique").on(
      table.postId,
      table.scope,
      table.slot,
      sql`coalesce(${table.categoryId}, '00000000-0000-0000-0000-000000000000'::uuid)`
    ),
    scopeCheck: check(
      "post_placements_scope_check",
      sql`${table.scope} in ('home', 'category')`
    ),
    slotCheck: check(
      "post_placements_slot_check",
      sql`${table.slot} in ('featured', 'promoted')`
    ),
    scopeCategoryCheck: check(
      "post_placements_scope_category_check",
      sql`(${table.scope} = 'home' and ${table.categoryId} is null) or (${table.scope} = 'category' and ${table.categoryId} is not null)`
    ),
    timeWindowCheck: check(
      "post_placements_time_window_check",
      sql`${table.startsAt} is null or ${table.endsAt} is null or ${table.startsAt} <= ${table.endsAt}`
    )
  })
);

export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventName: varchar("event_name", { length: 80 }).notNull(),
    visitorId: varchar("visitor_id", { length: 160 }).notNull(),
    sessionId: varchar("session_id", { length: 160 }).notNull(),
    locale: varchar("locale", { length: 10 }),
    path: text("path"),
    referrer: text("referrer"),
    href: text("href"),
    label: text("label"),
    targetType: varchar("target_type", { length: 80 }),
    section: varchar("section", { length: 160 }),
    articleSlug: varchar("article_slug", { length: 255 }),
    categorySlug: varchar("category_slug", { length: 140 }),
    tagSlug: varchar("tag_slug", { length: 140 }),
    value: integer("value"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at").defaultNow().notNull()
  },
  (table) => ({
    createdAtIdx: index("analytics_events_created_at_idx").on(table.createdAt),
    eventCreatedAtIdx: index("analytics_events_event_created_at_idx").on(
      table.eventName,
      table.createdAt
    ),
    visitorIdx: index("analytics_events_visitor_idx").on(table.visitorId),
    sessionIdx: index("analytics_events_session_idx").on(table.sessionId),
    articleIdx: index("analytics_events_article_idx").on(table.articleSlug),
    categoryIdx: index("analytics_events_category_idx").on(table.categorySlug),
    tagIdx: index("analytics_events_tag_idx").on(table.tagSlug),
    referrerIdx: index("analytics_events_referrer_idx").on(table.referrer)
  })
);

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  posts: many(posts),
  mediaAssets: many(mediaAssets)
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
  coverAsset: one(mediaAssets, {
    fields: [posts.coverImageId],
    references: [mediaAssets.id]
  }),
  translations: many(postTranslations),
  postTags: many(postTags),
  placements: many(postPlacements)
}));

export const postPlacementsRelations = relations(postPlacements, ({ one }) => ({
  post: one(posts, {
    fields: [postPlacements.postId],
    references: [posts.id]
  }),
  category: one(categories, {
    fields: [postPlacements.categoryId],
    references: [categories.id]
  })
}));

export const mediaAssetsRelations = relations(mediaAssets, ({ one, many }) => ({
  createdByUser: one(users, {
    fields: [mediaAssets.createdBy],
    references: [users.id]
  }),
  posts: many(posts)
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
