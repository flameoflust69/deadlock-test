import Citadel from './citadel/index.js';
import Logger from './logger/index.js';

const main = async () => {
    const logger = Logger.getInstance().logger;
    const citadel = new Citadel();

    process.on('uncaughtException', (err) => {
        logger.fatal(err, 'uncaught exception detected');

        setTimeout(() => {
            process.abort();
        }, 1000).unref()
        process.exit(1);
    });

    process.on('SIGTERM', () => {
        logger.info('SIGTERM signal received.');
        process.exit(0);
    });

    process.on('SIGINT', () => {
        logger.info('SIGINT signal received.');
        Promise.all([
            citadel.quit(),
        ]).then(() => {
            logger.info('Exiting...');
            process.exit(0);
        });
    });
};

main();