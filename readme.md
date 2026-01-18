# Jami name service

Jami name service is used to resolve easily memorable usernames to Jami IDs. Jami clients communicate with the name service using HTTP.

To run, make sure you have the Solidity compiler `solc` installed.

Instructions for Ubuntu:

```
sudo add-apt-repository ppa:ethereum/ethereum
sudo apt-get update
sudo apt-get install solc
```
Then do a `make` in the project root directory.

You'll need to use Python 3.5+ to run the nameservice. If you don't already have tmux installed, do `pip install tmux`, and then:

```
python start_eth_cluster.py
```

Finally, make sure you have nodejs and npm install, do:
```
npm install
sudo nodejs index.js
```
(we need sudo for the Express server to listen on port 80)

This will launch the HTTP server used to interface with the nameservice.
Send a GET request to `name/<username>` to get its Jami ID. Send a POST request to `name/<username>` to register a new username-JamiID pair.


Optionally, you can dump all username-JamiID pairs to a file using:
```
nodejs read_names.js
```
This will dump all the username-JamiID pairs to the `names.json` file.
