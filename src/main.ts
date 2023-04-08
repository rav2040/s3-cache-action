import { execFileSync } from "child_process";
import { join } from "path";
import { getInput, setFailed } from "@actions/core";
import { context as gitHubContext } from "@actions/github";

async function main() {
    try {
        const bucket = getInput("bucket");
        const path = getInput("path");
        const runNumber = getInput("run-number") || null;

        const paths = path.split("\n").map((str) => str.trim()).filter(Boolean);
        const uniquePaths = Array.from(new Set(paths));

        uniquePaths.forEach((path) => {
            const localPath = join(process.cwd(), path);

            const pathA = runNumber === null ? localPath : `s3://${bucket}/${runNumber}/${path}`;
            const pathB = runNumber === null ? `s3://${bucket}/${gitHubContext.runNumber}/${path}` : localPath;

            execFileSync("aws", ["s3", "sync", pathA, pathB, "--delete", "--no-progress"], { stdio: "inherit" });
        });
    } catch (err) {
        if (err instanceof Error) setFailed(err);
    }
}

main();
