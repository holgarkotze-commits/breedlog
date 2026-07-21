import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

export interface BackupStorageAdapter {
  provider: string;
  putObject(key: string, body: string, contentType: string): Promise<void>;
  getObject(key: string): Promise<string>;
  listKeys(prefix: string): Promise<string[]>;
  deleteObject(key: string): Promise<void>;
}

function normalizeKey(key: string): string {
  return key.replace(/\\/g, "/").replace(/^\/+/, "");
}

export class LocalFilesystemBackupStorageAdapter implements BackupStorageAdapter {
  provider = "local-filesystem";

  constructor(private readonly rootDir: string) {}

  private resolve(key: string): string {
    return path.join(this.rootDir, ...normalizeKey(key).split("/"));
  }

  async putObject(key: string, body: string): Promise<void> {
    const target = this.resolve(key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, body, "utf8");
  }

  async getObject(key: string): Promise<string> {
    return fs.readFile(this.resolve(key), "utf8");
  }

  async listKeys(prefix: string): Promise<string[]> {
    const normalizedPrefix = normalizeKey(prefix);
    const results: string[] = [];
    const walk = async (currentDir: string, relative = ""): Promise<void> => {
      const entries = await fs.readdir(currentDir, { withFileTypes: true }).catch(() => []);
      for (const entry of entries) {
        const nextRelative = relative ? `${relative}/${entry.name}` : entry.name;
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          await walk(fullPath, nextRelative);
        } else if (nextRelative.startsWith(normalizedPrefix)) {
          results.push(nextRelative);
        }
      }
    };
    await walk(this.rootDir);
    return results.sort();
  }

  async deleteObject(key: string): Promise<void> {
    await fs.rm(this.resolve(key), { force: true });
  }
}

type S3Config = {
  bucket: string;
  region: string;
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
};

function sha256Hex(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function hmac(key: Buffer | string, value: string): Buffer {
  return crypto.createHmac("sha256", key).update(value).digest();
}

function buildSigningKey(secretAccessKey: string, dateStamp: string, region: string): Buffer {
  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, "s3");
  return hmac(kService, "aws4_request");
}

export class S3CompatibleBackupStorageAdapter implements BackupStorageAdapter {
  provider = "s3-compatible";

  constructor(private readonly config: S3Config) {}

  private buildUrl(key: string, query = ""): URL {
    const base = new URL(this.config.endpoint);
    const normalizedKey = normalizeKey(key);
    base.pathname = `${base.pathname.replace(/\/$/, "")}/${this.config.bucket}/${normalizedKey}`;
    base.search = query;
    return base;
  }

  private async signedFetch(method: string, key: string, body = "", query = "", contentType = "application/json"): Promise<Response> {
    const url = this.buildUrl(key, query);
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);
    const payloadHash = sha256Hex(body);
    const canonicalHeaders = [
      `host:${url.host}`,
      `x-amz-content-sha256:${payloadHash}`,
      `x-amz-date:${amzDate}`,
    ].join("\n");
    const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
    const canonicalRequest = [
      method,
      url.pathname,
      url.searchParams.toString(),
      `${canonicalHeaders}\n`,
      signedHeaders,
      payloadHash,
    ].join("\n");
    const credentialScope = `${dateStamp}/${this.config.region}/s3/aws4_request`;
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      credentialScope,
      sha256Hex(canonicalRequest),
    ].join("\n");
    const signature = crypto.createHmac("sha256", buildSigningKey(this.config.secretAccessKey, dateStamp, this.config.region))
      .update(stringToSign)
      .digest("hex");
    const authorization = [
      `AWS4-HMAC-SHA256 Credential=${this.config.accessKeyId}/${credentialScope}`,
      `SignedHeaders=${signedHeaders}`,
      `Signature=${signature}`,
    ].join(", ");
    return fetch(url, {
      method,
      headers: {
        "Content-Type": contentType,
        "x-amz-content-sha256": payloadHash,
        "x-amz-date": amzDate,
        Authorization: authorization,
      },
      body: method === "GET" || method === "DELETE" ? undefined : body,
    });
  }

  async putObject(key: string, body: string, contentType: string): Promise<void> {
    const response = await this.signedFetch("PUT", key, body, "", contentType);
    if (!response.ok) {
      throw new Error(`S3 putObject failed with ${response.status}`);
    }
  }

  async getObject(key: string): Promise<string> {
    const response = await this.signedFetch("GET", key);
    if (!response.ok) {
      throw new Error(`S3 getObject failed with ${response.status}`);
    }
    return response.text();
  }

  async listKeys(prefix: string): Promise<string[]> {
    const query = `list-type=2&prefix=${encodeURIComponent(normalizeKey(prefix))}`;
    const response = await this.signedFetch("GET", "", "", query);
    if (!response.ok) {
      throw new Error(`S3 listObjectsV2 failed with ${response.status}`);
    }
    const xml = await response.text();
    return [...xml.matchAll(/<Key>([^<]+)<\/Key>/g)].map((match) => match[1]);
  }

  async deleteObject(key: string): Promise<void> {
    const response = await this.signedFetch("DELETE", key);
    if (!response.ok && response.status !== 404) {
      throw new Error(`S3 deleteObject failed with ${response.status}`);
    }
  }
}

export function resolveBackupStorageAdapter(env: NodeJS.ProcessEnv = process.env): BackupStorageAdapter {
  if (env.BACKUP_STORAGE_PROVIDER === "s3") {
    const bucket = env.BACKUP_STORAGE_BUCKET;
    const region = env.BACKUP_STORAGE_REGION;
    const endpoint = env.BACKUP_STORAGE_ENDPOINT;
    const accessKeyId = env.BACKUP_STORAGE_ACCESS_KEY_ID;
    const secretAccessKey = env.BACKUP_STORAGE_SECRET_ACCESS_KEY;
    if (!bucket || !region || !endpoint || !accessKeyId || !secretAccessKey) {
      throw new Error("S3 backup storage requires BACKUP_STORAGE_BUCKET, REGION, ENDPOINT, ACCESS_KEY_ID, and SECRET_ACCESS_KEY.");
    }
    return new S3CompatibleBackupStorageAdapter({ bucket, region, endpoint, accessKeyId, secretAccessKey });
  }
  const rootDir = env.BACKUP_STORAGE_ROOT || path.join(process.cwd(), "backup-store");
  return new LocalFilesystemBackupStorageAdapter(rootDir);
}
