export function isFinanceAdmin(user, env = process.env) {
  if (!user?.id || user.is_anonymous) return false;
  const allowed = String(env.JENIOS_PAY_ADMIN_USER_IDS || '').split(',').map(id => id.trim()).filter(Boolean);
  return allowed.includes(user.id) || user.app_metadata?.role === 'admin' || user.app_metadata?.role === 'finance_admin';
}
export function requirePayToken(request) {
  const token = (request.headers.get('authorization') || '').match(/^Bearer ([^\s]+)$/i)?.[1];
  if (!token) throw Object.assign(new Error('Entre na sua conta para continuar.'), { status: 401 });
  return token;
}
export async function requirePayUser(request, db, admin = false) {
  const token = requirePayToken(request);
  const { data, error } = await db.auth.getUser(token);
  if (error || !data?.user?.id || data.user.is_anonymous) throw Object.assign(new Error('Sessão inválida. Entre novamente.'), { status: 401 });
  if (admin && !isFinanceAdmin(data.user)) throw Object.assign(new Error('Acesso restrito à gestão financeira.'), { status: 403 });
  return data.user;
}
