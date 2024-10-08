import crypto from "crypto";

import SteamUser from "steam-user";

import { Logger } from "../logger/index.js";
import Deadlock from "deadlockjs";

const logger = Logger.getInstance().logger;

export class Citadel {
    /** @type {SteamUser} */
    #steamClient

    #deadlockClient

    constructor() {
        this.#steamClient = new SteamUser();
        this.#deadlockClient = new Deadlock(this.#steamClient);
        logger.debug("[Citadel] Trying to log on to Steam with username: " + process.env.STEAM_USERNAME);

        this.#steamClient.logOn({
            accountName: process.env.STEAM_USERNAME || '',
            password: process.env.STEAM_PASSWORD || '',
            clientOS: SteamUser.EOSType.Win11,
            machineName: crypto.randomBytes(10).toString('hex'),
        });

        this.#steamClient.on('loggedOn', this.#onSteamLoggedOn.bind(this));
        this.#steamClient.on('disconnected', this.#onSteamDisconnected.bind(this));
        this.#deadlockClient.once('connectedToGC', this.#onceConnectedToGC.bind(this))
        logger.debug("[Citadel] constructor called");
    }

    quit() {
        return new Promise((resolve) => {
            this.#steamClient.gamesPlayed([]);
            resolve(true);
        });
    }

    #onSteamLoggedOn(details) {
        if (details.eresult === SteamUser.EResult.OK) {
            logger.info(`[Citadel] Logged into Steam as ${process.env.STEAM_USERNAME} ${this.#steamClient.steamID?.getSteam3RenderedID()}`)
        }

        setTimeout(() => {
            this.#deadlockClient.launch();
        }, 1500);
    }

    /**
     * @param {SteamUser.EResult} eresult 
     * @param {string|undefined} msg 
     */
    #onSteamDisconnected(eresult, msg) {
        logger.error({ eresultCode: eresult, reason: msg }, "[Citadel] Steam disconnected")
    }

    #onceConnectedToGC() {
        logger.info("[Deadlock] Received client welcome from GC.");
        logger.debug(`[Deadlock] haveGCSession=${this.#deadlockClient.haveGCSession}`)
        logger.info("[Citadel] Connected to GC!")

        setTimeout(() => {
            this.#deadlockClient.requestActiveMatches();
        }, 3000);
    }
}

export default Citadel;