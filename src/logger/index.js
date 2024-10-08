import pino from 'pino';

export class Logger {
    static #instance;

    constructor() {
        this.logger = pino({
            level: process.env.LOG_LEVEL || "info",
            timestamp: pino.stdTimeFunctions.isoTime,
            transport: {
                target: "pino-pretty",
                options: {
                    colorize: true,
                    colorizeObjects: true,
                    crlf: true,
                    ignore: "pid,hostname,pid",
                },
            },
        });
        this.logger.debug("[Logger] constructor called");
    }

    static getInstance() {
        if (!this.#instance) {
            this.#instance = new Logger();
        }

        return this.#instance;
    }
}

export default Logger;