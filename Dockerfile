FROM node:slim

RUN apt update \
    && apt install -y libjemalloc2 \
    && apt clean \
    && rm -rf /var/lib/apt/lists/*

# アプリケーションディレクトリを作成する
WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .

ENV NODE_ENV production
ENV TZ="Asia/Tokyo"
ENV LD_PRELOAD=/usr/lib/x86_64-linux-gnu/libjemalloc.so.2

CMD ["npm", "start"]