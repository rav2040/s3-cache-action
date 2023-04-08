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
            const remotePath = `s3://${bucket}/${runNumber ?? gitHubContext.runNumber}/${path}`

            const srcPath = runNumber === null ? localPath : remotePath;
            const destPath = runNumber === null ? remotePath : localPath;

            if (runNumber === null) {
                execFileSync("aws", ["s3", "rm", destPath, "--recursive", "--quiet"], { stdio: "inherit" });
            }

            execFileSync("aws", ["s3", "cp", srcPath, destPath, "--recursive", "--no-progress"], { stdio: "inherit" });
        });
    } catch (err) {
        if (err instanceof Error) setFailed(err);
    }
}

main();
