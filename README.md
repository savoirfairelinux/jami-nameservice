# Jami name service

Jami name service is used to resolve easily memorable usernames to Jami IDs. Jami
clients communicate with the name service using HTTPS.

Requirements:

  - docker
  - docker-compose >= 3.0
  - make
  - solidity
  - geth (if council member)
 
Development requirements:

  - cargo
  - git
  
## Deploying the service

### For real usage

You first need to add your key/certificate under `./volumes/for-proxy/certs/` with common
prefix of `jami-name-server`.
Then, you can do:

```sh
$ make deploy
```

where `BLOCKCHAIN_URL` should be the URL of the desired Ethereum client.

### For debug

You simply have to do:

```sh
$ make cert
$ make debug
```

A dummy key/certificate will be created for you under `./volumes/for-proxy/certs/`.  Do
*not* ever use these for real deployment.

A private blockchain will be created for you and the name server will
communicate with its client.  The blockchain data can then be inspect in
`./volumes/for-blockchain-dev/var/blockchain/`.

## Cleaning the project

Run:

```sh
$ make clean
```

to clean everything, except `./volumes/for-proxy/certs/`.

## Development of the name-server

To develop the server locally, go under `./name-server/` and run:

```sh
cargo build
```

you can then run the server with

```sh
cargo run -- --server-addr=127.0.0.1:80 --eth-addr=http://localhost:8545 COUNCIL-ABI COUNCIL-ADDR
```

if you have an Ethereum client running on your localhost.

