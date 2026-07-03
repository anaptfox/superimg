import { eventHandler } from "vinxi/http";

export default eventHandler(() => {
  return new Response(
    `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>SuperImg × Vinxi</title>
  </head>
  <body>
    <div id="root"></div>
    <script src="./app/client.tsx" type="module"></script>
  </body>
</html>`,
    {
      status: 200,
      headers: { "Content-Type": "text/html" },
    },
  );
});