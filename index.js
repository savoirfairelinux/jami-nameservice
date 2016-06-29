#!/usr/bin/env node
var connect = require('connect');
var express = require('express');
var bodyParser = require('body-parser');
var BigNumber = require('bignumber.js');
var fs = require('fs');
var http = require('http');
var Web3 = require('web3');
var web3 = new Web3();
web3.setProvider(new web3.providers.HttpProvider('http://localhost:8545'));
var coinbase = web3.eth.coinbase;
console.log(coinbase);
var balance = web3.eth.getBalance(coinbase);
console.log(balance.toString(10));

var REG_ADDR = "0x1b364554e859d3277d3477ef6bf21113464e2392";
var REG_ABI = [{"constant":true,"inputs":[{"name":"_a","type":"address"}],"name":"name","outputs":[{"name":"o_name","type":"bytes32"}],"type":"function"},{"constant":true,"inputs":[{"name":"_name","type":"bytes32"}],"name":"owner","outputs":[{"name":"","type":"address"}],"type":"function"},{"constant":true,"inputs":[{"name":"_name","type":"bytes32"}],"name":"content","outputs":[{"name":"","type":"bytes32"}],"type":"function"},{"constant":true,"inputs":[{"name":"_name","type":"bytes32"}],"name":"addr","outputs":[{"name":"","type":"address"}],"type":"function"},{"constant":false,"inputs":[{"name":"_name","type":"bytes32"}],"name":"reserve","outputs":[],"type":"function"},{"constant":true,"inputs":[{"name":"_name","type":"bytes32"}],"name":"subRegistrar","outputs":[{"name":"o_subRegistrar","type":"address"}],"type":"function"},{"constant":false,"inputs":[{"name":"_name","type":"bytes32"},{"name":"_owner","type":"address"},{"name":"_a","type":"address"}],"name":"reserveFor","outputs":[],"type":"function"},{"constant":false,"inputs":[{"name":"_name","type":"bytes32"},{"name":"_newOwner","type":"address"}],"name":"transfer","outputs":[],"type":"function"},{"constant":false,"inputs":[{"name":"_name","type":"bytes32"},{"name":"_registrar","type":"address"}],"name":"setSubRegistrar","outputs":[],"type":"function"},{"constant":false,"inputs":[],"name":"Registrar","outputs":[],"type":"function"},{"constant":false,"inputs":[{"name":"_name","type":"bytes32"},{"name":"_a","type":"address"},{"name":"_primary","type":"bool"}],"name":"setAddress","outputs":[],"type":"function"},{"constant":false,"inputs":[{"name":"_name","type":"bytes32"},{"name":"_content","type":"bytes32"}],"name":"setContent","outputs":[],"type":"function"},{"constant":false,"inputs":[{"name":"_name","type":"bytes32"}],"name":"disown","outputs":[],"type":"function"},{"constant":true,"inputs":[{"name":"_name","type":"bytes32"}],"name":"register","outputs":[{"name":"","type":"address"}],"type":"function"},{"anonymous":false,"inputs":[{"indexed":true,"name":"name","type":"bytes32"}],"name":"Changed","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"name","type":"bytes32"},{"indexed":true,"name":"addr","type":"address"},{"indexed":false,"name":"owner","type":"address"}],"name":"PrimaryChanged","type":"event"}];

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
    console.log("Loading name contract from blockchain at " + REG_ADDR);
    web3.eth.getCode(REG_ADDR, function(error, result) {
        //console.log("Contract code at " + REG_ADDR + ": " + result);
        if (result == "0x") {
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
            console.log(REG_ABI);
            regContract = web3.eth.contract(REG_ABI);
            waitForGaz(3000000, function(){
                regContract.new({from: coinbase, data: compiled.GlobalRegistrar.code, gas: 3000000}, function(e, contract){
                    if(!e) {
                        if(!contract.address) {
                            console.log("Contract transaction send: TransactionHash: " + contract.transactionHash + " waiting to be mined...");
                        } else {
                            console.log("Contract mined! Address: " + contract.address);
                            REG_ADDR = contract.address;
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

function isHashZero(h) {
    return h == "0x" || h == "0x0000000000000000000000000000000000000000";
}

function parseString(s) {
    return new Buffer(s.substr(2, s.indexOf("000")-2), 'hex').toString();
}

function startServer() {
    console.log("Starting web server");
    var app = express();
    app.disable('x-powered-by');
    app.use(bodyParser.json());
    app.get("/name/:name", function(req, http_res) {
        reg.addr(req.params.name, function(err, res) {
            if (isHashZero(res)) {
                http_res.status(404).end(JSON.stringify({"error": "name not registred"}));
            } else {
                http_res.end(JSON.stringify({"name": req.params.name,"addr": res}));
            }
        });
    });
    app.get("/name/:name/owner", function(req, http_res) {
        reg.owner(req.params.name, function(err, res) {
            if (isHashZero(res)) {
                http_res.status(404).end(JSON.stringify({"error": "name not registred"}));
            } else {
                http_res.end(JSON.stringify({"name": req.params.name,"owner": res}));
            }
            //http_res.end(JSON.stringify({"name": req.params.name,"owner": res}));
        });
    });
    app.get("/addr/:addr", function(req, http_res) {
        if (!req.params.addr.startsWith("0x"))
            req.params.addr = "0x" + req.params.addr;
        reg.name(req.params.addr, function(err, res) {
            http_res.end(JSON.stringify({"name": parseString(res)}));
        });
    });
    app.post("/name/:name", function(req, http_res) {
        try {
            req.body.addr = new BigNumber(req.body.addr);
            req.body.owner = new BigNumber(req.body.owner);
        } catch (err) {
            console.log("Error parsing input: " + err);
            http_res.status(400).end(err);
            return;
        }
        if (!req.body.addr || !req.body.owner) {
            http_res.status(400).end(err);
            return;
        }
        console.log("Got reg request (" + req.params.name + " -> " + req.body.addr.toString(16) + ") from " + req.body.owner.toString(16));

        reg.owner(req.params.name, function(err, owner) {
            owner = new BigNumber(owner);
            if (owner == 0) {
                console.log("Remaing gaz: " + getRemainingGaz());
                unlockAccount();
                reg.reserveFor.sendTransaction(req.params.name, req.body.owner, req.body.addr, {
                    from: coinbase,
                    gas: 3000000
                }, function(terr, reg_c) {
                    if (terr) {
                        console.log("Transaction error " + JSON.stringify(terr));
                        http_res.end(JSON.stringify(terr));
                    } else {
                        console.log("Transaction sent " + reg_c);
                        reg.PrimaryChanged({"address": coinbase}, function(error, result) {
                            var name = parseString(result.args.name);
                            var addr = new BigNumber(result.args.addr);
                            var name_owner = new BigNumber(result.args.owner);
                            console.log("PrimaryChanged for " + name_owner.toString(16) + " : " + name + " -> " + addr.toString(16));
                            if (name != req.params.name || addr.toString(16) != req.body.addr.toString(16) || name_owner.toString(16) != req.body.owner.toString(16) || error) {
                                console.log(error);
                                http_res.status(403).end(JSON.stringify({"success": false}));
                            }
                            else {
                                console.log(result);
                                http_res.end(JSON.stringify({"success": true}));
                            }
                        });
                    }
                });
            } else {
                console.log(owner.toString(16) + " / " + req.body.owner.toString(16));
                if (owner.toString(16) == req.body.owner.toString(16)) {
                    reg.addr(req.params.name, function(err, addr) {
                        addr = new BigNumber(addr);
                        console.log(addr.toString(16) + " / " + req.body.addr.toString(16));
                        if (addr.toString(16) == req.body.addr.toString(16)) {
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
    });
    http.createServer(app).listen(3000);
}

unlockAccount();
loadContract();
