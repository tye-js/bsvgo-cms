export function stringValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

export function booleanValue(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function placementValue(formData: FormData, key: string) {
  return {
    enabled: booleanValue(formData, `placements.${key}.enabled`),
    sortOrder: stringValue(formData, `placements.${key}.sortOrder`),
    startsAt: stringValue(formData, `placements.${key}.startsAt`),
    endsAt: stringValue(formData, `placements.${key}.endsAt`)
  };
}

export function postDataFromForm(formData: FormData) {
  return {
    writingRole: stringValue(formData, "writingRole"),
    slug: stringValue(formData, "slug"),
    categoryId: stringValue(formData, "categoryId"),
    status: stringValue(formData, "status"),
    mark: stringValue(formData, "mark"),
    coverImageId: stringValue(formData, "coverImageId"),
    coverImageUrl: stringValue(formData, "coverImageUrl"),
    coverImageAlt: stringValue(formData, "coverImageAlt"),
    enSeoTitle: stringValue(formData, "enSeoTitle"),
    enSeoDescription: stringValue(formData, "enSeoDescription"),
    zhSeoTitle: stringValue(formData, "zhSeoTitle"),
    zhSeoDescription: stringValue(formData, "zhSeoDescription"),
    publishedAt: stringValue(formData, "publishedAt"),
    featured: booleanValue(formData, "featured"),
    pinned: booleanValue(formData, "pinned"),
    placements: {
      homeFeatured: placementValue(formData, "homeFeatured"),
      homePromoted: placementValue(formData, "homePromoted"),
      categoryFeatured: placementValue(formData, "categoryFeatured"),
      categoryPromoted: placementValue(formData, "categoryPromoted")
    },
    readingTimeMinutes: stringValue(formData, "readingTimeMinutes"),
    sortOrder: stringValue(formData, "sortOrder"),
    tagIds: formData.getAll("tagIds").map(String).filter(Boolean),
    enTitle: stringValue(formData, "enTitle"),
    enExcerpt: stringValue(formData, "enExcerpt"),
    enContent: stringValue(formData, "enContent"),
    zhTitle: stringValue(formData, "zhTitle"),
    zhExcerpt: stringValue(formData, "zhExcerpt"),
    zhContent: stringValue(formData, "zhContent")
  };
}
