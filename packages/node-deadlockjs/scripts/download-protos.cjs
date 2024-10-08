const FS = require('fs');
const Path = require('path');
const { Readable } = require('stream');
const { finished } = require('stream/promises');

const PROTOBUFS_SRC_PATH = Path.join(__dirname, '..', 'protobufs');

const sleep = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

async function cleanup() {
    try {
        const dirContents = await FS.promises.readdir(PROTOBUFS_SRC_PATH, {
            withFileTypes: true,
        });
        const onlyProtoFiles = dirContents.filter(file => {
            return Path.extname(file.name) === '.proto';
        });

        for (const file of onlyProtoFiles) {
            const targetFile = Path.join(file.path, file.name);
            await FS.promises.unlink(targetFile)
        }
    } catch (err) {
        console.error(err);
    }
}

async function get_urls(fileUrls) {
    try {
        const response = await fetch('https://api.github.com/repos/SteamDatabase/GameTracking-Deadlock/contents/Protobufs');
        const data = await response.json();
        data.forEach(element => {
            if (element.type === 'file' && element.name.endsWith(".proto")) {
                fileUrls.push([element.download_url, element.name])
            }
        });
    } catch (error) {
        console.error('There was an error', error);
    }
}

async function main() {
    const fileUrls = []

    if (!FS.existsSync(PROTOBUFS_SRC_PATH)) {
        FS.mkdirSync(PROTOBUFS_SRC_PATH);
    }

    console.log("Cleanup old protos");
    await cleanup();
    await sleep(5000);
    console.log("Done cleanup");

    console.log("Getting download URLs")
    await get_urls(fileUrls);
    await sleep(5000);
    console.log("Done getting URLs");

    console.log("Download Protos");
    for (const file of fileUrls) {
        try {
            const fileOutputPath = Path.join(PROTOBUFS_SRC_PATH, file[1]);
            const stream = FS.createWriteStream(fileOutputPath);
            const response = await fetch(file[0]);
            await finished(Readable.fromWeb(response.body).pipe(stream));
            console.log(`[*] ${file[1]}`)
        } catch (error) {
            console.error(error);
        }
    }
    console.log("Done");
};

main();