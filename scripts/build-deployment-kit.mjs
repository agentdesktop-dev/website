import { createWriteStream } from "node:fs";
import { mkdir, readdir, readFile, rename, rm, stat } from "node:fs/promises";
import { dirname, join, posix, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { ZipArchive } from "archiver";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = join(
  projectRoot,
  "public",
  "downloads",
  "agentdesktop-gcp-deployment-kit.zip",
);
const temporaryPath = `${outputPath}.tmp`;
const archiveRoot = "agentdesktop-gcp-deployment-kit";
const archiveDate = new Date("1980-01-01T00:00:00.000Z");

const deploymentKitFiles = [
  "deploy/README.md",
  "deploy/gcp/README.md",
  "deploy/gcp/daemon.empty.yaml",
  "deploy/gcp/deploy.sh",
  "deploy/gcp/helm/postgresql/Chart.yaml",
  "deploy/gcp/helm/postgresql/templates/_helpers.tpl",
  "deploy/gcp/helm/postgresql/templates/backup.yaml",
  "deploy/gcp/helm/postgresql/templates/networkpolicy.yaml",
  "deploy/gcp/helm/postgresql/templates/postgresql.yaml",
  "deploy/gcp/helm/postgresql/templates/storageclass.yaml",
  "deploy/gcp/helm/postgresql/values.yaml",
  "deploy/gcp/scripts/controller-post-renderer.sh",
  "deploy/gcp/scripts/create-entra-app.sh",
  "deploy/gcp/scripts/generate-pki.sh",
  "deploy/gcp/scripts/port-forward-admin.sh",
  "deploy/gcp/scripts/render-intune-bootstrap.sh",
  "deploy/gcp/scripts/upsert-intune-bootstrap.sh",
  "deploy/gcp/terraform/.terraform.lock.hcl",
  "deploy/gcp/terraform/main.tf",
  "deploy/gcp/terraform/outputs.tf",
  "deploy/gcp/terraform/terraform.tfvars.example",
  "deploy/gcp/terraform/variables.tf",
  "deploy/gcp/terraform/versions.tf",
  "deploy/kind/README.md",
  "deploy/kind/smoke-test.sh",
];

const excludedDeploymentPaths = [
  /(?:^|\/)\.DS_Store$/,
  /^deploy\/gcp\/\.env(?:\.|$)/,
  /^deploy\/gcp\/agentdesktop-pki\//,
  /^deploy\/gcp\/generated\//,
  /^deploy\/gcp\/terraform\/\.terraform\//,
  /^deploy\/gcp\/(?:terraform\/)?terraform\.tfstate(?:\.|$)/,
  /^deploy\/gcp\/terraform\/[^/]+\.tfplan$/,
];

async function listFiles(directory) {
  const entries = await readdir(join(projectRoot, directory), {
    withFileTypes: true,
  });
  const files = [];

  for (const entry of entries) {
    const path = posix.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listFiles(path)));
    } else if (entry.isFile()) {
      files.push(path);
    }
  }

  return files;
}

const deploymentFiles = await listFiles("deploy");
const unclassifiedFiles = deploymentFiles.filter(
  (file) =>
    !deploymentKitFiles.includes(file) &&
    !excludedDeploymentPaths.some((pattern) => pattern.test(file)),
);

if (unclassifiedFiles.length > 0) {
  throw new Error(
    `Classify new deployment files before building the public kit:\n${unclassifiedFiles.join("\n")}`,
  );
}

const deploymentKitSources = await Promise.all(
  deploymentKitFiles.map(async (file) => {
    const sourcePath = resolve(projectRoot, file);
    const sourceStat = await stat(sourcePath);

    if (!sourceStat.isFile() || relative(projectRoot, sourcePath).startsWith("..")) {
      throw new Error(`Deployment kit source is not a project file: ${file}`);
    }

    return { file, contents: await readFile(sourcePath) };
  }),
);

await mkdir(dirname(outputPath), { recursive: true });
await rm(temporaryPath, { force: true });

try {
  await new Promise((resolveArchive, rejectArchive) => {
    const output = createWriteStream(temporaryPath);
    const archive = new ZipArchive({ zlib: { level: 9 } });

    output.on("close", resolveArchive);
    output.on("error", rejectArchive);
    archive.on("error", rejectArchive);
    archive.on("warning", rejectArchive);
    archive.pipe(output);

    for (const { file, contents } of deploymentKitSources) {
      archive.append(contents, {
        name: posix.join(archiveRoot, file),
        date: archiveDate,
        mode: file.endsWith(".sh") ? 0o755 : 0o644,
      });
    }

    void archive.finalize();
  });

  await rm(outputPath, { force: true });
  await rename(temporaryPath, outputPath);
} finally {
  await rm(temporaryPath, { force: true });
}

console.log(`Created ${relative(projectRoot, outputPath)}`);