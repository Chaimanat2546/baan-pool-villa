import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AWS_IMAGE_LOADER_DEFAULT_BASE_URL } from "../aws-image-url";
import awsLoader from "../aws-loader";

const ENV_NAME = "NEXT_PUBLIC_AWS_IMAGE_LOADER_BASE_URL";
const ORIGINAL_BASE_URL = process.env[ENV_NAME];

describe("awsLoader", () => {
  beforeEach(() => {
    process.env[ENV_NAME] = "https://images.example.com";
  });

  afterEach(() => {
    if (ORIGINAL_BASE_URL === undefined) {
      delete process.env[ENV_NAME];
    } else {
      process.env[ENV_NAME] = ORIGINAL_BASE_URL;
    }
  });

  it("keeps relative image paths local and preserves existing query params", () => {
    const result = awsLoader({
      src: "/villas/pool.jpg?token=abc",
      width: 640,
      quality: 60,
    });
    const url = new URL(result, "https://site.example");

    expect(url.origin).toBe("https://site.example");
    expect(url.pathname).toBe("/villas/pool.jpg");
    expect(url.searchParams.get("token")).toBe("abc");
    expect(url.searchParams.get("w")).toBe("640");
    expect(url.searchParams.get("q")).toBe("60");
  });

  it("adds transform params to same-origin image proxy routes", () => {
    const result = awsLoader({
      src: "/api/guides/images/guide/cover",
      width: 640,
      quality: 60,
    });

    expect(result).toBe("/api/guides/images/guide/cover?w=640&q=60");
  });

  it("rejects non-image API routes", () => {
    expect(() =>
      awsLoader({ src: "/api/houses", width: 640, quality: 60 }),
    ).toThrow("Invalid file extension");
  });

  it("checks file extensions from the parsed pathname", () => {
    expect(() =>
      awsLoader({
        src: "/villas/pool?name=pool.jpg",
        width: 640,
        quality: 60,
      }),
    ).toThrow("Invalid file extension");
  });

  it("does not pretend to transform extensionless TikTok CDN sources", () => {
    expect(() =>
      awsLoader({
        src: "https://p16-sign.tiktokcdn-us.com/tos-useast5-p-0068-tx/no-extension",
        width: 64,
        quality: 60,
      }),
    ).toThrow("Invalid file extension");
  });

  it("rejects path traversal and private external origins", () => {
    expect(() =>
      awsLoader({
        src: "/villas/%2e%2e/secret.jpg",
        width: 640,
        quality: 60,
      }),
    ).toThrow("Invalid image source");

    expect(() =>
      awsLoader({
        src: "https://127.0.0.1/pool.jpg",
        width: 640,
        quality: 60,
      }),
    ).toThrow("Invalid image source");
  });

  it("keeps external HTTPS source URLs direct and includes transform params", () => {
    const result = awsLoader({
      src: "https://assets.example.com/villas/pool.jpg?token=abc",
      width: 640,
      quality: 60,
    });
    const url = new URL(result);

    expect(url.origin).toBe("https://assets.example.com");
    expect(url.pathname).toBe("/villas/pool.jpg");
    expect(url.searchParams.get("token")).toBe("abc");
    expect(url.searchParams.get("w")).toBe("640");
    expect(url.searchParams.get("q")).toBe("60");
  });

  it("maps poolvilla S3 image objects through the AWS loader origin", () => {
    const result = awsLoader({
      src: "https://s3.ap-southeast-1.amazonaws.com/poolvillas.co.ltd/pool image.jpg",
      width: 640,
      quality: 60,
    });
    const url = new URL(result);

    expect(url.origin).toBe("https://images.example.com");
    expect(url.pathname).toBe("/pool%20image.jpg");
    expect(url.searchParams.get("w")).toBe("640");
    expect(url.searchParams.get("q")).toBe("60");
  });

  it("adds transform params for sources that already use the AWS loader origin", () => {
    const result = awsLoader({
      src: "https://images.example.com/villas/pool.jpg?token=abc",
      width: 640,
      quality: 60,
    });
    const url = new URL(result);

    expect(url.origin).toBe("https://images.example.com");
    expect(url.pathname).toBe("/villas/pool.jpg");
    expect(url.searchParams.get("token")).toBe("abc");
    expect(url.searchParams.get("w")).toBe("640");
    expect(url.searchParams.get("q")).toBe("60");
  });

  it("recognizes the production AWS origin when env is missing", () => {
    delete process.env[ENV_NAME];

    const result = awsLoader({
      src: `${AWS_IMAGE_LOADER_DEFAULT_BASE_URL}/villas/pool.jpg`,
      width: 640,
      quality: 60,
    });
    const url = new URL(result);

    expect(url.origin).toBe(
      "https://d24r25u6qcb3zryipzoiqj2jxy0ilqtm.lambda-url.ap-southeast-1.on.aws",
    );
  });

  it("rejects non-HTTPS external sources", () => {
    expect(() =>
      awsLoader({
        src: "http://assets.example.com/pool.jpg",
        width: 640,
        quality: 60,
      }),
    ).toThrow("Invalid image source");
  });
});
