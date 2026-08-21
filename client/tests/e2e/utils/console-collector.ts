import { Page } from "@playwright/test";

export interface CapturedError {
  type: "console" | "pageerror" | "requestfailed" | "responseerror";
  message: string;
  url?: string;
}

export function attachErrorCollector(page: Page) {
  const errors: CapturedError[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      // Filter out harmless browser warnings or extension noise if any
      const text = msg.text();
      if (!text.includes("Download the React DevTools")) {
        errors.push({
          type: "console",
          message: text,
          url: page.url(),
        });
      }
    }
  });

  page.on("pageerror", (error) => {
    errors.push({
      type: "pageerror",
      message: error.message || String(error),
      url: page.url(),
    });
  });

  page.on("requestfailed", (request) => {
    errors.push({
      type: "requestfailed",
      message: `Failed request: ${request.method()} ${request.url()} - ${request.failure()?.errorText || "Unknown error"}`,
      url: request.url(),
    });
  });

  page.on("response", (response) => {
    if (response.status() >= 500) {
      errors.push({
        type: "responseerror",
        message: `HTTP ${response.status()} on ${response.method()} ${response.url()}`,
        url: response.url(),
      });
    }
  });

  return errors;
}
