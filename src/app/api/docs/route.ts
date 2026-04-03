/**
 * GET /api/docs
 *
 * Renders the Swagger UI for the z2Lab OrderEntry API.
 * The spec is loaded from GET /api/openapi.json served by this same app.
 *
 * Swagger UI is loaded from the unpkg CDN — no additional npm package required.
 */
export async function GET() {
  const html = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>z2Lab OrderEntry — API Dokumentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>
    body { margin: 0; padding: 0; background: #fafafa; }
    .topbar { display: none !important; }
    #swagger-ui { max-width: 1200px; margin: 0 auto; padding: 1rem; }
    .swagger-ui .info .title { font-size: 1.8rem; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js" crossorigin></script>
  <script>
    window.onload = function () {
      SwaggerUIBundle({
        url: "/api/openapi.json",
        dom_id: "#swagger-ui",
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset,
        ],
        layout: "BaseLayout",
        defaultModelsExpandDepth: 1,
        defaultModelExpandDepth: 2,
        displayRequestDuration: true,
        tryItOutEnabled: true,
        filter: true,
        withCredentials: true,
      });
    };
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
