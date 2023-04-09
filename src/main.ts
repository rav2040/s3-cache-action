import { join } from "path";
import { readFile } from "fs/promises";
import { getInput, setFailed } from "@actions/core";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import globby from "globby";

const PATH_SPLIT_REGEX = /\s+(?=([^"]*"[^"]*")*[^"]*$)/g;

async function main() {
    try {
        const bucket = getInput("bucket");
        const path = getInput("path");
        const prefix = getInput("prefix");

        const paths = (await Promise.all(
            path.split(PATH_SPLIT_REGEX)
                .filter(Boolean)
                .map((path) => globby(path))
        )).flat();
        const uniquePaths = Array.from(new Set(paths));

        const s3 = new S3Client({});

        await Promise.all(uniquePaths.map(async (path) => {
            const filePath = join(process.cwd(), path);
            const file = await readFile(filePath);

            const putObjectCommand = new PutObjectCommand({
                Bucket: bucket,
                Key: [prefix, path].filter(Boolean).join("/"),
                Body: file
            });

            await s3.send(putObjectCommand);

            console.info("Uploaded:", filePath);
        }))
    } catch (err) {
        if (err instanceof Error) setFailed(err);
    }
}

main();
