/* eslint-disable camelcase */
import * as Misskey from 'misskey-js';
import axios from 'axios';
import schedule from 'node-schedule';
import * as dotenv from 'dotenv';

// eslint-disable-next-line import/extensions
import MessageMaker from './message-maker.js';

// 設定項目読み込み
dotenv.config();
const { BOT_TOKEN, MISSKEY_URL, JSON_URL, npm_package_version } = process.env;

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

        // もしビッグランのスケジュールがなければ
        if (res.data.bigrun.length === 0) {

            // 終了時刻を取得
            let endUnix = res.data.regular[0].endunix;
            // 現在時刻を取得
            const nowUnix = getNowUnixTime();

            // 残り時間を計算
            let restOfHours = Math.ceil((endUnix - nowUnix) / (60 * 60));

            // もし残り時間が0時間なら次のシフトを基準にしたい
            let i = 0;
            if (restOfHours === 0) {
                i = 1;

                // 対象で計算し直し
                endUnix = res.data.regular[i].endunix;
                restOfHours = Math.ceil((endUnix - nowUnix) / (60 * 60));
            }

            const now = new MessageMaker(res.data.regular[i], restOfHours);
            let msg = now.maker();

            // もし残りが2時間なら次のシフトのお知らせを追加
            if (restOfHours === 2) {
                const next = new MessageMaker(res.data.regular[i + 1], 40, false, true);

                msg += "\n---\n";
                msg += next.maker();

                // 一回だけ1時間おきにしたいので、追加する
                const extraNoteDate = new Date((res.data.regular[i].endunix - 60 * 60) * 1000);
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
        else if (res.data.bigrun[0].startunix < getNowUnixTime()) {
            // 終了時刻を取得
            const endUnix = res.data.bigrun[0].endunix;
            // 現在時刻を取得
            const nowUnix = getNowUnixTime();

            // 残り時間を計算
            const restOfHours = Math.ceil((endUnix - nowUnix) / (60 * 60));


            // もし残り時間が0時間なら次のシフトを基準にしたい
            let i = 0;
            if (restOfHours === 0) {
                i = 1;
            }

            const now = new MessageMaker(res.data.bigrun[i], restOfHours, false, false, true);
            let msg = now.maker();
            // もし残りが2時間なら次のシフトのお知らせを追加
            if (restOfHours === 2) {
                const next = new MessageMaker(res.data.regular[i + 1], 40, false, true);

                msg += "\n---\n";
                msg += next.maker();

                // 一回だけ1時間おきにしたいので、追加する
                const extraNoteDate = new Date((res.data.regular[i].endunix - 60 * 60) * 1000);
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
            let endUnix = res.data.regular[0].endunix;
            // 現在時刻を取得
            const nowUnix = getNowUnixTime();

            // 残り時間を計算
            let restOfHours = Math.ceil((endUnix - nowUnix) / (60 * 60));

            // もし残り時間が0時間なら次のシフトを基準にしたい
            let i = 0;
            if (restOfHours === 0) {
                i = 1;

                // 対象で計算し直し
                endUnix = res.data.regular[i].endunix;
                restOfHours = Math.ceil((endUnix - nowUnix) / (60 * 60));
            }

            const now = new MessageMaker(res.data.regular[i], restOfHours);
            let msg = now.maker();

            // もし残りが2時間なら次のシフトのお知らせを追加
            if (restOfHours === 2) {
                // ビッグランよりも通常シフトが先なら次のシフトの情報を挟む
                if (res.data.regular[i + 1].startunix < res.data.bigrun[0].startunix) {
                    const next = new MessageMaker(res.data.regular[i + 1], 40, false, true);
                    const bigrun = new MessageMaker(res.data.bigrun[0], 48, false, false, true, false, true);

                    msg += "\n---\n";
                    msg += next.maker();
                    msg += "\n---\n";
                    msg += bigrun.maker();
                }
                // 次がビッグランだったら次の情報として繋ぐ
                else {
                    const bigrun = new MessageMaker(res.data.bigrun[0], 48, false, true, true, false, true);
                    msg += "\n---\n";
                    msg += bigrun.maker();
                }

                // 一回だけ1時間おきにしたいので、追加する
                const extraNoteDate = new Date((res.data.regular[i].endunix - 60 * 60) * 1000);
                console.log(extraNoteDate.toLocaleString());
                // eslint-disable-next-line no-use-before-define
                salmonjobExtra = schedule.scheduleJob(extraNoteDate, () => { salmonrunextra() });
                console.log(`set: salmonrunextra at ${extraNoteDate}`);
            }

            sendMessage(msg);
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

    let msg = ''
    // レギュラーが時間内だったら、レギュラーを対象にする。それ以外はビッグラン扱い。
    if (res.data.regular[0].startunix < nowUnix && res.data.regular[0].endunix > nowUnix) {
        const now = new MessageMaker(res.data.regular[0], 1, true);
        const next = new MessageMaker(res.data.regular[1], 40, false, true);
        msg += now.maker();
        msg += "\n---\n";
        msg += next.maker();
    } else {
        const now = new MessageMaker(res.data.bigrun[0], 1, true, false, true);
        const next = new MessageMaker(res.data.regular[0], 40, false, true);
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

// salmonrun();

// 起動時メッセージ
/**
 * Send up message to misskey
 * @since v1.0.0
 * @returns {void}
 */
const upNotice = () => {
    sendMessage(`【Bot再起動通知】v${npm_package_version} で起動しました。`);
}

upNotice();
