// Small compatibility layer for BilaForm pages while their existing UI is retained.
(() => {
  const client = window.BilaFormSupabase;
  const fail = () => { throw new Error(window.BILAFORM_SUPABASE_ERROR || 'Supabase is not configured.'); };
  async function requireClient() { if (!client) fail(); const { data, error } = await client.auth.getUser(); if (error || !data.user) throw Object.assign(new Error('Please sign in to continue.'), { status: 401 }); return data.user; }
  const profileUser = async (user) => {
    const { data } = await client.from('profiles').select('full_name,created_at').eq('id', user.id).maybeSingle();
    return { id: user.id, email: user.email, name: data?.full_name || user.user_metadata?.full_name || user.email, created_at: data?.created_at || user.created_at };
  };
  const parseBody = (options) => { if (!options.body) return {}; try { return JSON.parse(options.body); } catch { return {}; } };
  async function request(path, options = {}) {
    const method = (options.method || 'GET').toUpperCase(); const body = parseBody(options);
    if (path === '/auth/me') { const user = await requireClient(); return { user: await profileUser(user) }; }
    if (path === '/auth/profile' && method === 'PATCH') {
      const user = await requireClient(); const name = String(body.name || '').trim();
      if (name.length < 2 || name.length > 100) throw new Error('Enter a name between 2 and 100 characters.');
      const { data: profile, error } = await client.from('profiles').update({ full_name: name }).eq('id', user.id).select('id').maybeSingle(); if (error) throw error; if (!profile) { const { error: insertError } = await client.from('profiles').insert({ id: user.id, full_name: name }); if (insertError) throw insertError; }
      const { error: authError } = await client.auth.updateUser({ data: { full_name: name } }); if (authError) throw authError;
      return { user: await profileUser({ ...user, user_metadata: { ...user.user_metadata, full_name: name } }) };
    }
    if (path === '/auth/logout') { const { error } = await client.auth.signOut(); if (error) throw error; return {}; }
    if (path === '/budgets' && method === 'POST') {
      const user = await requireClient(); const remaining = Number(body.cash) - Number(body.essentials) - Number(body.buffer);
      const row = { user_id: user.id, cash: body.cash, essentials: body.essentials, buffer: body.buffer, days: body.days, daily_safe: Math.floor(Math.max(0, remaining) / body.days) };
      const { data, error } = await client.from('budgets').insert(row).select().single(); if (error) throw error; return { budget: data };
    }
    if (path === '/budgets' && method === 'GET' || path.startsWith('/budgets/latest')) {
      const user = await requireClient(); const { data, error } = await client.from('budgets').select('id,cash,essentials,buffer,days,daily_safe,updated_at').eq('user_id', user.id).order('updated_at', { ascending: false }).order('id', { ascending: false }); if (error) throw error;
      return path.includes('/latest') ? { budget: data[0] || null } : { budgets: data };
    }
    const budgetDelete = path.match(/^\/budgets\/(\d+)$/);
    if (budgetDelete && method === 'DELETE') { await requireClient(); const { error } = await client.from('budgets').delete().eq('id', Number(budgetDelete[1])); if (error) throw error; return {}; }
    if (path === '/plans' && method === 'GET') { const user = await requireClient(); const { data, error } = await client.from('plans').select('id,type,name,data,created_at').eq('user_id', user.id).order('created_at', { ascending: false }); if (error) throw error; return { plans: data }; }
    if (path === '/plans' && method === 'POST') { const user = await requireClient(); const { data, error } = await client.from('plans').insert({ user_id: user.id, type: body.type || 'vukamonth', name: body.name, data: body.data }).select().single(); if (error) throw error; return { plan: data }; }
    const planDelete = path.match(/^\/plans\/(\d+)$/);
    if (planDelete && method === 'DELETE') { await requireClient(); const { error } = await client.from('plans').delete().eq('id', Number(planDelete[1])); if (error) throw error; return {}; }
    if (path === '/savings-goals' && method === 'GET') {
      const user = await requireClient(); const { data: goals, error } = await client.from('savings_goals').select('*').eq('user_id', user.id).order('target_date').order('id', { ascending: false }); if (error) throw error;
      const { data: contributions, error: historyError } = await client.from('savings_contributions').select('id,goal_id,amount,entry_type,created_at').eq('user_id', user.id).order('created_at', { ascending: false }); if (historyError) throw historyError;
      return { goals: goals.map((goal) => ({ ...goal, contributions: contributions.filter((entry) => entry.goal_id === goal.id) })) };
    }
    if (path === '/savings-goals' && method === 'POST') {
      const user = await requireClient(); const current = Number(body.current_amount || 0); const target = Number(body.target_amount);
      const { data, error } = await client.from('savings_goals').insert({ user_id: user.id, name: body.name.trim(), target_amount: target, current_amount: current, target_date: body.target_date, status: current >= target ? 'completed' : 'active' }).select().single(); if (error) throw error;
      return { goal: data };
    }
    const goalPath = path.match(/^\/savings-goals\/(\d+)(?:\/(contributions))?$/);
    if (goalPath && goalPath[2] && method === 'POST') { const user = await requireClient(); const { data, error } = await client.rpc('add_savings_contribution', { p_goal_id: Number(goalPath[1]), p_amount: Number(body.amount) }); if (error) throw error; return { goal: data }; }
    if (goalPath && method === 'PUT') { const user = await requireClient(); const { data: existing, error: readError } = await client.from('savings_goals').select('current_amount,target_amount').eq('id', Number(goalPath[1])).eq('user_id', user.id).single(); if (readError) throw readError; const target = Number(body.target_amount ?? existing.target_amount); if (target < Number(existing.current_amount)) throw new Error('Target amount cannot be less than the amount already saved.'); const requestedStatus = body.status || 'active'; const status = Number(existing.current_amount) >= target ? 'completed' : requestedStatus; const patch = { name: String(body.name || '').trim(), target_amount: target, target_date: body.target_date, status }; const { data, error } = await client.from('savings_goals').update(patch).eq('id', Number(goalPath[1])).eq('user_id', user.id).select().single(); if (error) throw error; return { goal: data }; }
    if (goalPath && method === 'DELETE') { await requireClient(); const { error } = await client.from('savings_goals').delete().eq('id', Number(goalPath[1])); if (error) throw error; return {}; }
    if (path === '/contact' && method === 'POST') { const { error } = await client.from('contact_messages').insert({ name: body.name.trim(), email: body.email.trim(), message: body.message.trim() }); if (error) throw error; return { message: 'Your message has been saved for the BilaForm team. It is not emailed automatically.' }; }
    throw new Error(`Unsupported BilaForm request: ${method} ${path}`);
  }
  window.BilaFormData = { request, requireUser: requireClient, profileUser };
})();


