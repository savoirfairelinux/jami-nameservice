#!/usr/bin/env node
var connect = require('connect');
var express = require('express');
var bodyParser = require('body-parser');
var BigNumber = require('bignumber.js');
var fs = require('fs');
var http = require('http');
var Web3 = require('web3');
var web3 = new Web3();

Object.getPrototypeOf(web3.eth).awaitConsensus = function(txhash, mined_cb) {
    ethP = this;
    var tries = 5;
    var filter = this.filter('latest');
    filter.watch(function(error, result) {
        if (error)
            console.log("watch error: " + error);
        var receipt = ethP.getTransactionReceipt(txhash);
        if (receipt && receipt.transactionHash == txhash) {
            filter.stopWatching();
            mined_cb();
        } else if (!--tries) {
            mined_cb("Transaction timeout..");
        }
    });
}

web3.setProvider(new web3.providers.HttpProvider('http://localhost:8545'));
var coinbase = web3.eth.coinbase;
console.log(coinbase);
var balance = web3.eth.getBalance(coinbase);
console.log(balance.toString(10));

var REG_ADDR_FILE = "contractAddress.txt";
var REG_ABI_FILE = "contractABI.json";
var REG_ADDR = "0xe53cb2ace8707526a5050bec7bcf979c57f8b44f";
var REG_ABI = [{"constant":true,"inputs":[{"name":"_a","type":"address"}],"name":"name","outputs":[{"name":"o_name","type":"bytes32"}],"payable":false,"type":"function"},{"constant":true,"inputs":[{"name":"_name","type":"bytes32"}],"name":"owner","outputs":[{"name":"","type":"address"}],"payable":false,"type":"function"},{"constant":true,"inputs":[{"name":"_name","type":"bytes32"}],"name":"content","outputs":[{"name":"","type":"bytes32"}],"payable":false,"type":"function"},{"constant":true,"inputs":[{"name":"_name","type":"bytes32"}],"name":"addr","outputs":[{"name":"","type":"address"}],"payable":false,"type":"function"},{"constant":true,"inputs":[{"name":"_name","type":"bytes32"}],"name":"subRegistrar","outputs":[{"name":"o_subRegistrar","type":"address"}],"payable":false,"type":"function"},{"constant":false,"inputs":[{"name":"_name","type":"bytes32"},{"name":"_a","type":"address"}],"name":"reserve","outputs":[],"payable":false,"type":"function"},{"constant":false,"inputs":[{"name":"_name","type":"bytes32"},{"name":"_owner","type":"address"},{"name":"_a","type":"address"}],"name":"reserveFor","outputs":[],"payable":false,"type":"function"},{"constant":false,"inputs":[{"name":"_name","type":"bytes32"},{"name":"_newOwner","type":"address"}],"name":"transfer","outputs":[],"payable":false,"type":"function"},{"constant":false,"inputs":[{"name":"_name","type":"bytes32"},{"name":"_registrar","type":"address"}],"name":"setSubRegistrar","outputs":[],"payable":false,"type":"function"},{"constant":false,"inputs":[],"name":"Registrar","outputs":[],"payable":false,"type":"function"},{"constant":false,"inputs":[{"name":"_name","type":"bytes32"},{"name":"_a","type":"address"},{"name":"_primary","type":"bool"}],"name":"setAddress","outputs":[],"payable":false,"type":"function"},{"constant":false,"inputs":[{"name":"_name","type":"bytes32"},{"name":"_content","type":"bytes32"}],"name":"setContent","outputs":[],"payable":false,"type":"function"},{"constant":false,"inputs":[{"name":"_name","type":"bytes32"}],"name":"disown","outputs":[],"payable":false,"type":"function"},{"constant":true,"inputs":[{"name":"_name","type":"bytes32"}],"name":"register","outputs":[{"name":"","type":"address"}],"payable":false,"type":"function"},{"anonymous":false,"inputs":[{"indexed":true,"name":"name","type":"bytes32"}],"name":"Changed","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"name","type":"bytes32"},{"indexed":true,"name":"addr","type":"address"},{"indexed":false,"name":"owner","type":"address"}],"name":"PrimaryChanged","type":"event"}];
var NAME_VALIDATOR = new RegExp('^[a-z0-9-_]{3,32}$');

var account;
var regContract;
var reg;

function unlockAccount() {
    web3.personal.unlockAccount(coinbase, "toto");
}

function getRemainingGaz() {
    return web3.eth.getBalance(coinbase) / web3.eth.gasPrice;
}

function waitForGaz(want, cb) {
    if (getRemainingGaz() >= want) {
        cb();
        return;
    }
    var timeout = function() {
        var g = getRemainingGaz();
        if (g >= want) {
            //web3.miner.stop();
            console.log("Mining finished ! Now having " + g + " gaz.");
            cb();
        } else {
            console.log("Waiting for " + (want - g) + " gaz to be mined...");
            setTimeout(timeout, 2500);
        }
    }
    //web3.miner.start(8);
    timeout();
}

function loadContract() {
    fs.readFile(REG_ADDR_FILE, function(err, content) {
        if (err) {
            console.log("Can't read contract address: " + err);
        } else {
            REG_ADDR = String(content);
        }
        fs.readFile(REG_ABI_FILE, function(err, abi_str){
            if (err)
                console.log("Can't read contract ABI: " + err);
            else
                REG_ABI = JSON.parse(abi_str);
            console.log("Loading name contract from blockchain at " + REG_ADDR);
            web3.eth.getCode(REG_ADDR, function(error, result) {
                if (error)
                    console.log("Error getting contract code: " + error);
                /*else
                    console.log("Contract code at " + REG_ADDR + ": " + result);*/
                if (!result || result == "0x") {
                    console.log("Contract not found at " + REG_ADDR);
                    initContract();
                } else {
                    regContract = web3.eth.contract(REG_ABI);
                    regContract.at(REG_ADDR, function(err, result) {
                        console.log("Contract found and loaded from " + REG_ADDR);
                        if(!err) {
                            reg = result;
                            startServer();
                        }
                        else {
                            console.error("err: " + err);
                        }
                    });
                }
            });
        });
    });
}

function initContract() {
    fs.readFile( __dirname + '/registrar.sol', function(err, data) {
        if (err)
            throw err;
        web3.eth.compile.solidity(String(data), function(err, compiled) {
            if (err) {
                console.log("Can't compile contract :" + err);
                throw err;
            }
            console.log("Contract compiled, instantiating on blockchain...");
            REG_ABI = compiled.GlobalRegistrar.info.abiDefinition;
            fs.writeFile(REG_ABI_FILE, JSON.stringify(REG_ABI));
            regContract = web3.eth.contract(REG_ABI);
            waitForGaz(3000000, function(){
                regContract.new({from: coinbase, data: compiled.GlobalRegistrar.code, gas: 3000000}, function(e, contract){
                    if(!e) {
                        if(!contract.address) {
                            console.log("Contract transaction send: TransactionHash: " + contract.transactionHash + " waiting to be mined...");
                        } else {
                            console.log("Contract mined! Address: " + contract.address);
                            REG_ADDR = contract.address;
                            fs.writeFile(REG_ADDR_FILE, REG_ADDR);
                            reg = contract;
                            startServer();
                        }
                    } else {
                        console.log(e);
                    }
                });
            });
        });
    });
}

function checkName(name) {
    try {
        return Boolean(name.match(NAME_VALIDATOR));
    } catch (e) {
        return false;
    }
}

function isHashZero(h) {
    return !h || h == "0x" || h == "0x0" || h == "0x0000000000000000000000000000000000000000";
}

function parseString(s) {
    return s ? web3.toUtf8(s) : s;
}

function formatAddress(s) {
    if (s) {
        try {
            if (s.startsWith("ring:"))
                s = s.substr(5);
            if (!s.startsWith("0x"))
                s = "0x" + s;
            if (new BigNumber(s) == 0)
                return undefined;
            return s;
        } catch (err) {}
    }
    return undefined;
}

function startServer() {
    console.log("Starting web server");
    var app = express();
    app.disable('x-powered-by');
    app.use(bodyParser.json());

    // Register name lookup handler
    app.get("/name/:name", function(req, http_res) {
        http_res.setHeader('Content-Type', 'application/json');
        try {
            reg.addr(req.params.name, function(err, res) {
                try {
                    if (err)
                        console.log("Name lookup error: " + err);
                    if (isHashZero(res)) {
                        http_res.status(404).end(JSON.stringify({"error": "name not registred"}));
                    } else {
                        http_res.end(JSON.stringify({"name": req.params.name,"addr": res}));
                    }
                } catch (err) {
                    console.log("Name lookup exception: " + err);
                    http_res.status(500).end(JSON.stringify({"error": "server error"}));
                }
            });
        } catch (err) {
            console.log("Name lookup exception: " + err);
            http_res.status(500).end(JSON.stringify({"error": "server error"}));
        }
    });

    // Register owner lookup handler
    app.get("/name/:name/owner", function(req, http_res) {
        http_res.setHeader('Content-Type', 'application/json');
        try {
            reg.owner(req.params.name, function(err, res) {
                try {
                    if (err)
                        console.log("Owner lookup error: " + err);
                    if (isHashZero(res)) {
                        http_res.status(404).end(JSON.stringify({"error": "name not registred"}));
                    } else {
                        http_res.end(JSON.stringify({"name": req.params.name,"owner": res}));
                    }
                } catch (err) {
                    console.log("Owner lookup exception: " + err);
                    http_res.status(500).end(JSON.stringify({"error": "server error"}));
                }
                //http_res.end(JSON.stringify({"name": req.params.name,"owner": res}));
            });
        } catch (err) {
            console.log("Owner lookup exception: " + err);
            http_res.status(500).end(JSON.stringify({"error": "server error"}));
        }
    });

    // Register address lookup handler
    app.get("/addr/:addr", function(req, http_res) {
        http_res.setHeader('Content-Type', 'application/json');
        try {
            var addr = formatAddress(req.params.addr);
            if (!addr) {
                console.log("Error parsing input address");
                http_res.status(400).end(JSON.stringify({"success": false}));
                return;
            }
            reg.name(addr, function(err, res) {
                try {
                    if (err)
                        console.log("Address lookup error: " + err);
                    var name = parseString(res);
                    if (name)
                        http_res.end(JSON.stringify({"name": name}));
                    else
                        http_res.status(404).end(JSON.stringify({"error": "address not registred"}));
                } catch (err) {
                    console.log("Address lookup exception: " + err);
                    http_res.status(500).end(JSON.stringify({"error": "server error"}));
                }
            });
        } catch (err) {
            console.log("Address lookup exception: " + err);
            http_res.status(500).end(JSON.stringify({"error": "server error"}));
        }
    });

    // Register name registration handler
    app.post("/name/:name", function(req, http_res) {
        http_res.setHeader('Content-Type', 'application/json');
        try {
            var addr = formatAddress(req.body.addr);
            if (!addr) {
                console.log("Error parsing input address");
                http_res.status(400).end(JSON.stringify({"success": false}));
                return;
            }
            try {
                req.body.owner = formatAddress(req.body.owner);
                if (!req.body.owner)
                    throw "no owner";
            } catch (err) {
                console.log("Error parsing input: " + err);
                http_res.status(400).end(JSON.stringify({"success": false, "error": err}));
                return;
            }
            if (!checkName(req.params.name)) {
                http_res.status(400).end(JSON.stringify({"success": false, "error": "invalid name"}));
                return;
            }
            console.log("Got reg request (" + req.params.name + " -> " + addr + ") from " + req.body.owner);

            reg.owner(req.params.name, function(err, owner) {
                if (owner == 0) {
                    console.log("Remaing gaz: " + getRemainingGaz());
                    unlockAccount();
                    reg.reserveFor.sendTransaction(req.params.name, req.body.owner, addr, {
                        from: coinbase,
                        gas: 3000000
                    }, function(terr, reg_c) {
                        if (terr) {
                            console.log("Transaction error " + JSON.stringify(terr));
                            http_res.end(JSON.stringify(terr));
                        } else {
                            console.log("Transaction sent " + reg_c);
                            web3.eth.awaitConsensus(reg_c, function(error) {
                                if (error) {
                                    console.log(error);
                                    http_res.status(403).end(JSON.stringify({"success": false}));
                                    return;
                                }
                                console.log("Ended registration for " + req.params.name + " -> " + addr);
                                reg.addr(req.params.name, function(err, reg_addr) {
                                    //console.log(reg_c + "Found address " + reg_addr);
                                    if (reg_addr != addr) {
                                        console.log(reg_c + "Address not matching");
                                        http_res.status(403).end(JSON.stringify({"success": false}));
                                    } else {
                                        reg.owner(req.params.name, function(err, reg_owner) {
                                            //console.log(reg_c + "Found owner " + reg_owner);
                                            if (reg_owner != req.body.owner) {
                                                console.log(reg_c + "Owner not matching: requested:" + req.body.owner + " actual:" + reg_owner);
                                                http_res.status(403).end(JSON.stringify({"success": false}));
                                            } else {
                                                http_res.end(JSON.stringify({"success": true}));
                                            }
                                        });
                                    }
                                });
                            });
                        }
                    });
                } else {
                    if (owner == req.body.owner) {
                        reg.addr(req.params.name, function(err, reg_addr) {
                            if (reg_addr == addr) {
                                http_res.end(JSON.stringify({"success": true}));
                            } else {
                                http_res.status(403).end(JSON.stringify({"success": false, "owner": owner, "addr": addr}));
                            }
                        });
                    } else {
                        http_res.status(403).end(JSON.stringify({"success": false, "owner": owner}));
                    }
                }
            });
        } catch (err) {
            console.log("Address registration exception: " + err);
            http_res.status(500).end(JSON.stringify({"error": "server error"}));
        }
    });
    http.createServer(app).listen(80);
}

unlockAccount();
loadContract();
