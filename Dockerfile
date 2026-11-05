FROM node:24-alpine
WORKDIR /app
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY --chown=node:node lite-server.js database.js index.html ./
COPY --chown=node:node public/lite ./public/lite
RUN mkdir -p /app/data && chown node:node /app/data
USER node
ENV HOST=0.0.0.0 PORT=3000 LINGOLITE_DATABASE_PATH=/app/data/lingolite.sqlite
EXPOSE 3000
VOLUME ["/app/data"]
CMD ["node", "lite-server.js"]
