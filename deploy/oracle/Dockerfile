FROM node:22-bookworm
WORKDIR /app
RUN npm install --global pnpm@11.9.0
COPY --chown=node:node . .
RUN chown node:node /app
USER node
RUN pnpm install --frozen-lockfile
ARG PREVIEW_HOST
ENV NEXT_PUBLIC_APP_URL=https://${PREVIEW_HOST} API_URL=http://api:4000 NEXT_PUBLIC_API_URL="" NEXT_TELEMETRY_DISABLED=1
RUN pnpm exec turbo run build --concurrency=1 --env-mode=loose
ENV NODE_ENV=production
CMD ["node","scripts/railway-start.mjs"]
