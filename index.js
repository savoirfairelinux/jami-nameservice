#!/usr/bin/env node
var connect = require('connect');
var express = require('express');
var bodyParser = require('body-parser');

var fs = require('fs');
var http = require('http');
var Web3 = require('web3');
var web3 = new Web3();
web3.setProvider(new web3.providers.HttpProvider('http://localhost:8545'));
var coinbase = web3.eth.coinbase;
console.log(coinbase);
var balance = web3.eth.getBalance(coinbase);
console.log(balance.toString(10));

var REG_ADDR = "0xa2c1a3c75249c89dfc32169d707744fd3648823d";
var REG_ABI = [{"constant":true,"inputs":[{"name":"_owner","type":"address"}],"name":"name","outputs":[{"name":"o_name","type":"bytes32"}],"type":"function"},{"constant":true,"inputs":[{"name":"_name","type":"bytes32"}],"name":"owner","outputs":[{"name":"","type":"address"}],"type":"function"},{"constant":true,"inputs":[{"name":"_name","type":"bytes32"}],"name":"content","outputs":[{"name":"","type":"bytes32"}],"type":"function"},{"constant":true,"inputs":[{"name":"_name","type":"bytes32"}],"name":"addr","outputs":[{"name":"","type":"address"}],"type":"function"},{"constant":false,"inputs":[{"name":"_name","type":"bytes32"}],"name":"reserve","outputs":[],"type":"function"},{"constant":true,"inputs":[{"name":"_name","type":"bytes32"}],"name":"subRegistrar","outputs":[{"name":"o_subRegistrar","type":"address"}],"type":"function"},{"constant":false,"inputs":[{"name":"_name","type":"bytes32"},{"name":"_owner","type":"address"},{"name":"_a","type":"address"}],"name":"reserveFor","outputs":[],"type":"function"},{"constant":false,"inputs":[{"name":"_name","type":"bytes32"},{"name":"_newOwner","type":"address"}],"name":"transfer","outputs":[],"type":"function"},{"constant":false,"inputs":[{"name":"_name","type":"bytes32"},{"name":"_registrar","type":"address"}],"name":"setSubRegistrar","outputs":[],"type":"function"},{"constant":false,"inputs":[],"name":"Registrar","outputs":[],"type":"function"},{"constant":false,"inputs":[{"name":"_name","type":"bytes32"},{"name":"_a","type":"address"},{"name":"_primary","type":"bool"}],"name":"setAddress","outputs":[],"type":"function"},{"constant":false,"inputs":[{"name":"_name","type":"bytes32"},{"name":"_content","type":"bytes32"}],"name":"setContent","outputs":[],"type":"function"},{"constant":false,"inputs":[{"name":"_name","type":"bytes32"}],"name":"disown","outputs":[],"type":"function"},{"constant":true,"inputs":[{"name":"_name","type":"bytes32"}],"name":"register","outputs":[{"name":"","type":"address"}],"type":"function"},{"anonymous":false,"inputs":[{"indexed":true,"name":"name","type":"bytes32"}],"name":"Changed","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"name","type":"bytes32"},{"indexed":true,"name":"addr","type":"address"}],"name":"PrimaryChanged","type":"event"}];

var account;
var regContract;
var reg;

function unlockAccount() {
    //account = web3.eth.accounts[0];
    web3.personal.unlockAccount(coinbase, "toto");
    //loadContract();
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
            console.error("Mining finished ! Now having " + g + " gaz.");
            cb();
        } else {
            console.error("Waiting for " + (want - g) + " gaz to be mined...");
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

function startServer() {
    console.log("Starting web server");
    var app = express();
    app.disable('x-powered-by');
    app.use(bodyParser.json());
    app.get("/name/:name", function(req, http_res) {
        reg.addr(req.params.name, function(err, res) {
            http_res.end(JSON.stringify({"addr": res}));
        });
    });
    app.get("/owner/:name", function(req, http_res) {
        reg.owner(req.params.name, function(err, res) {
            http_res.end(JSON.stringify({"owner": res}));
        });
    });
    app.post("/name/:name", function(req, http_res) {
        if (!req.body.addr || !req.body.owner) {
            http_res.status(400).end();
            return;
        }
        console.log("Got reg request (" + req.params.name + " -> " + req.body.addr + ") from " + req.body.owner);        
        reg.addr(req.params.name, function(err, res) {
            if (res == "0x" || res == "0x0000000000000000000000000000000000000000") {
                console.log("Remaing gaz: " + getRemainingGaz());
                unlockAccount();
                reg.reserveFor.sendTransaction(req.params.name, req.body.owner, req.body.addr, {
                    from: coinbase,
                    gas: 3000000
                }, function(terr, reg_c) {
                    if (terr) {
                        http_res.end(JSON.stringify(terr));
                    } else {
                        http_res.end(JSON.stringify({"success": true}));
                    }
                });
            } else {
                http_res.status(403).end();
            }
        });
    });
    http.createServer(app).listen(3000);
}

unlockAccount();
loadContract();
