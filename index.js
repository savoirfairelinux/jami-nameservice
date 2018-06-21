/*
 *  Copyright (c) 2016-2017 Savoir-faire Linux Inc.
 *
 *  Author: Adrien Béraud <adrien.beraud@savoirfairelinux.com>
 *
 *  This program is free software; you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation; either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with this program. If not, see <https://www.gnu.org/licenses/>.
 */
'use strict';

var express = require('express');
var bodyParser = require('body-parser');
var BigNumber = require('bignumber.js');
var fs = require('fs');
var http = require('http');
var https = require('https');
var Web3 = require('web3');
var web3 = new Web3();
var argv = require('minimist')(process.argv.slice(2));
var crypto = require('crypto');


Object.getPrototypeOf(web3.eth).awaitConsensus = function(txhash, mined_cb) {
    var ethP = this;
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

var REG_FILE = __dirname + "/contract/registrar.out.json";
var REG_ADDR_FILE = __dirname + "/contractAddress.txt";
var NAME_VALIDATOR = new RegExp('^[a-z0-9-_]{3,32}$');

var account;
var regAddress = "0xe53cb2ace8707526a5050bec7bcf979c57f8b44f";
var regData;
var regContract;
var reg;

function verifySignature(name, _publickey, signature){
    var publicKey = new Buffer(_publickey, 'base64').toString('ascii')
    var verifier = crypto.createVerify('RSA-SHA512');
    verifier.update(name);
    var ver = verifier.verify(publicKey, signature,'base64');
    return ver;
}

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

function loadContract(onContractLoaded) {
    fs.readFile(REG_ADDR_FILE, function(err, content) {
        if (err) {
            console.log("Can't read contract address: " + err);
        } else {
            regAddress = String(content).trim();
        }
        fs.readFile(REG_FILE, function(err, data){
            if (err) {
                console.log("Can't read contract ABI: " + err);
                throw err;
            }
            regData = JSON.parse(data).contracts.registrar.GlobalRegistrar;
            regContract = web3.eth.contract(regData.abi);
            console.log("Loading name contract from blockchain at " + regAddress);
            web3.eth.getCode(regAddress, function(error, result) {
                if (error)
                    console.log("Error getting contract code: " + error);
                if (!result || result == "0x") {
                    console.log("Contract not found at " + regAddress);
                    initContract(onContractLoaded);
                } else {
                    regContract.at(regAddress, function(err, result) {
                        console.log("Contract found and loaded from " + regAddress);
                        if(!err) {
                            reg = result;
                            onContractLoaded(reg)
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

function initContract(onContractInitialized) {
    waitForGaz(3000000, function(){
        regContract.new({ from: coinbase,
                          data: '0x'+regData.evm.bytecode.object,
                          gas: 3000000 }, function(e, contract) {
            if(!e) {
                if(!contract.address) {
                    console.log("Contract transaction send: TransactionHash: " + contract.transactionHash + " waiting to be mined...");
                } else {
                    console.log("Contract mined! Address: " + contract.address);
                    regAddress = contract.address;
                    fs.writeFileSync(REG_ADDR_FILE, regAddress);
                    reg = contract;
                    onContractInitialized();
                }
            } else {
                console.log(e);
            }
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

function formatName(name) {
    return '0x' + new Buffer(name, 'utf8').toString('hex');
}

function isHashZero(h) {
    return !h || h == "0x" || h == "0x0" || h == "0x0000000000000000000000000000000000000000";
}

function parseString(s) {
    return s ? web3.toUtf8(s) : s;
}

function formatAddress(address) {
    if (address) {
        var s = address.trim();
        try {
            if (s.startsWith("ring:"))
                s = s.substr(5);
            if (!s.startsWith("0x"))
                s = "0x" + s;
            if (new BigNumber(s.substr(2), 16) == 0)
                return undefined;
            return s;
        } catch (err) {}
    }
    return undefined;
}

function readCertificateChain(path) {
    var cert = [];
    var ca = [];
    fs.readFileSync(path, 'utf8').split("\n").forEach(function(line) {
        cert.push(line);
        if (line.match(/-END CERTIFICATE-/)) {
            ca.push(cert.join("\n"));
            cert = [];
        }
    });
    return ca;
}

function startServer(result) {
    console.log("Starting web server");
    var app = express();
    app.disable('x-powered-by');
    app.use(bodyParser.json());
    app.use(function(req, res, next) {
      res.setHeader('Content-Type', 'application/json');
      next();
    });

    // Register name lookup handler
    app.get("/name/:name", function(req, http_res) {
        try {
            reg.addr(formatName(req.params.name), function(err, res) {
                try {
                    if (err)
                        console.log("Name lookup error: " + err);
                    if (isHashZero(res)) {
                        http_res.status(404).end(JSON.stringify({"error": "name not registred"}));
                    } else {
                        http_res.end(JSON.stringify({"name": req.params.name, "addr": res }));
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

    app.get("/name/:name/publickey", function(req, http_res) {
        try {
            reg.publickey(formatName(req.params.name), function(err, res) {
                try {
                    if (err)
                        console.log("Name lookup error: " + err);
                    if (isHashZero(res)) {
                        http_res.status(404).end(JSON.stringify({"error": "name not registred"}));
                    } else {
                        http_res.end(JSON.stringify({"name": req.params.name, "publickey": res }));
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

    app.get("/name/:name/signature", function(req, http_res) {
        try {
            reg.signature(formatName(req.params.name), function(err, res) {
                try {
                    if (err)
                        console.log("Name lookup error: " + err);
                    if (isHashZero(res)) {
                        http_res.status(404).end(JSON.stringify({"error": "name not registred"}));
                    } else {
                        http_res.end(JSON.stringify({"name": req.params.name, "signature": res }));
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
        try {
            reg.owner(req.params.name, function(err, res) {
                try {
                    if (err)
                        console.log("Owner lookup error: " + err);
                    if (isHashZero(res)) {
                        http_res.status(404).end(JSON.stringify({"error": "name not registred"}));
                    } else {
                        http_res.end(JSON.stringify({"name": req.params.name, "owner": res}));
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
            if (!req.body.publickey || req.body.publickey == "") {
                http_res.status(400).end(JSON.stringify({"success": false, "error": "publickey not found or invalid"}));
                return;
            }
            if (!req.body.signature || req.body.signature == "") {
                http_res.status(400).end(JSON.stringify({"success": false, "error": "signature not found or invalid"}));
                return;
            }

            if(!verifySignature(req.params.name, req.body.publickey, req.body.signature)){
                http_res.status(401).end(JSON.stringify({"success": false, "error": "signature verification failed"}));
                return;
            }

            console.log("Got reg request (" + req.params.name + " -> " + addr + ") from " + req.body.owner);
            reg.owner(req.params.name, function(err, owner) {
                if (owner == 0) {
                    reg.name(addr, function(err, res) {
                        try {
                            if (err)
                                console.log("Error checking name: " + err);
                            var name = parseString(res);
                            if (name) {
                                console.log("Address " + addr + " already registered with name: " + name);
                                http_res.status(403).end(JSON.stringify({"success": false, "name": name, "addr": addr}));
                            } else {
                                console.log("Remaing gaz: " + getRemainingGaz());
                                unlockAccount();
                                reg.reserveFor.sendTransaction(formatName(req.params.name), req.body.owner, addr, req.body.publickey, req.body.signature, {
                                    from: coinbase,
                                    gas: 3000000
                                }, function(terr, reg_c) {
                                    if (terr) {
                                        console.log("Transaction error " + JSON.stringify(terr));
                                        http_res.end(JSON.stringify(terr));
                                    } else {
                                        console.log("Transaction sent " + reg_c);
                                        // Send answer as soon as the transaction is queued
                                        http_res.end(JSON.stringify({"success": true}));
                                        web3.eth.awaitConsensus(reg_c, function(error) {
                                            if (error) {
                                                console.log(error);
                                                return;
                                            }
                                            console.log("Ended registration for " + req.params.name + " -> " + addr);
                                        });
                                    }
                                });
                            }
                        } catch (err) {
                            console.log("Address registration exception: " + err);
                            http_res.status(500).end(JSON.stringify({"error": "server error"}));
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
    try {
        http.createServer(app).listen(80);
    } catch (err) {
        console.log("Error starting HTTP server: " + err);
    }
    if (argv.https) {
        try {
            var options = {
                key  : fs.readFileSync('/etc/ssl/private/star_ring_cx.key'),
                cert : fs.readFileSync('/etc/ssl/certs/cert_star_ring_cx.pem'),
                ca : readCertificateChain('/etc/ssl/certs/chain_star_ring_cx.pem')
            };
            https.createServer(options, app).listen(443);
        } catch (err) {
            console.log("Error starting HTTPS server: " + err);
        }
    }
}

unlockAccount();
loadContract(startServer);