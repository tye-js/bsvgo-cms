import { eq } from "drizzle-orm";

import { hashPassword } from "../src/server/auth/password";
import { closeDb, db } from "../src/server/db";
import {
  categories,
  categoryTranslations,
  users
} from "../src/server/db/schema";

const baseCategories = [
  {
    slug: "blockchain",
    sortOrder: 10,
    en: {
      name: "Blockchain",
      description:
        "Research, engineering notes, and market context for blockchain systems."
    },
    zh: {
      name: "区块链",
      description: "区块链系统的研究、工程实践和市场观察。"
    }
  },
  {
    slug: "ai",
    sortOrder: 20,
    en: {
      name: "AI",
      description: "Applied AI, agent systems, model tooling, and product analysis."
    },
    zh: {
      name: "人工智能",
      description: "应用 AI、智能体系统、模型工具和产品分析。"
    }
  },
  {
    slug: "infrastructure",
    sortOrder: 30,
    en: {
      name: "Infrastructure",
      description:
        "Cloud, data, security, and operational infrastructure for modern products."
    },
    zh: {
      name: "基础设施",
      description: "现代产品的云、数据、安全和运维基础设施。"
    }
  }
];

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL ?? "admin@bsvgo.com";
  const password = process.env.ADMIN_PASSWORD ?? "change-this-admin-password";
  const name = process.env.ADMIN_NAME ?? "BSVgo Admin";

  if (password.length < 10) {
    throw new Error("ADMIN_PASSWORD must be at least 10 characters");
  }

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) {
    await db
      .update(users)
      .set({
        name,
        role: "admin",
        isAdmin: true,
        password: await hashPassword(password),
        deletedAt: null,
        updatedAt: new Date()
      })
      .where(eq(users.id, existing.id));
    console.log(`Updated admin: ${email}`);
    return;
  }

  await db.insert(users).values({
    email,
    name,
    role: "admin",
    isAdmin: true,
    password: await hashPassword(password)
  });

  console.log(`Created admin: ${email}`);
}

async function seedCategories() {
  for (const category of baseCategories) {
    const [existing] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, category.slug))
      .limit(1);

    const categoryId =
      existing?.id ??
      (
        await db
          .insert(categories)
          .values({
            name: category.en.name,
            slug: category.slug,
            description: category.en.description,
            sortOrder: category.sortOrder,
            isLocked: true,
            seoTitle: category.en.name,
            seoDescription: category.en.description
          })
          .returning({ id: categories.id })
      )[0].id;

    await db
      .insert(categoryTranslations)
      .values({
        categoryId,
        locale: "en",
        name: category.en.name,
        description: category.en.description
      })
      .onConflictDoUpdate({
        target: [categoryTranslations.categoryId, categoryTranslations.locale],
        set: {
          name: category.en.name,
          description: category.en.description
        }
      });

    await db
      .insert(categoryTranslations)
      .values({
        categoryId,
        locale: "zh",
        name: category.zh.name,
        description: category.zh.description
      })
      .onConflictDoUpdate({
        target: [categoryTranslations.categoryId, categoryTranslations.locale],
        set: {
          name: category.zh.name,
          description: category.zh.description
        }
      });

    console.log(`Seeded category: ${category.slug}`);
  }
}

async function main() {
  await seedAdmin();
  await seedCategories();
}

main()
  .then(async () => {
    await closeDb();
    console.log("Seed complete");
    process.exit(0);
  })
  .catch(async (error) => {
    await closeDb();
    console.error(error);
    process.exit(1);
  });
