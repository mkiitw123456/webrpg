FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server ./server
COPY src/shared ./src/shared
COPY src/systems/RPGState.js ./src/systems/RPGState.js
USER node
EXPOSE 8787
CMD ["node", "server/index.js"]
