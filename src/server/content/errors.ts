export function friendlyDatabaseError(error: unknown) {
  const messages: string[] = [];
  const codes: string[] = [];
  const constraints: string[] = [];
  let current: unknown = error;

  for (let depth = 0; current && depth < 5; depth += 1) {
    const dbError = current as {
      cause?: unknown;
      code?: string;
      constraint?: string;
      constraint_name?: string;
      message?: string;
    };

    messages.push(
      current instanceof Error ? current.message : String(dbError.message ?? current)
    );

    if (dbError.code) codes.push(dbError.code);
    if (dbError.constraint) constraints.push(dbError.constraint);
    if (dbError.constraint_name) constraints.push(dbError.constraint_name);

    current = dbError.cause;
  }

  const message = messages.join("\n");

  if (
    codes.includes("23505") ||
    message.includes("duplicate key value") ||
    constraints.some((constraint) => constraint.includes("slug"))
  ) {
    return "已存在相同 slug 的记录。请使用唯一 slug 后重试。";
  }

  if (
    codes.includes("57014") ||
    message.includes("statement timeout") ||
    message.includes("canceling statement due to statement timeout") ||
    message.includes("timeout exceeded") ||
    message.includes("Connection terminated")
  ) {
    return "保存超时。请检查数据库连接后重试。";
  }

  return "保存失败，请重试。";
}

export function friendlyAiError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  if (
    message.includes("AI API key is not configured") ||
    message.includes("app_settings")
  ) {
    return "AI 尚未配置。请先到设置页保存 AI API Key，再创建文章。";
  }

  if (message.includes("timed out")) {
    return "英文生成超时，请重试。";
  }

  return "英文生成失败。请检查 AI 配置后重试。";
}
