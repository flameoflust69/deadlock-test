const FS = require('fs');
const util = require('util');
const Path = require('path');
const pbjs = require("protobufjs-cli/pbjs");
const pbts = require("protobufjs-cli/pbts");

const pbjsMain = util.promisify(pbjs.main);
const pbtsMain = util.promisify(pbts.main);

const PROTOBUFS_SRC_PATH = Path.join(__dirname, '..', 'protobufs');
const GENERATED_DIR = Path.join(__dirname, '..', 'protobufs', 'generated');

if (!FS.existsSync(GENERATED_DIR)) {
    FS.mkdirSync(GENERATED_DIR);
}

const sleep = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

async function cleanup(extFile) {
    try {
        const dirContents = await FS.promises.readdir(GENERATED_DIR, {
            withFileTypes: true,
        });
        const onlyExtFiles = dirContents.filter(file => {
            return Path.extname(file.name) === extFile;
        });

        for (const file of onlyExtFiles) {
            const targetFile = Path.join(file.path, file.name);
            await FS.promises.unlink(targetFile)
        }
    } catch (err) {
        console.error(err);
    }
}

async function main() {
    let onlyProtoFiles = [];
    try {
        const dirContents = await FS.promises.readdir(PROTOBUFS_SRC_PATH, {
            withFileTypes: true,
        });
        onlyProtoFiles = dirContents.filter(file => {
            return Path.extname(file.name) === '.proto';
        });
    } catch (err) {
        console.error(err);
    }

    await cleanup('.js');
    await sleep(5000);

    console.log("Generating *.js files");
    for (const file of onlyProtoFiles) {
        const fName = file.name;
        if (!fName.match(/\.proto$/)) {
            return;
        }
        let generatedFilename = fName.replace('.proto', '.js');
        let protoGeneratedPath = Path.join(GENERATED_DIR, generatedFilename);
        let protoSrcPath = Path.join(PROTOBUFS_SRC_PATH, fName);

        // https://github.com/protobufjs/protobuf.js/issues/1862
        // pbjs.main(["--target", "static-module", "-w", "scripts/wrapper.js", "--dependency", "protobufjs/minimal.js", "--es6", "--keep-case", "--out", protoGeneratedPath, protoSrcPath]);
        await pbjsMain(["--target", "static-module", "-w", "scripts/wrapper.js", "--dependency", "protobufjs/minimal.js", "--es6", "--keep-case", "--out", protoGeneratedPath, protoSrcPath]);
    }

    await cleanup('.ts');
    await sleep(5000);
    console.log("Generating *.d.ts files");
    for (const file of onlyProtoFiles) {
        const fName = file.name;
        if (!fName.match(/\.proto$/)) {
            return;
        }
        let generatedFilename = fName.replace('.proto', '.js');
        let protoGeneratedPath = Path.join(GENERATED_DIR, generatedFilename);

        // pbts.main(["--out", protoGeneratedPath.replace('.js', '.d.ts'), protoGeneratedPath]);
        await pbtsMain(["--out", protoGeneratedPath.replace('.js', '.d.ts'), protoGeneratedPath]);
    }
}

main();