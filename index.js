/* eslint-disable camelcase */
import * as Misskey from 'misskey-js';
import schedule from 'node-schedule';
import * as dotenv from 'dotenv';

// eslint-disable-next-line import/extensions
import CoopMessageMaker from './message-maker.js';
// eslint-disable-next-line import/extensions
import BattleMessageMaker from './battle-message-maker.js';

// 設定項目読み込み
dotenv.config({ quiet: true });
const {
  MISSKEY_URL,
  GRIZZCO_BOT_TOKEN,
  BANKARA_BOT_TOKEN,
  COOP_JSON_URL,
  COOP_TEAMCONTEST_JSON_URL,
  BATTLE_API_BASE,
  npm_package_version,
} = process.env;

process.title = 'Ikaskey Misskey Bot';

// Misskeyへ接続 (2アカウント維持)
/**
 * Misskey client for coop (Salmon Run / バチコン) - grizzco アカウント.
 * @since v3.0.0
 * @type {Misskey.api.APIClient}
 */
const grizzcoClient = new Misskey.api.APIClient({
  origin: MISSKEY_URL,
  credential: GRIZZCO_BOT_TOKEN,
});

/**
 * Misskey client for battle (Regular/Bankara/X/Event) - bankara アカウント.
 * @since v3.0.0
 * @type {Misskey.api.APIClient}
 */
const bankaraClient = new Misskey.api.APIClient({
  origin: MISSKEY_URL,
  credential: BANKARA_BOT_TOKEN,
});

// 追加用のスケジューラーを空で用意
/**
 * Blank variable for scheduler.
 * @since v1.0.0
 * @type {schedule}
 */
let salmonjobExtra;

// 現在時刻を取得する
/**
 * Get UNIX Time now.
 * @since v1.0.0
 * @return {number} - UNIX time now.
 */
const getNowUnixTime = () => {
  const now = Date.now() / 1000;
  return now;
};

// JSON取得用function
/**
 * Fetch JSON from a URL. Throws on non-2xx responses to keep the
 * previous axios behavior intact.
 * @since v2.0.0
 * @param {string} url - URL to fetch.
 * @returns {Promise<Object>} - Parsed JSON response.
 */
const fetchJson = async (url) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
  }
  return res.json();
};

// メッセージ送信用function
/**
 * Send message to Misskey via the given client.
 * @since v3.0.0
 * @param {Misskey.api.APIClient} client - Misskey API client to post via.
 * @param {string} msg - Message to send.
 * @param {string|null} visibility - Visibility setting.
 * @param {string|null} cw - Content warning.
 * @param {string|null} replyId - Note ID to reply to.
 * @returns {Promise<void>}
 */
const sendMessage = async (client, msg, visibility = null, cw = null, replyId = null) => {
  console.log('func: sendMessage');
  const args = { text: msg };
  if (visibility) {
    args.visibility = visibility;
  }
  if (cw) {
    args.cw = cw;
  }
  if (replyId) {
    args.replyId = replyId;
  }
  await client.request('notes/create', args).catch((e) => {
    console.error(e);
  });
};

// =============================================================================
// COOP (サーモンラン + バチコン) -- posts via grizzcoClient
// =============================================================================

// サーモンランルール
/**
 * Make and send Salmon Run / バチコン message to Misskey (grizzco account).
 * @since v1.0.0
 * @returns {Promise<void>}
 */
const salmonrun = async () => {
  try {
    const res = await fetchJson(COOP_JSON_URL);

    // スケジュールを分類
    const regular = res.results.filter((shift) => shift.is_big_run === false);
    const bigrun = res.results.filter((shift) => shift.is_big_run === true);

    // 現在時刻を取得
    const nowUnix = getNowUnixTime();

    // もしビッグランのスケジュールがなければ
    if (bigrun.length === 0) {
      // 終了時刻を取得
      let end = new Date(regular[0].end_time);
      let endUnix = end.getTime() / 1000;

      // 残り時間を計算
      let restOfHours = Math.ceil((endUnix - nowUnix) / (60 * 60));

      // もし残り時間が0時間なら次のシフトを基準にしたい
      let i = 0;
      if (restOfHours === 0) {
        i = 1;

        // 対象で計算し直し
        end = new Date(regular[i].end_time);
        endUnix = end.getTime() / 1000;
        restOfHours = Math.ceil((endUnix - nowUnix) / (60 * 60));
      }

      const now = new CoopMessageMaker(regular[i], restOfHours);
      let msg = now.maker();

      // もし残りが2時間なら次のシフトのお知らせを追加
      if (restOfHours === 2) {
        const next = new CoopMessageMaker(regular[i + 1], 40, false, true);

        msg += '\n---\n';
        msg += next.maker();

        // 一回だけ1時間おきにしたいので、追加する
        const extraDate = new Date(regular[i].end_time);
        const extraNoteDate = (extraDate.getTime() / 1000 - 60 * 60) * 1000;
        console.log(extraNoteDate.toLocaleString());
        // eslint-disable-next-line no-use-before-define
        salmonjobExtra = schedule.scheduleJob(extraNoteDate, () => {
          salmonrunextra();
        });
        console.log(`set: salmonrunextra at ${extraNoteDate}`);
      }
      console.log(msg);
      sendMessage(grizzcoClient, msg);
    }
    // ビッグランのシフトがあったら
    // 今がビッグランのシフトだったら
    else if (Date(bigrun[0].start_time).getTime() / 1000 < getNowUnixTime()) {
      // 終了時刻を取得
      const end = new Date(bigrun[0].end_time);
      const endUnix = end.getTime() / 1000;

      // 残り時間を計算
      const restOfHours = Math.ceil((endUnix - nowUnix) / (60 * 60));

      // もし残り時間が0時間なら次のシフトを基準にしたい
      let i = 0;
      if (restOfHours === 0) {
        i = 1;
      }

      const now = new CoopMessageMaker(bigrun[i], restOfHours, false, false, true);
      let msg = now.maker();
      // もし残りが2時間なら次のシフトのお知らせを追加
      if (restOfHours === 2) {
        const next = new CoopMessageMaker(regular[0], 40, false, true);

        msg += '\n---\n';
        msg += next.maker();

        // 一回だけ1時間おきにしたいので、追加する
        const extraDate = new Date(regular[0].end_time);
        const extraNoteDate = (extraDate.getTime() / 1000 - 60 * 60) * 1000;
        console.log(extraNoteDate.toLocaleString());
        // eslint-disable-next-line no-use-before-define
        salmonjobExtra = schedule.scheduleJob(extraNoteDate, () => {
          salmonrunextra();
        });
        console.log(`set: salmonrunextra at ${extraNoteDate}`);
      }
      sendMessage(grizzcoClient, msg);
    }
    // この先ビッグランの予定があるときは
    else {
      // 終了時刻を取得
      let end = new Date(bigrun[0].end_time);
      let endUnix = end.getTime() / 1000;

      // 残り時間を計算
      let restOfHours = Math.ceil((endUnix - nowUnix) / (60 * 60));

      // もし残り時間が0時間なら次のシフトを基準にしたい
      let i = 0;
      if (restOfHours === 0) {
        i = 1;

        // 対象で計算し直し
        end = new Date(bigrun[i].end_time);
        endUnix = end.getTime() / 1000;
        restOfHours = Math.ceil((endUnix - nowUnix) / (60 * 60));
      }

      const now = new CoopMessageMaker(regular[i], restOfHours);
      let msg = now.maker();

      // もし残りが2時間なら次のシフトのお知らせを追加
      if (restOfHours === 2) {
        // ビッグランよりも通常シフトが先なら次のシフトの情報を挟む
        if (Date(regular[i + 1].start_time) < DataView(bigrun[0].start_time)) {
          const next = new CoopMessageMaker(regular[i + 1], 40, false, true);
          const nextbigrun = new CoopMessageMaker(bigrun[0], 48, false, false, true, false, true);

          msg += '\n---\n';
          msg += next.maker();
          msg += '\n---\n';
          msg += nextbigrun.maker();
        }
        // 次がビッグランだったら次の情報として繋ぐ
        else {
          const nextbigrun = new CoopMessageMaker(bigrun[0], 48, false, true, true, false, true);
          msg += '\n---\n';
          msg += nextbigrun.maker();
        }

        // 一回だけ1時間おきにしたいので、追加する
        const extraDate = new Date(regular[0].end_time);
        const extraNoteDate = (extraDate.getTime() / 1000 - 60 * 60) * 1000;
        console.log(extraNoteDate.toLocaleString());
        // eslint-disable-next-line no-use-before-define
        salmonjobExtra = schedule.scheduleJob(extraNoteDate, () => {
          salmonrunextra();
        });
        console.log(`set: salmonrunextra at ${extraNoteDate}`);
      }
      // ビッグランの情報を付ける
      else {
        const nextbigrun = new CoopMessageMaker(bigrun[0], 48, false, false, true, false, true);
        msg += '\n---\n';
        msg += nextbigrun.maker();
      }

      sendMessage(grizzcoClient, msg);
    }

    const teamcontestRes = await fetchJson(COOP_TEAMCONTEST_JSON_URL);
    const teamcontest = teamcontestRes.results;

    if (teamcontest.length > 0) {
      if (Date(teamcontest[0].start_time).getTime() / 1000 > nowUnix) {
        const nextteamcontest = new CoopMessageMaker(
          teamcontest[0],
          48,
          false,
          true,
          false,
          true,
          false
        );
        sendMessage(grizzcoClient, nextteamcontest.maker());
      } else {
        // 残り時間を計算
        const restOfHours = Math.ceil(
          (Date(teamcontest[0].end_time).getTime() / 1000 - nowUnix) / (60 * 60)
        );

        const nextteamcontest = new CoopMessageMaker(
          teamcontest[0],
          restOfHours,
          false,
          false,
          false,
          true,
          false
        );
        sendMessage(grizzcoClient, nextteamcontest.maker());
      }
    }
  } catch (e) {
    console.error(e);
    sendMessage(
      grizzcoClient,
      '$[x2 :error:]\nAPIのデータに問題があるため、定時のシフトのお知らせができませんでした。'
    );
  }
};

// 追加で1時間分流す時の分
/**
 * Send the last hour Salmon Run message to Misskey (grizzco account).
 * @since v1.0.0
 * @returns {Promise<void>}
 */
const salmonrunextra = async () => {
  const res = await fetchJson(COOP_JSON_URL);

  // 現在時刻を取得
  const nowUnix = getNowUnixTime();

  // スケジュールを分類
  const regular = res.results.filter((shift) => shift.is_big_run === false);
  const bigrun = res.results.filter((shift) => shift.is_big_run === true);

  let msg = '';
  // レギュラーが時間内だったら、レギュラーを対象にする。それ以外はビッグラン扱い。
  if (
    Date(regular[0].start_time).getTime() / 1000 < nowUnix &&
    Date(regular[0].end_time).getTime() / 1000 > nowUnix
  ) {
    const now = new CoopMessageMaker(regular[0], 1, true);
    let nextShift;
    if (bigrun.length === 0 || Date(regular[1].start_time) < Date(bigrun[0].start_time)) {
      [, nextShift] = regular;
    } else {
      [nextShift] = bigrun;
    }
    const next = new CoopMessageMaker(nextShift, 40, false, true);
    msg += now.maker();
    msg += '\n---\n';
    msg += next.maker();
  } else {
    const now = new CoopMessageMaker(bigrun[0], 1, true, false, true);
    const next = new CoopMessageMaker(regular[0], 40, false, true);
    msg += now.maker();
    msg += '\n---\n';
    msg += next.maker();
  }

  console.log(msg);
  sendMessage(grizzcoClient, msg);
  salmonjobExtra.cancel();
  console.log('cancel: salmonrunextra');
};

// スケジュール。奇数時間の正時に実行。
/**
 * Salmon Run / バチコン schedule.
 * @since v1.0.0
 * @type {schedule.Job}
 */
// eslint-disable-next-line no-unused-vars
const salmonjob = schedule.scheduleJob('0 0 1-23/2 * * *', () => {
  salmonrun();
});

// =============================================================================
// BATTLE (Regular/Bankara/X/Event) -- posts via bankaraClient
// Modernized port from sasagar/bankara-misskey-bot (axios -> native fetch).
// =============================================================================

/**
 * Fetch all battle schedules from spla3 API.
 * @since v3.0.0
 * @returns {Promise<Object|null>} - Combined schedule object, or null on error.
 */
const getBattleJson = async () => {
  try {
    const [regular, bankaraOpen, bankaraChallenge, x, eventTmp] = await Promise.all([
      fetchJson(`${BATTLE_API_BASE}/regular/schedule`),
      fetchJson(`${BATTLE_API_BASE}/bankara-open/schedule`),
      fetchJson(`${BATTLE_API_BASE}/bankara-challenge/schedule`),
      fetchJson(`${BATTLE_API_BASE}/x/schedule`),
      fetchJson(`${BATTLE_API_BASE}/event/schedule`),
    ]);
    return {
      regular: regular.results,
      bankara_open: bankaraOpen.results,
      bankara_challenge: bankaraChallenge.results,
      x: x.results,
      event: eventTmp.results.filter((e) => e.rule != null),
    };
  } catch (e) {
    console.error(e);
    sendMessage(
      bankaraClient,
      '$[x2 :error:]\nAPIのデータに問題があるため、定時のシフトのお知らせができませんでした。'
    );
    return null;
  }
};

/**
 * Build a "now + next" note for a battle category and send it (bankara account).
 * @since v3.0.0
 * @param {Object[]} shift - Schedule array for the category.
 * @param {number} index - Index of the current shift.
 * @param {string} category - Category name (e.g. "レギュラーマッチ").
 * @returns {void}
 */
const sendBattleNote = (shift, index = 0, category = '') => {
  console.log('func: sendBattleNote');
  try {
    const noteNow = new BattleMessageMaker(shift[index], category, true);
    const noteNext = new BattleMessageMaker(shift[index + 1], category, false);
    const noteMsg = `${noteNow.maker()}\n---\n${noteNext.maker()}`;
    sendMessage(bankaraClient, noteMsg);
  } catch (e) {
    console.error(e);
    sendMessage(bankaraClient, `$[x2 :error:]\nNoteの送信に失敗しました。(${category})`);
  }
};

/**
 * Build and send the event-match note (bankara account).
 * @since v3.0.0
 * @param {Object[]} events - Event schedule array.
 * @param {Date} now - Current Date used for comparison against start_time.
 * @returns {void}
 */
const sendEventNote = (events, now) => {
  console.log('func: sendEventNote');
  let eventNow;
  let eventNext;
  if (events.length >= 2 && now > events[0].start_time) {
    eventNow = new BattleMessageMaker(events[0], 'イベントマッチ', true);
    eventNext = new BattleMessageMaker(events[1], 'イベントマッチ', false);
  } else {
    eventNow = new BattleMessageMaker(events[0], 'イベントマッチ', false);
  }

  let eventMsg = eventNow.maker();
  if (eventNext != null) {
    eventMsg += `\n---\n${eventNext.maker()}`;
  }
  sendMessage(bankaraClient, eventMsg);
};

/**
 * Make and send all battle messages to Misskey (bankara account).
 * @since v3.0.0
 * @returns {Promise<void>}
 */
const battle = async () => {
  console.log('func: battle');
  const res = await getBattleJson();
  if (!res) return;
  const now = new Date();
  const regularTime = new Date(res.regular[0].end_time);

  const i = regularTime < now ? 1 : 0;

  sendBattleNote(res.regular, i, 'レギュラーマッチ');
  sendBattleNote(res.bankara_open, i, 'バンカラマッチ（オープン）');
  sendBattleNote(res.bankara_challenge, i, 'バンカラマッチ（チャレンジ）');
  sendBattleNote(res.x, i, 'Xマッチ');

  try {
    if (res.event.length > 1) {
      sendEventNote(res.event, now);
    }
  } catch (e) {
    console.error(e);
    sendMessage(bankaraClient, '$[x2 :error:]\nNoteの送信に失敗しました。(イベントマッチ)');
  }
};

/**
 * Battle schedule (every odd hour, same cadence as coop).
 * @since v3.0.0
 * @type {schedule.Job}
 */
// eslint-disable-next-line no-unused-vars
const battlejob = schedule.scheduleJob('0 0 1-23/2 * * *', () => {
  battle();
});

// =============================================================================
// Startup notice — sent from both accounts so each Bot's followers see it.
// =============================================================================

/**
 * Send up message to Misskey from both bot accounts.
 * @since v3.0.0
 * @returns {void}
 */
const upNotice = () => {
  const msg = `【Bot再起動通知】v${npm_package_version} で起動しました。`;
  console.log('[upNotice] Misskey bot up!');
  sendMessage(grizzcoClient, msg);
  sendMessage(bankaraClient, msg);
};

upNotice();
