## Joining the JAMI Private Network

These instructions are valid for OS X and Linux hosts, Windows hosts should check the syntax.

1. Get the latest Go-Ethereum client from <https://geth.ethereum.org/downloads/>
2. Unzip the contents of the tar archive above to a location on your computer - for the rest of the guide we assume you are on a Linux machine and you have unzipped the contents to `/home/jamichain` - you can use a different location, in which case please make sure to use it for the rest of the instruction guide
3. Copy the geth executable (just a file) to `/home/jamichain` and delete the tar archive and the left-over directory
4. Inside `/home/jamichain` create a folder called data
5. Copy the `genesis.json` file from this repository into `/home/jamichain`
6. Inside the `/home/jamichain` run the command 
    
    ./geth --datadir data/ init genesis.json

    If the command fails check that the data folder has been created and that you are allowed to execute geth.
7. Run the command 

    geth --datadir=/home/jamichain/data --syncmode=full --networkid 1551 --rpc --rpcaddr 0.0.0.0 --rpcapi "eth,net,web3,personal,admin" --bootnodes "enode://11ba6d3bfdc29a8afb24dcfcf9a08c8008005ead62756eadb363523c2ca8b819efbb264053db3d73949f1375bb3f03090f44cacfb88bade38bb6fc2cb3d890a5@173.231.120.228:30301" console

The above steps will allow you to sync with the Jami blockchain in read-only mode (i.e. you cannot mine blocks - however you can submit transactions). 

## Running as a SystemD Service

If you want to run the Jami blockchain as a SystemD service, you can use the following example file (call it jami.service in your SystemD script directory):

```toml
[Unit]
Description=Geth Node
[Service]
Type=simple
ExecStart=/home/geth/geth --datadir=/home/jamichain/data --syncmode=full --networkid 1551 --rpc --rpcaddr 0.0.0.0 --rpcapi "eth,net,web3,personal,admin" --bootnodes "enode://11ba6d3bfdc29a8afb24dcfcf9a08c8008005ead62756eadb363523c2ca8b819efbb264053db3d73949f1375bb3f03090f44cacfb88bade38bb6fc2cb3d890a5@173.231.120.228:30301"
Restart=always
User=geth
[Install]
WantedBy=multi-user.target
```

Please note that the --rpc, --rpcaddr and --rcpapi are OPTIONAL. You are welcome not to include them if you do not want to access the node via JSON-RPC.
