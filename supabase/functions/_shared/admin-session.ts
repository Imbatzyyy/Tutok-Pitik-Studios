/** Call only after auth.getUser has verified the access token. Never trust client metadata. */
export async function hasPortalSession(db: any, verifiedToken: string, userId: string): Promise<boolean> {
  try {
    const payload = verifiedToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(payload));
    if (claims.sub !== userId || typeof claims.session_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(claims.session_id)) return false;
    const {data,error} = await db.rpc('studio_admin_session_valid',{p_user_id:userId,p_session_id:claims.session_id});
    return !error && data === true;
  } catch { return false; }
}
