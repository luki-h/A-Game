'use strict';

// Enter the URL and publishable key from your Supabase project's Connect panel.
const leaderboardConfig = { url: '', publishableKey: '' };
let onlineClient;
let onlineUser;
let onlineBusy = false;

function onlineStatus(message) {
  get('online-status').textContent = message;
}

async function refreshLeaderboard() {
  const { data, error } = await onlineClient.from('money_press_scores')
    .select('bank_name,bill_clicks').order('bill_clicks', { ascending: false }).limit(10);
  if (error) throw error;
  const list = get('scores');
  list.replaceChildren();
  for (const score of data) {
    const item = document.createElement('li');
    item.textContent = score.bank_name + ' · ' + numberFormat.format(score.bill_clicks) + ' bill clicks';
    list.append(item);
  }
}

async function runOnline(action) {
  if (!state.v2 || onlineBusy) return;
  onlineBusy = true;
  try {
    await action();
  } catch (error) {
    onlineStatus(error.message || 'Could not connect to the leaderboard.');
  } finally {
    onlineBusy = false;
  }
}

function showAccount(user) {
  onlineUser = user;
  get('account-form').hidden = Boolean(user);
  get('account-actions').hidden = !user;
  onlineStatus(user ? 'Signed in. Post your bill clicks to enter the leaderboard.' : 'Sign in to post your bill clicks.');
}

async function connectLeaderboard() {
  if (onlineClient || !leaderboardConfig.url || !leaderboardConfig.publishableKey) return;
  await runOnline(async () => {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    if (!state.v2) return;
    const client = createClient(leaderboardConfig.url, leaderboardConfig.publishableKey);
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    onlineClient = client;
    showAccount(data.session?.user);
    await refreshLeaderboard();
  });
}

get('v2-mode').addEventListener('change', connectLeaderboard);
get('account-form').addEventListener('submit', (event) => {
  event.preventDefault();
  runOnline(async () => {
    const fields = new FormData(event.currentTarget);
    const credentials = { email: fields.get('email'), password: fields.get('password') };
    const result = event.submitter?.value === 'signup'
      ? await onlineClient.auth.signUp(credentials)
      : await onlineClient.auth.signInWithPassword(credentials);
    if (result.error) throw result.error;
    get('account-form').reset();
    showAccount(result.data.session?.user);
    if (!result.data.session) onlineStatus('Check your email to confirm your account, then sign in.');
  });
});

get('post-score').addEventListener('click', () => runOnline(async () => {
  if (!onlineUser) return;
  const { error } = await onlineClient.from('money_press_scores').upsert({
    user_id: onlineUser.id,
    bank_name: state.bankName,
    bill_clicks: state.billClicks,
  });
  if (error) throw error;
  await refreshLeaderboard();
  onlineStatus('Score posted.');
}));

get('sign-out').addEventListener('click', () => runOnline(async () => {
  const { error } = await onlineClient.auth.signOut();
  if (error) throw error;
  showAccount(null);
}));

connectLeaderboard();
