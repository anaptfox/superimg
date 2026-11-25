ARG NODE_VERSION=26.13.1
FROM node:${NODE_VERSION}-bookworm-slim AS node-runtime

FROM mcr.microsoft.com/playwright:v1.65.0-noble

COPY --from=node-runtime /usr/local/ /usr/local/
ARG NODE_VERSION
RUN node --version | grep -Fqx "v${NODE_VERSION}"

RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg \
 && rm -rf /var/lib/apt/lists/*

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN npm install --global pnpm@12.18.0

WORKDIR /app

COPY --chown=pwuser:pwuser .node-version pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY --chown=pwuser:pwuser scripts ./scripts
COPY --chown=pwuser:pwuser skills ./skills
COPY --chown=pwuser:pwuser packages ./packages
COPY --chown=pwuser:pwuser apps ./apps
COPY --chown=pwuser:pwuser examples ./examples
COPY --chown=pwuser:pwuser tooling ./tooling
COPY --chown=pwuser:pwuser tests ./tests
COPY --chown=pwuser:pwuser vendor ./vendor

RUN mkdir -p /app/output /pnpm && chown -R pwuser:pwuser /app /pnpm

USER pwuser

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN pnpm install --frozen-lockfile

# The Docker context has no Git checkout for a linked-source receipt.
RUN SUPERIMG_SOURCE_TREE_RECEIPT=omit pnpm build:render

ENV NODE_ENV=production

ENTRYPOINT ["node", "packages/superimg-cli/dist/cli.js"]
CMD ["--help"]
