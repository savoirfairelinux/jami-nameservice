set environment RUST_LOG=web3=info

break get_addr

run --server-addr=127.0.0.1:8082 --eth-addr http://127.0.0.1:8545 --contract-addr=b3116749045564e4b19410cb49c277ff5be5918f
