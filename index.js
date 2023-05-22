import * as Misskey from 'misskey-js';
import axios from 'axios';
import fs from 'fs';
import { format, utcToZonedTime } from 'date-fns-tz';
// eslint-disable-next-line import/extensions
import ja from 'date-fns/locale/ja/index.js';
import schedule from 'node-schedule';
import * as dotenv from 'dotenv';

// 設定項目読み込み
dotenv.config();
const { BOT_TOKEN, MISSKEY_URL, JSON_URL } = process.env;

// Misskeyへ接続
const cli = new Misskey.api.APIClient(
    {
        origin: MISSKEY_URL,
        credential: BOT_TOKEN
    });

// ステージのバッジを選べるように
const stageBadges = JSON.parse(fs.readFileSync('./JSON/stages.json'));

// 追加用のスケジューラーを空で用意
let salmonjobExtra;

// ブキのバッジを選べるように
const weaponBadges = JSON.parse(fs.readFileSync('./JSON/weapons.json'));

// 現在時刻を取得する
const getNowUnixTime = () => {
    const now = Date.now() / 1000;
    return now;
}

// ステージバッジ存在チェック
const stageBadgeIdMaker = (name) => {
    let result;

    if (Reflect.has(stageBadges, name)) {
        result = stageBadges[name];
    } else {
        result = "";
    }

    return result;
}

// ブキバッジ存在チェック
const weaponBadgeIdMaker = (name) => {
    let result;

    if (Reflect.has(weaponBadges, name)) {
        result = weaponBadges[name];
    } else {
        result = name;
    }

    return result;
}


// 今のシフトメッセージメーカー
const messageMakerNow = (shift, restOfHours) => {
    console.log('func: messageMakerNow');
    const stageBadge = stageBadgeIdMaker(shift.stage);

    let msg = "";
    msg += ":grizzco_bronze: **ただいまのシフト**";
    msg += ` 残りおよそ **${restOfHours}時間**`;
    msg += "\n";
    msg += `ステージ: ${stageBadge} **${shift.stage}**`;
    msg += "\n";

    // ブキを並べる
    msg += "支給ブキ: ";
    shift.weapons.forEach(weapon => {
        const weaponBadge = weaponBadgeIdMaker(weapon.name);
        msg += weaponBadge;
        msg += " ";
    });
    msg += "\n";

    msg += `${format(utcToZonedTime(new Date(shift.endunix * 1000), 'Asia/Tokyo'), 'M月d日(E) HH:mm', { locale: ja })}まで`;

    return msg;

}

// 今のシフトまもなく終了バージョン
const messageMakerNowInAnHour = (shift) => {
    console.log('func: messageMakerNowInAnHour');
    const stageBadge = stageBadgeIdMaker(shift.stage);

    let msg = "";
    let random = false;
    msg += "$[shake まもなく終了！]";
    msg += ":grizzco_bronze: **ただいまのシフト**";
    msg += " 残りおよそ **1時間**";
    msg += "\n";
    msg += `ステージ: ${stageBadge} **${shift.stage}**`;
    msg += "\n";

    // ブキを並べる
    msg += "支給ブキ: ";
    shift.weapons.forEach(weapon => {
        const weaponBadge = weaponBadgeIdMaker(weapon.name);
        msg += weaponBadge;
        msg += " ";
        if (weapon.name === 'ランダム') {
            random = true;
        }
    });
    if (random) {
        msg += "\n";
        msg += '<small>ランダムはクマブキランダムの場合があります。</small>';
    }
    msg += "\n";

    msg += `${format(utcToZonedTime(new Date(shift.endunix * 1000), 'Asia/Tokyo'), 'M月d日(E) HH:mm', { locale: ja })}まで`;

    return msg;

}

// 次のシフトメッセージメーカー
const messageMakerNext = (shift) => {
    console.log('func: messageMakerNext');
    const stageBadge = stageBadgeIdMaker(shift.stage);

    let msg = "";
    let random = false;
    msg += ":grizzco_bronze: **次のシフト**";
    msg += "\n";
    msg += `${format(utcToZonedTime(new Date(shift.startunix * 1000), 'Asia/Tokyo'), 'M月d日(E) HH:mm', { locale: ja })}スタート！`;
    msg += "\n";
    msg += `ステージ: ${stageBadge} **${shift.stage}**`;
    msg += "\n";

    // ブキを並べる
    msg += "支給ブキ: ";
    shift.weapons.forEach(weapon => {
        const weaponBadge = weaponBadgeIdMaker(weapon.name);
        msg += weaponBadge;
        msg += " ";
        if (weapon.name === 'ランダム') {
            random = true;
        }
    });
    if (random) {
        msg += "\n";
        msg += '<small>ランダムはクマブキランダムの場合があります。</small>';
    }

    return msg;
}

// 今のビッグランメッセージメーカー
const messageMakerNowBigRun = (shift, restOfHours) => {
    console.log('func: messageMakerNowBigRun');
    let msg = "";
    let random = false;
    msg += ":big_run:";
    msg += "\n";
    msg += ":big_run_badge_gold: **ただいまのシフト**";
    msg += ` 残りおよそ **${restOfHours}時間**`;
    msg += "\n";
    msg += `ステージ: **${shift.stage}**`;
    msg += "\n";

    // ブキを並べる
    msg += "支給ブキ: ";
    shift.weapons.forEach(weapon => {
        const weaponBadge = weaponBadgeIdMaker(weapon.name);
        msg += weaponBadge;
        msg += " ";
        if (weapon.name === 'ランダム') {
            random = true;
        }
    });
    if (random) {
        msg += "\n";
        msg += '<small>ランダムはクマブキランダムの場合があります。</small>';
    }
    msg += "\n";

    msg += `${format(utcToZonedTime(new Date(shift.endunix * 1000), 'Asia/Tokyo'), 'M月d日(E) HH:mm', { locale: ja })}まで`;

    return msg;
}

// 次のビッグランメッセージメーカー
const messageMakerNextBigRun = (shift) => {
    console.log('func: messageMakerNextBigRun');
    let msg = "";
    let random = false;
    msg += ":big_run:";
    msg += "\n";
    msg += ":big_run_badge_gold: **次のシフト**";
    msg += "\n";
    msg += `${format(utcToZonedTime(new Date(shift.startunix * 1000), 'Asia/Tokyo'), 'M月d日(E) HH:mm', { locale: ja })}スタート！`;
    msg += "\n";
    msg += `ステージ: **${shift.stage}**`;
    msg += "\n";

    // ブキを並べる
    msg += "支給ブキ: ";
    shift.weapons.forEach(weapon => {
        const weaponBadge = weaponBadgeIdMaker(weapon.name);
        msg += weaponBadge;
        msg += " ";
        if (weapon.name === 'ランダム') {
            random = true;
        }
    });
    if (random) {
        msg += "\n";
        msg += '<small>ランダムはクマブキランダムの場合があります。</small>';
    }

    return msg;
}

// この先のビッグランメッセージメーカー
const messageMakerFutureBigRun = (shift) => {
    console.log('func: messageMakerFutureBigRun');
    let msg = "";
    let random = false;
    msg += ":big_run:";
    msg += "\n";
    msg += ":big_run_badge_gold: **ビッグランのお知らせ**";
    msg += "\n";
    msg += `${format(utcToZonedTime(new Date(shift.startunix * 1000), 'Asia/Tokyo'), 'M月d日(E) HH:mm', { locale: ja })}スタート！`;
    msg += "\n";
    msg += `ステージ: **${shift.stage}**`;
    msg += "\n";

    // ブキを並べる
    msg += "支給ブキ: ";
    shift.weapons.forEach(weapon => {
        const weaponBadge = weaponBadgeIdMaker(weapon.name);
        msg += weaponBadge;
        msg += " ";
        if (weapon.name === 'ランダム') {
            random = true;
        }
    });
    if (random) {
        msg += "\n";
        msg += '<small>ランダムはクマブキランダムの場合があります。</small>';
    }

    return msg;
}

// 今のシフトまもなく終了バージョン ビッグラン
const messageMakerBigRunInAnHour = (shift) => {
    console.log('func: messageMakerNowInAnHour');
    let msg = "";
    let random = false;
    msg += "$[shake まもなく終了！] :big_run:";
    msg += ":big_run_badge_gold: **ただいまのビッグラン**";
    msg += " 残りおよそ **1時間**";
    msg += "\n";
    msg += `ステージ: **${shift.stage}**`;
    msg += "\n";

    // ブキを並べる
    msg += "支給ブキ: ";
    shift.weapons.forEach(weapon => {
        const weaponBadge = weaponBadgeIdMaker(weapon.name);
        msg += weaponBadge;
        msg += " ";
        if (weapon.name === 'ランダム') {
            random = true;
        }
    });
    if (random) {
        msg += "\n";
        msg += '<small>ランダムはクマブキランダムの場合があります。</small>';
    }
    msg += "\n";

    msg += `${format(utcToZonedTime(new Date(shift.endunix * 1000), 'Asia/Tokyo'), 'M月d日(E) HH:mm', { locale: ja })}まで`;

    return msg;

}

// メッセージ送信用function
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
const salmonrun = async () => {
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

        let msg = messageMakerNow(res.data.regular[i], restOfHours);

        // もし残りが2時間なら次のシフトのお知らせを追加
        if (restOfHours === 2) {
            msg += "\n---\n";
            msg += messageMakerNext(res.data.regular[i + 1]);

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

        let msg = messageMakerNowBigRun(res.data.bigrun[i], restOfHours);
        // もし残りが2時間なら次のシフトのお知らせを追加
        if (restOfHours === 2) {
            msg += "\n---\n";
            msg += messageMakerNext(res.data.regular[i + 1]);

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

        let msg = messageMakerNow(res.data.regular[i], restOfHours);

        // もし残りが2時間なら次のシフトのお知らせを追加
        if (restOfHours === 2) {
            // ビッグランよりも通常シフトが先なら次のシフトの情報を挟む
            if (res.data.regular[i + 1].startunix < res.data.bigrun[0].startunix) {
                msg += "\n---\n";
                msg += messageMakerNext(res.data.regular[i + 1]);
                msg += "\n---\n";
                msg += messageMakerFutureBigRun(res.data.bigrun[0]);
            }
            // 次がビッグランだったら次の情報として繋ぐ
            else {
                msg += "\n---\n";
                msg += messageMakerNextBigRun(res.data.bigrun[0]);
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

}

// 追加で1時間分流す時の分
const salmonrunextra = async () => {
    const res = await axios.get(JSON_URL);

    // 現在時刻を取得
    const nowUnix = getNowUnixTime();

    let msg = ''
    // レギュラ;ーが時間内だったら、レギュラーを対象にする。それ以外はビッグラン扱い。
    if (res.data.regular[0].startunix < nowUnix && res.data.regular[0].endunix > nowUnix) {

        msg += messageMakerNowInAnHour(res.data.regular[0]);
        msg += "\n---\n";
        msg += messageMakerNext(res.data.regular[1]);
    } else {
        msg += messageMakerBigRunInAnHour(res.data.bigrun[0]);
        msg += "\n---\n";
        msg += messageMakerNext(res.data.regular[0]);
    }

    console.log(msg);
    sendMessage(msg);
    salmonjobExtra.cancel();
    console.log('cancel: salmonrunextra');
}

// スケジュール。奇数時間の正時に実行。
// eslint-disable-next-line no-unused-vars
const salmonjob = schedule.scheduleJob('0 0 1-23/2 * * *', () => { salmonrun() });

// salmonrun();