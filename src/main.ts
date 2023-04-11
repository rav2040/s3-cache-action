import { join, posix } from "path";
import { createReadStream } from "fs";
import { getInput, getMultilineInput, setFailed } from "@actions/core";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import globby from "globby";

async function main() {
    try {
        const bucket = getInput("bucket", { required: true });
        const path = getMultilineInput("path", { required: true });
        const prefix = getInput("prefix");

        const paths = (await Promise.all(path.map((path) => {
            return globby(path, { onlyFiles: false, markDirectories: true });
        }))).flat();

        console.log("paths:", paths);

        const uniquePaths = Array.from(new Set(paths))
            .filter((a, _, arr) => arr.some((b) => a !== b && a.startsWith(b)));

        console.log("uniquePaths:", uniquePaths);

        const s3 = new S3Client({});

        await Promise.all(uniquePaths.map(async (path) => {
            const isDir = path.at(-1) === "/";
            const key = posix.join(prefix, path);
            const filePath = join(process.cwd(), path);
            const body = isDir ? undefined : createReadStream(filePath);

            const putObjectCommand = new PutObjectCommand({
                Bucket: bucket,
                Key: key,
                Body: body
            });

            await s3.send(putObjectCommand);

            console.info("Uploaded:", filePath);
        }))
    } catch (err) {
        if (err instanceof Error) setFailed(err);
    }
}

main();
