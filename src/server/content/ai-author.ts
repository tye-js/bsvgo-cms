import { getAiWritingRole, isAiWritingRoleId } from "@/lib/ai-style";

export function aiAuthorValues(roleId: string | undefined) {
  const normalizedRoleId = roleId?.trim() ?? "";

  if (!isAiWritingRoleId(normalizedRoleId)) {
    return {
      aiAuthorRole: null,
      aiAuthorZhName: null,
      aiAuthorEnName: null,
      aiAuthorAvatar: null
    };
  }

  const role = getAiWritingRole(normalizedRoleId);

  return {
    aiAuthorRole: role.id,
    aiAuthorZhName: role.zhName,
    aiAuthorEnName: role.enName,
    aiAuthorAvatar: role.avatar
  };
}
