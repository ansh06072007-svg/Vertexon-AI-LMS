# Optional production-style image. The project also runs locally with `npm run dev`.
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5174
ENV HOST=0.0.0.0
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY server ./server
RUN mkdir -p /app/server/data /app/uploads
EXPOSE 5174
VOLUME ["/app/server/data", "/app/uploads"]
CMD ["npm", "start"]
