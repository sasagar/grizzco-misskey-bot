import fs from 'fs';
import { format, utcToZonedTime } from 'date-fns-tz';
// eslint-disable-next-line import/extensions
import ja from 'date-fns/locale/ja/index.js';

/**
 * Class to generate message.
 * @since v1.0.0
 * @param { Object } shift - Shift object.
 * @param { int } [restOfHours = 40] - Rest of hours of this shift.
 * @param { boolean } [isCountDown = false] - Flag of count down.
 * @param { boolean } [isNext = false] - Flag of Next shift.
 * @param { boolean } [isBigRun = false] - Flag of BigRun.
 * @param { boolean } [isContest = false] - Flag of Contest.
 * @param { boolean } [isFutureBigRun = false] - Flag of Future shift of Big Run.
 */
const MessageMaker = class {
    constructor(shift, restOfHours = 40, isCountDown = false, isNext = false, isBigRun = false, isContest = false, isFutureBigRun = false) {
        this.shift = shift;
        this.restOfHours = restOfHours;
        this.isCountDown = isCountDown;
        this.isNext = isNext;
        this.isBigRun = isBigRun;
        this.isContest = isContest;
        this.isFutureBigRun = isFutureBigRun;

        // ステージのバッジを選べるように
        /**
         * Object of stage badges.
         * @since v1.0.0
         * @type {Object}
         */
        this.stageBadges = JSON.parse(fs.readFileSync('./JSON/stages.json'));

        // ブキのバッジを選べるように
        /**
         * Object of weapon badges.
         * @since v1.0.0
         * @type {Object}
         */
        this.weaponBadges = JSON.parse(fs.readFileSync('./JSON/weapons.json'));
    }

    // ステージバッジ存在チェック
    /**
     * Getter: Get stage badge tag.
     * @since v1.0.0
     * @returns {string} - Badge image tag or blank string
     */
    get stageBadgeId() {
        let result;

        if (Reflect.has(this.stageBadges, this.shift.stage)) {
            result = this.stageBadges[this.shift.stage];
        } else {
            result = "";
        }

        return result;
    }

    // ステージ名返却
    /**
     * Getter: Cleaned up stage name.
     * @since v1.0.0
     * @returns {string} - Stage name or undef-text.
     */
    get stageName() {
        let stage = "不明"

        if (this.shift.stage !== "") {
            stage = this.shift.stage;
        }

        return stage;
    }

    // ブキバッジ存在チェック
    /**
     * Generate weapon badge tag.
     * @since v1.0.0
     * @param {string} name - Weapon name
     * @returns {string} - Badge image tag or blank string
     */
    weaponBadgeIdMaker = (name) => {
        let result;

        if (Reflect.has(this.weaponBadges, name)) {
            result = this.weaponBadges[name];
        } else {
            result = name;
        }

        return result;
    }



    // マルチにしたもの
    /**
     * Make message to send.
     * @since v1.0.0
     * @returns {string} - Message to send
     */
    maker() {
        console.log('func: message.maker');
        /** @type {string} */
        let msg = "";
        /** @type {boolean} */
        let random = false;

        if (this.isBigRun) {
            msg += ":big_run: ";
        }

        if (this.isCountDown) {
            msg += "$[shake まもなく終了！]";
            msg += "\n";
        }

        if (this.isBigRun) {
            msg += ":big_run_badge_gold:";
        } else if (this.isContest) {
            msg += ":btc_gold:";
        } else {
            msg += ":grizzco_bronze:";
        }

        msg += " ";

        if (this.isNext) {
            msg += "**次のシフト**";
        } else if (this.isFutureBigRun) {
            msg += "**ビッグランのお知らせ**";
        } else if (this.isBigRun) {
            msg += "**ただいまのビッグラン**";
        } else {
            msg += "**ただいまのシフト**";
        }

        if (this.isNext || this.isFutureBigRun) {
            msg += `${format(utcToZonedTime(new Date(this.shift.startunix * 1000), 'Asia/Tokyo'), 'M月d日(E) HH:mm', { locale: ja })}スタート！`;
        } else {
            msg += ` 残りおよそ **${this.restOfHours}時間**`;
        }

        msg += "\n";
        msg += "ステージ: ";
        if (!this.isBigRun) {
            msg += `${this.stageBadgeId}`;
        }
        msg += ` **${this.stageName}**`;
        msg += "\n";

        // ブキを並べる
        msg += "支給ブキ: ";
        this.shift.weapons.forEach(weapon => {
            const weaponBadge = this.weaponBadgeIdMaker(weapon.name);
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

        if (this.isNext || this.isFutureBigRun) {
            msg += "\n";
            msg += `${format(utcToZonedTime(new Date(this.shift.endunix * 1000), 'Asia/Tokyo'), 'M月d日(E) HH:mm', { locale: ja })}まで`;
        }

        return msg;

    }
}

export default MessageMaker;