import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

function normalizeBaseUrl(value) {
  const trimmedValue = value.trim().replace(/\/+$/, "");

  if (!trimmedValue) {
    throw new Error("BASE_URL must not be empty or whitespace.");
  }

  if (/^https?:\/\//i.test(trimmedValue)) {
    return trimmedValue;
  }

  return `https://${trimmedValue}`;
}

function readNumberConfig(name, fallbackValue) {
  const rawValue = __ENV[name] || fallbackValue;
  const value = Number(rawValue);

  if (Number.isNaN(value)) {
    throw new Error(`${name} must be a valid number.`);
  }

  return value;
}

const baseUrl = normalizeBaseUrl(__ENV.BASE_URL || "http://127.0.0.1:3100");
const villaId = __ENV.VILLA_ID || "9";
const vus = readNumberConfig("VUS", 1);
const duration = __ENV.DURATION || "40s";
const sleepSeconds = readNumberConfig("SLEEP_SECONDS", 4);

export const options = {
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<3000"],
  },
  scenarios: {
    public_smoke: {
      executor: "constant-vus",
      vus,
      duration,
      gracefulStop: "5s",
    },
  },
};

const documentHeaders = {
  Accept: "text/html,application/xhtml+xml",
};

const jsonHeaders = {
  Accept: "application/json",
};

const failedByEndpoint = {
  home_html: new Rate("home_html_failed"),
  search_html: new Rate("search_html_failed"),
  houses_api: new Rate("houses_api_failed"),
  home_sections_api: new Rate("home_sections_api_failed"),
  villa_html: new Rate("villa_html_failed"),
  villa_api: new Rate("villa_api_failed"),
  villa_images_api: new Rate("villa_images_api_failed"),
};

function recordResponse(name, response) {
  const ok = response.status >= 200 && response.status < 400;
  failedByEndpoint[name].add(!ok);

  check(response, {
    "status is 2xx or redirect": () => ok,
  });
}

export default function () {
  const responses = {
    home_html: http.get(`${baseUrl}/`, {
      headers: documentHeaders,
      tags: { name: "home_html" },
    }),
    search_html: http.get(`${baseUrl}/search`, {
      headers: documentHeaders,
      tags: { name: "search_html" },
    }),
    houses_api: http.get(`${baseUrl}/api/houses`, {
      headers: jsonHeaders,
      tags: { name: "houses_api" },
    }),
    home_sections_api: http.get(`${baseUrl}/api/home-sections`, {
      headers: jsonHeaders,
      tags: { name: "home_sections_api" },
    }),
    villa_html: http.get(`${baseUrl}/villas/${villaId}`, {
      headers: documentHeaders,
      tags: { name: "villa_html" },
    }),
    villa_api: http.get(`${baseUrl}/api/villas/${villaId}`, {
      headers: jsonHeaders,
      tags: { name: "villa_api" },
    }),
    villa_images_api: http.get(`${baseUrl}/api/villas/${villaId}/images`, {
      headers: jsonHeaders,
      tags: { name: "villa_images_api" },
    }),
  };

  for (const [name, response] of Object.entries(responses)) {
    recordResponse(name, response);
  }

  sleep(sleepSeconds);
}
