FROM node:latest
ENV NODE_ENV production
ENV TZ="Asia/Tokyo"

RUN apt update \
    && apt clean \
    && rm -rf /var/lib/apt/lists/*

# アプリケーションディレクトリを作成する
WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .

CMD ["node", "index.js"]