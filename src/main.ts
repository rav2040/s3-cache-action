import { execFileSync } from "child_process";
import { join } from "path";
import { getInput, setFailed } from "@actions/core";
import { context as gitHubContext } from "@actions/github";

async function main() {
    try {
        const bucket = getInput("bucket");
        const path = getInput("path");
        const runNumber = getInput("run-number") || null;

        console.log("cwd:", process.cwd());
        console.log("__dirname", __dirname);

        const localPath = join(process.cwd(), path);

        const pathA = runNumber === null ? localPath : `${bucket}/${runNumber}`;
        const pathB = runNumber === null ? `${bucket}/${gitHubContext.runNumber}` : localPath;

        execFileSync("aws", ["s3", "sync", pathA, pathB, "--delete"], { stdio: "inherit" });
    } catch (err) {
        if (err instanceof Error) setFailed(err);
    }
}

main();
