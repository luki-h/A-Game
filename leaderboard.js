'use strict';

const leaderboardConfig = {
  url: 'https://upkkvczvobtgkacfbcxe.supabase.co',
  publishableKey: 'sb_publishable_o3kyAsd0JRdNXJWaW2JSCw_bWQnHpSx',
};
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
  const username = user?.user_metadata?.leaderboard_username;
  get('account-form').hidden = Boolean(username);
  get('account-actions').hidden = !username;
  onlineStatus(username ? 'Playing as ' + username + '.' : 'Choose a username to post your bill clicks.');
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
    const username = fields.get('username').trim();
    if (!username) {
      onlineStatus('Enter a username.');
      return;
    }
    const metadata = { leaderboard_username: username };
    const { data, error } = onlineUser
      ? await onlineClient.auth.updateUser({ data: metadata })
      : await onlineClient.auth.signInAnonymously({ options: { data: metadata } });
    if (error) throw error;
    showAccount(data.user);
  });
});

get('post-score').addEventListener('click', () => runOnline(async () => {
  if (!onlineUser) return;
  const { error } = await onlineClient.from('money_press_scores').upsert({
    user_id: onlineUser.id,
    bank_name: onlineUser.user_metadata.leaderboard_username,
    bill_clicks: state.billClicks,
  });
  if (error) throw error;
  await refreshLeaderboard();
  onlineStatus('Score posted.');
}));

connectLeaderboard();
