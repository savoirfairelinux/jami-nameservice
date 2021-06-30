FROM node:alpine

RUN npm install --global ganache-cli

COPY ./entrypoint /entrypoint

EXPOSE 8545

ENTRYPOINT ["/entrypoint"]
