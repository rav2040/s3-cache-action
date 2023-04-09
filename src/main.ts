import { execFileSync } from "child_process";
import { join } from "path";
import { getInput, setFailed } from "@actions/core";
import globby from "globby";

const PATH_SPLIT_REGEX = /\s+(?=([^"]*"[^"]*")*[^"]*$)/g;

async function main() {
    try {
        const bucket = getInput("bucket");
        const path = getInput("path");
        const key = getInput("key");
        const download = getInput("download") === "true";

        const paths = (await Promise.all(
            path.split(PATH_SPLIT_REGEX)
                .filter(Boolean)
                .map((path) => globby(path))
        )).flat();
        const uniquePaths = Array.from(new Set(paths));

        console.log("uniquePaths", uniquePaths);

        uniquePaths.forEach((path) => {
            const localPath = join(process.cwd(), path);
            const remotePath = `s3://${bucket}/${key}/${path}`;

            const srcPath = download ? remotePath : localPath;
            const destPath = download ? localPath : remotePath;

            execFileSync("aws", [
                "s3",
                "cp",
                srcPath,
                destPath,
                "--recursive",
                "--no-progress"
            ], { stdio: "inherit" });
        });
    } catch (err) {
        if (err instanceof Error) setFailed(err);
    }
}

main();
