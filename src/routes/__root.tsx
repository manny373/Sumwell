import { HeadContent, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import appCss from "~/styles/app.css?url";
import { themeInitScript } from "~/lib/theme";
import { ThemeProvider } from "~/components/theme";

const FAVICON_HREF =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%231f6e6b'/%3E%3Cg fill='%23faf8f3'%3E%3Crect x='8' y='20' width='7' height='4' rx='2'/%3E%3Crect x='8' y='14' width='10' height='4' rx='2'/%3E%3Crect x='8' y='8' width='16' height='4' rx='2'/%3E%3C/g%3E%3C/svg%3E";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      { title: "Sumwell — Make a clear plan for every paycheck." },
      {
        name: "description",
        content:
          "Sumwell prototype — a clear plan for every paycheck: bills, debt, savings, and giving in one place. Synthetic demo data only; not a production financial service.",
      },
      {
        name: "theme-color",
        content: "#faf8f3",
        media: "(prefers-color-scheme: light)",
      },
      {
        name: "theme-color",
        content: "#101816",
        media: "(prefers-color-scheme: dark)",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/svg+xml", href: FAVICON_HREF },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Set theme before first paint so CSS variables resolve correctly. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <HeadContent />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
        <Scripts />
      </body>
    </html>
  );
}