FROM node:18-alpine

WORKDIR /app

ENV PATH /app/node_modules/.bin:$PATH
EXPOSE 3000
ENV PORT 3000

COPY public ./public
COPY src ./src
COPY package.json .
COPY yarn.lock .

RUN ls
RUN ls public
RUN yarn --frozen-lockfile
RUN yarn build

CMD ["yarn", "start"]
