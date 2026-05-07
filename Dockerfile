FROM node:24-alpine AS base

WORKDIR /app

COPY package*.json ./

FROM base AS deps
RUN npm ci

FROM deps AS dev
ENV NODE_ENV=development
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

FROM deps AS build
COPY . .
RUN npm run build

FROM node:24-alpine AS production
ENV NODE_ENV=production
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist

EXPOSE 3000
CMD ["npm", "start"]
