'use strict';

const leaderboardConfig = {
  url: 'https://upkkvczvobtgkacfbcxe.supabase.co',
  publishableKey: 'sb_publishable_o3kyAsd0JRdNXJWaW2JSCw_bWQnHpSx',
};
let onlineClient;
let onlineUser;
let onlineBusy = false;

async function withConnectionTimeout(connect) {
  let timer;
  try {
    return await Promise.race([
      connect(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('The leaderboard connection timed out.')), 10000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function onlineStatus(message) {
  get('online-status').textContent = message;
}

async function refreshLeaderboard(signal) {
  const query = onlineClient.from('money_press_scores')
    .select('bank_name,bill_clicks').order('bill_clicks', { ascending: false }).limit(10);
  const { data, error } = await (signal ? query.abortSignal(signal) : query);
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
  const retry = get('retry-leaderboard');
  if (onlineClient && retry.hidden) return;
  await runOnline(async () => {
    retry.hidden = true;
    onlineStatus('Connecting to the leaderboard…');
    try {
      const { data, error } = await withConnectionTimeout(async () => {
        if (!onlineClient) {
          const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
          onlineClient ??= createClient(leaderboardConfig.url, leaderboardConfig.publishableKey);
        }
        return onlineClient.auth.getSession();
      });
      if (error) throw error;
      showAccount(data.session?.user);
      await refreshLeaderboard(AbortSignal.timeout(10000));
    } catch (error) {
      retry.hidden = false;
      throw error;
    }
  });
}

get('v2-mode').addEventListener('change', connectLeaderboard);
get('retry-leaderboard').addEventListener('click', connectLeaderboard);
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
    if (error?.code === 'anonymous_provider_disabled') {
      onlineStatus('Username signup is disabled. Enable anonymous sign-ins in Supabase to join.');
      return;
    }
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
