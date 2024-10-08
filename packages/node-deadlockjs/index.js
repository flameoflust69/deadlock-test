/** @typedef {import("steam-user")} SteamUser **/
import { uncompressSync } from "snappy";
import { EventEmitter } from "events";

import { CMsgClientHello, CMsgConnectionStatus, GCConnectionStatus, CGCMsgCompressedMsgToClient } from "deadlockjs/protobufs/generated/gcsdk_gcmessages.js";
import { CMsgClientToGCGetActiveMatches, CMsgClientToGCGetActiveMatchesResponse } from "deadlockjs/protobufs/generated/citadel_gcmessages_client.js";
import { Logger } from "../../src/logger/index.js";

const STEAM_APPID = 1422450;
const DEFAULT_HELLO_DELAY = 1000;
const logger = Logger.getInstance().logger;

export class Deadlock extends EventEmitter {
    /** @type {SteamUser} */
    #steamClient

    /** @type {number} */
    #appID

    /** @type {boolean} */
    #isInGame

    /** @type {NodeJS.Timeout | undefined | null} */
    #helloTimer

    /** @type {number | undefined | null} */
    #helloTimerMs

    /**
     * @param {SteamUser} steam 
     */
    constructor(steam) {
        super();
        this.#steamClient = steam;
        this.#appID = STEAM_APPID;
        this.#isInGame = false;
        this.haveGCSession = false;
        this.#steamClient.on('appLaunched', this.#onAppLaunched.bind(this));
        this.#steamClient.on('receivedFromGC', (appid, msgType, payload) => {
            if (appid !== this.#appID) {
                return;
            }

            switch (msgType) {
                case 523: {
                    // k_EMsgGCCompressedMsgToClient_Legacy
                    this.#onGCCompressedMsgToClient_Legacy(payload);
                }
                case 4004: {
                    // k_EMsgGCClientWelcome 
                    this.#onGCClientWelcome(payload);
                    break;
                }
                case 4009: {
                    // k_EMsgGCClientConnectionStatus
                    this.#onGCClientConnectionStatus(payload);
                    break;
                }
                default: {
                    // logger.debug(`[Deadlock] Got unhandled GC message type: ${msgType}`)
                }
            }
        });
        logger.debug("[Deadlock] constructor called");
    }

    launch() {
        logger.debug("[Deadlock] launching the game...");
        this.#steamClient.gamesPlayed([this.#appID]);
    }

    /**
     * @param {number} appID 
     */
    #onAppLaunched(appID) {
        if (this.#isInGame || appID !== this.#appID) {
            return;
        }

        if (appID === this.#appID) {
            this.#isInGame = true;
            if (!this.haveGCSession) {
                this.#connect();
            }
        }
    }

    #connect() {
        if (!this.#isInGame || this.#helloTimer) {
            logger.info("[Deadlock] Not trying to connect due to " + (!this.#isInGame ? "not in Deadlock" : "helloTimer exist"))
            return;
        }

        let sendClientHello = () => {
            if (!this.#isInGame || this.haveGCSession) {
                logger.info('[Deadlock] Not sending hello because ' + (!this.#isInGame ? 'we\'re no longer in Deadlock' : 'we have a session'));
                if (this.#helloTimer) {
                    clearTimeout(this.#helloTimer);
                    this.#helloTimer = null;
                    this.#helloTimerMs = null;
                }
            }

            this.#send(4006, CMsgClientHello, {});

            this.#helloTimerMs = Math.min(60000, (this.#helloTimerMs || DEFAULT_HELLO_DELAY) * 2);
            this.#helloTimer = setTimeout(sendClientHello, this.#helloTimerMs);
            logger.info(`[Deadlock] Sending hello, setting timer for next attempt to ${this.#helloTimerMs} ms`);
        };


        this.#helloTimer = setTimeout(sendClientHello, 500);
    }

    #send(type, protobuf, body) {
        if (!this.#steamClient.steamID) {
            return false;
        }

        if (protobuf) {
            this.#steamClient.sendToGC(this.#appID, type, {}, protobuf.encode(body).finish());
        } else {
            // This is a ByteBuffer
            this.#steamClient.sendToGC(this.#appID, type, null, body.flip().toBuffer());
        }

        return true;
    };

    /**
     * @param {Buffer} payload 
     */
    #onGCClientWelcome(payload) {
        clearTimeout(this.#helloTimer);
        this.haveGCSession = true;
        this.#helloTimer = null;
        this.#helloTimerMs = null;
        this.emit('connectedToGC');
    }

    /**
     * @param {Buffer} payload
     */
    #onGCClientConnectionStatus(payload) {
        const protoDecoded = CMsgConnectionStatus.decode(payload);

        switch (protoDecoded.status) {
            case GCConnectionStatus.GCConnectionStatus_HAVE_SESSION:
                logger.debug(protoDecoded.toJSON(), "[Deadlock] GC connection regained.");
                logger.debug(`[Deadlock] haveGCSession=${this.haveGCSession}`)

                if (this.#helloTimer) {
                    clearTimeout(this.#helloTimer);
                    this.#helloTimer = null;
                    this.#helloTimerMs = null;
                    this.haveGCSession = true;
                    this.emit('connectedToGC');
                }
                break;

            default:
                logger.debug(protoDecoded.toJSON(), "[Deadlock] Connection unreliable")
                logger.debug(`[Deadlock] haveGCSession=${this.haveGCSession}`)

                if (!this.#helloTimer) {
                    logger.debug("[Deadlock] disconnected from GC, trying to reconnect!")
                    this.haveGCSession = false;
                    this.#connect();
                }
                break;
        }
    }

    /**
     * @param {Buffer} payload 
     */
    #onGCCompressedMsgToClient_Legacy(payload) {
        const protoDecoded = CGCMsgCompressedMsgToClient.decode(payload);

        if(protoDecoded.msg_id === 9204) {
            // k_EMsgClientToGCGetActiveMatchesResponse
            const uncompressedPacketBuffer = uncompressSync(protoDecoded.compressed_msg);
          
            const matchesResponseDecoded = CMsgClientToGCGetActiveMatchesResponse.decode(uncompressedPacketBuffer);

            logger.info(matchesResponseDecoded.toJSON())
        }

    }

    requestActiveMatches() {
        this.#send(9203, CMsgClientToGCGetActiveMatches, {});
    };
}

export default Deadlock;