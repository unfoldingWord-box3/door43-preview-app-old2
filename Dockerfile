FROM node:18-alpine

WORKDIR /app

ENV PATH /app/node_modules/.bin:$PATH
EXPOSE 3000
ENV PORT 3000
ENV NODE_OPTIONS --openssl-legacy-provider

COPY . .

RUN yarn --frozen-lockfile
RUN yarn build

CMD ["yarn", "start"]
