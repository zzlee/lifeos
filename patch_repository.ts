<<<<<<< SEARCH
export async function getHealthRecords(
=======
export async function getVaultItems(
  db: D1Database,
  user: UserProfile,
  limit: number = 20,
  offset: number = 0,
  filters: { query?: string } = {},
): Promise<{ id: number; site: string; username: string; secret: string }[]> {
  let sql = "SELECT id, site, username, secret_preview as secret FROM vault_items WHERE user_id = ?";
  const params: any[] = [user.id];

  if (filters.query) {
    sql += " AND site LIKE ?";
    params.push(`%${filters.query}%`);
  }

  sql += " ORDER BY site ASC LIMIT ? OFFSET ?";
  params.push(limit, offset);

  const result = await db.prepare(sql).bind(...params).all<{ id: number; site: string; username: string; secret: string }>();
  return result.results || [];
}

export async function getHealthRecords(
>>>>>>> REPLACE
