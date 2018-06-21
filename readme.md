# Ring Nameservice

Ring Nameservice is used to resolve easily memorable usernames to Ring IDs. Ring clients communicate with the Nameservice using HTTP.

To run, make sure you have Solidity compiler `solc` installed.

Instructions for Ubuntu:

```
sudo add-apt-repository ppa:ethereum/ethereum
sudo apt-get update
sudo apt-get install solc
```
Then do a `make` in the project root directory.


You'll need to use Python 3.5+ to run the nameservice. If you already don't have tmux installed, do `pip install tmux`, and then:

```
python start_eth_cluster.py
```



Finally, make sure you have nodejs and npm install, do:
```
npm install
sudo node index.js
```
(we need sudo for Express server to listen on port 80)

This will launch the HTTP server used to interface with the nameservice.
Send a GET request to `name/<username>` to get its Ring ID. Send a POST request to `name/<username>` to register new username-RingID pair.


## Batch Operations

Optionally, you can dump all username-RingID pairs to file using:
```
node read_names.js
```
This will dump all the username-RingID pairs to `names.json` file.

Conversely, you can read names from a JSON dump and batch register names
```
node write_name.js <JSON names dump>
```