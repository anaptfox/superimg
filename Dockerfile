FROM mcr.microsoft.com/playwright:v1.57.0-noble

RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg \
 && rm -rf /var/lib/apt/lists/*

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

WORKDIR /app

COPY --chown=pwuser:pwuser pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY --chown=pwuser:pwuser scripts ./scripts
COPY --chown=pwuser:pwuser skills ./skills
COPY --chown=pwuser:pwuser packages ./packages
COPY --chown=pwuser:pwuser apps ./apps
COPY --chown=pwuser:pwuser examples ./examples

RUN mkdir -p /app/output /pnpm && chown -R pwuser:pwuser /app /pnpm

USER pwuser

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN pnpm install --no-frozen-lockfile

RUN pnpm -r --filter '!docs' build

ENV NODE_ENV=production

ENTRYPOINT ["node", "packages/superimg/dist/cli.js"]
CMD ["--help"]
