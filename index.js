/* eslint-disable camelcase */
import * as Misskey from 'misskey-js';
import axios from 'axios';
import schedule from 'node-schedule';
import * as dotenv from 'dotenv';

// eslint-disable-next-line import/extensions
import MessageMaker from './message-maker.js';

// 設定項目読み込み
dotenv.config();
const { BOT_TOKEN, MISSKEY_URL, JSON_URL, npm_package_version, BTM_JSON_URL } = process.env;

process.title = 'Grizzco Misskey Bot';

// Misskeyへ接続
/**
 * Misskey Client
 * @since v1.0.0
 * @type {Misskey}
 * @instance
 */
const cli = new Misskey.api.APIClient(
    {
        origin: MISSKEY_URL,
        credential: BOT_TOKEN
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
 * @return {string} - UNIX time now.
 */
const getNowUnixTime = () => {
    const now = Date.now() / 1000;
    return now;
}

// メッセージ送信用function
/**
 * Send message to Misskey.
 * @since v1.0.0
 * @param {string} msg - Message to send. 
 * @param {boolean} visibility - Flag of visibility.
 * @param {boolean} cw - Flag of CW.
 * @param {string} replyId - User ID to reply.
 * @returns {void}
 */
const sendMessage = async (msg, visibility = null, cw = null, replyId = null) => {
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
    await cli.request('notes/create', args).catch(e => { console.error(e) });
}

// サーモンランルール
/**
 * Make and send message to Misskey.
 * @since v1.0.0
 * @returns {void}
 */
const salmonrun = async () => {
    try {
        const res = await axios.get(JSON_URL);

        // スケジュールを分類
        const regular = res.data.results.filter((shift) => shift.is_big_run === false);
        const bigrun = res.data.results.filter((shift) => shift.is_big_run === true);

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

            const now = new MessageMaker(regular[i], restOfHours);
            let msg = now.maker();

            // もし残りが2時間なら次のシフトのお知らせを追加
            if (restOfHours === 2) {
                const next = new MessageMaker(regular[i + 1], 40, false, true);

                msg += "\n---\n";
                msg += next.maker();

                // 一回だけ1時間おきにしたいので、追加する
                const extraDate = new Date(regular[i].end_time);
                const extraNoteDate = ((extraDate.getTime() / 1000) - 60 * 60) * 1000;
                console.log(extraNoteDate.toLocaleString());
                // eslint-disable-next-line no-use-before-define
                salmonjobExtra = schedule.scheduleJob(extraNoteDate, () => { salmonrunextra() });
                console.log(`set: salmonrunextra at ${extraNoteDate}`);
            }
            console.log(msg);
            sendMessage(msg);
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

            const now = new MessageMaker(bigrun[i], restOfHours, false, false, true);
            let msg = now.maker();
            // もし残りが2時間なら次のシフトのお知らせを追加
            if (restOfHours === 2) {
                const next = new MessageMaker(regular[0], 40, false, true);

                msg += "\n---\n";
                msg += next.maker();

                // 一回だけ1時間おきにしたいので、追加する
                const extraDate = new Date(regular[0].end_time);
                const extraNoteDate = ((extraDate.getTime() / 1000) - 60 * 60) * 1000;
                console.log(extraNoteDate.toLocaleString());
                // eslint-disable-next-line no-use-before-define
                salmonjobExtra = schedule.scheduleJob(extraNoteDate, () => { salmonrunextra() });
                console.log(`set: salmonrunextra at ${extraNoteDate}`);
            }
            sendMessage(msg);
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

            const now = new MessageMaker(regular[i], restOfHours);
            let msg = now.maker();

            // もし残りが2時間なら次のシフトのお知らせを追加
            if (restOfHours === 2) {
                // ビッグランよりも通常シフトが先なら次のシフトの情報を挟む
                if (Date(regular[i + 1].start_time) < DataView(bigrun[0].start_time)) {
                    const next = new MessageMaker(regular[i + 1], 40, false, true);
                    const nextbigrun = new MessageMaker(bigrun[0], 48, false, false, true, false, true);

                    msg += "\n---\n";
                    msg += next.maker();
                    msg += "\n---\n";
                    msg += nextbigrun.maker();
                }
                // 次がビッグランだったら次の情報として繋ぐ
                else {
                    const nextbigrun = new MessageMaker(bigrun[0], 48, false, true, true, false, true);
                    msg += "\n---\n";
                    msg += nextbigrun.maker();
                }

                // 一回だけ1時間おきにしたいので、追加する
                const extraDate = new Date(regular[0].end_time);
                const extraNoteDate = ((extraDate.getTime() / 1000) - 60 * 60) * 1000;
                console.log(extraNoteDate.toLocaleString());
                // eslint-disable-next-line no-use-before-define
                salmonjobExtra = schedule.scheduleJob(extraNoteDate, () => { salmonrunextra() });
                console.log(`set: salmonrunextra at ${extraNoteDate}`);
            }
            // ビッグランの情報を付ける
            else {
                const nextbigrun = new MessageMaker(bigrun[0], 48, false, false, true, false, true);
                msg += "\n---\n";
                msg += nextbigrun.maker();
            }

            sendMessage(msg);
        }

        const teamcontestRes = await axios.get(BTM_JSON_URL);
        const teamcontest = teamcontestRes.data.results;

        if (teamcontest.length > 0) {
            if (Date(teamcontest[0].start_time).getTime() / 1000 > nowUnix) {
                const nextteamcontest = new MessageMaker(teamcontest[0], 48, false, true, false, true, false);
                sendMessage(nextteamcontest.maker());
            } else {
                // 残り時間を計算
                const restOfHours = Math.ceil(((Date(teamcontest[0].end_time).getTime() / 1000) - nowUnix) / (60 * 60));

                const nextteamcontest = new MessageMaker(teamcontest[0], restOfHours, false, false, false, true, false);
                sendMessage(nextteamcontest.maker());
            }
        }
    } catch (e) {
        console.error(e);
        sendMessage('$[x2 :error:]\nAPIのデータに問題があるため、定時のシフトのお知らせができませんでした。');
    }

}

// 追加で1時間分流す時の分
/**
 * Send the last hour message to Misskey
 * @since v1.0.0
 * @returns {void}
 */
const salmonrunextra = async () => {
    const res = await axios.get(JSON_URL);

    // 現在時刻を取得
    const nowUnix = getNowUnixTime();

    // スケジュールを分類
    const regular = res.data.results.filter((shift) => shift.is_big_run === false);
    const bigrun = res.data.results.filter((shift) => shift.is_big_run === true);
    // const { regular, bigrun } = res.data;

    let msg = ''
    // レギュラーが時間内だったら、レギュラーを対象にする。それ以外はビッグラン扱い。
    if ((Date(regular[0].start_time).getTime() / 1000) < nowUnix && (Date(regular[0].end_time).getTime() / 1000) > nowUnix) {
        const now = new MessageMaker(regular[0], 1, true);
        let nextShift;
        if (bigrun.length === 0 || Date(regular[1].start_time) < Date(bigrun[0].start_time)) {
            [, nextShift] = regular;
        } else {
            [nextShift] = bigrun;
        }
        const next = new MessageMaker(nextShift, 40, false, true);
        msg += now.maker();
        msg += "\n---\n";
        msg += next.maker();
    } else {
        const now = new MessageMaker(bigrun[0], 1, true, false, true);
        const next = new MessageMaker(regular[0], 40, false, true);
        msg += now.maker();
        msg += "\n---\n";
        msg += next.maker();
    }

    console.log(msg);
    sendMessage(msg);
    salmonjobExtra.cancel();
    console.log('cancel: salmonrunextra');
}

// スケジュール。奇数時間の正時に実行。
/**
 * Regular schedule.
 * @since v1.0.0
 * @type {schedule}
 */
// eslint-disable-next-line no-unused-vars
const salmonjob = schedule.scheduleJob('0 0 1-23/2 * * *', () => { salmonrun() });

/**
 * Return time.
 * @since v1.0.1
 * @param {int} restOfHours - Rest of hours of the shift.
 * @param {Object} data - Shift object.
 * @param {int} nowUnix - Unix Time of now.
 * @returns {Object} - New end time and new rest of hours.
 */
// const returnTime = (restOfHours, data, nowUnix) => {
//     let newEndUnix;
//     let newRestOfHours;
//     if (restOfHours === 0) {
//         newEndUnix = data[1].endunix;
//         newRestOfHours = Math.ceil((newEndUnix - nowUnix) / (60 * 60));
//     } else {
//         newEndUnix = data[0].endunix;
//         newRestOfHours = Math.ceil((newEndUnix - nowUnix) / (60 * 60));
//     }
//     return { newEndUnix, newRestOfHours };
// }

// salmonrun();

// 起動時メッセージ
/**
 * Send up message to misskey
 * @since v1.0.0
 * @returns {void}
 */
const upNotice = () => {
    console.log('[upNotice] Misskey bot up!');
    sendMessage(`【Bot再起動通知】v${npm_package_version} で起動しました。`);
}

upNotice();
