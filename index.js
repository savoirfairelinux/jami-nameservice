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

const express = require('express');
const bodyParser = require('body-parser');
const BigNumber = require('bignumber.js');
const fs = require('fs');
const http = require('http');
const https = require('https');
const Web3 = require('web3');
const web3 = new Web3();
const argv = require('minimist')(process.argv.slice(2));
const crypto = require('crypto');
const path = require('path');

//Patch to support caching.
//map of form {name,address}
const cache = {};

function validateFile(filename){
    if ( path.isAbsolute(filename) && fs.existsSync(filename) )
        return filename
    else if ( !path.isAbsolute(filename) && fs.existsSync("./" +filename))
        return path.resolve(filename)
    return false
}

function loadCache(batchInputFile) {
    const NAME_LIST = JSON.parse(fs.readFileSync(batchInputFile, 'utf8'));
    for (const entry of Object.entries(NAME_LIST)) {
        cache[entry[0]] = entry[1]
    }
}



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
const coinbase = web3.eth.coinbase;
console.log(coinbase);
let balance = web3.eth.getBalance(coinbase);
console.log(balance.toString(10));

const REG_FILE = __dirname + "/contract/registrar.out.json";
const REG_ADDR_FILE = __dirname + "/contractAddress.txt";
const NAME_VALIDATOR = new RegExp('^[a-z0-9-_]{3,32}$');

let account;
let regAddress = "0xe53cb2ace8707526a5050bec7bcf979c57f8b44f";
let regData;
let regContract;
let reg;


function loadNames(filename){
    console.log("The cache will be populated with the data from the export file!");
    const providedPath = String(argv['_'][0]);
    const batchInputFile = validateFile(providedPath);
    if(!batchInputFile){
        throw "File " + providedPath + " does not exist";
    }
    else{
        loadCache(batchInputFile);
    }
}


function verifySignature(name, _publickey, signature){
    const publicKey = new Buffer(_publickey, 'base64').toString('ascii')
    const verifier = crypto.createVerify('RSA-SHA512');
    verifier.update(name);
    const ver = verifier.verify(publicKey, signature,'base64');
    return ver;
}

function unlockAccount() {
    web3.personal.unlockAccount(coinbase, "apple123");
}

function getRemainingGaz() {
    return web3.eth.getBalance(coinbase) / web3.eth.gasPrice;
}

function waitForGaz(want, cb) {
    if (getRemainingGaz() >= want) {
        cb();
        return;
    }
    const timeout = () => {
        const g = getRemainingGaz();
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
    fs.readFile(REG_ADDR_FILE, (err, content) => {
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
        let s = address.trim();
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
    let cert = [];
    const ca = [];
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
    const app = express();
    app.disable('x-powered-by');
    app.use(bodyParser.json());
    app.use(function(req, res, next) {
      res.setHeader('Content-Type', 'application/json');
      next();
    });

    // Register name lookup handler
    app.get("/name/:name", function(req, http_res) {
        try {
            reg.addr(formatName(req.params.name), function(err, res_addr) {
                try {
                    if (err)
                        console.log("Name lookup error: " + err);
                    if (isHashZero(res_addr)) {
                        throw Error("name not registered");
                        //http_res.status(404).end(JSON.stringify({"error": "name not registered"}));
                    } else {
                        reg.publickey(formatName(req.params.name), function(err, res_publickey) {
                            try {
                                if (err)
                                    console.log("Name lookup error: " + err);
                                if (isHashZero(res_publickey)) {
                                    http_res.end(JSON.stringify({"name": req.params.name, "addr": res_addr}));
                                } else {
                                    reg.signature(formatName(req.params.name), function(err, res_signature) {
                                        try {
                                            if (err)
                                                console.log("Name lookup error: " + err);
                                            if (isHashZero(res_signature)) {
                                                http_res.end(JSON.stringify({"name": req.params.name, "addr": res_addr}));
                                            } else {
                                                http_res.end(JSON.stringify({"name": req.params.name, "addr": res_addr, "publickey": res_publickey, "signature": res_signature }));
                                            }
                                        } catch (err) {
                                            console.log("Name lookup exception: " + err);
                                            http_res.status(500).end(JSON.stringify({"error": "server error"}));
                                        }
                                    });
                                }
                            } catch (err) {
                                console.log("Name lookup exception: " + err);
                                http_res.status(500).end(JSON.stringify({"error": "server error"}));
                            }
                        });
                    }
                } catch (err) {
                    if(cache[req.params.name] != undefined){
                            if(cache[req.params.name]['publickey'] && cache[req.params.name]['signature']){
                                http_res.end(JSON.stringify({"name": req.params.name, "addr": cache[req.params.name]['addr'], "publickey": cache[req.params.name]['publickey'], "signature": cache[req.params.name]['signature']}));
                            }
                            else{
                                http_res.end(JSON.stringify({"name": req.params.name, "addr": cache[req.params.name]['addr']}));
                            }
                    }
                    else{
                        http_res.status(404).end(JSON.stringify({"error": "name not registered"}));    
                    }
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
                        http_res.status(404).end(JSON.stringify({"error": "name not registered"}));
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
                        http_res.status(404).end(JSON.stringify({"error": "name not registered"}));
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
                        http_res.status(404).end(JSON.stringify({"error": "name not registered"}));
                    } else {
                        http_res.end(JSON.stringify({"name": req.params.name, "owner": res}));
                    }
                } catch (err) {
                    console.log("Owner lookup exception: " + err);
                    http_res.status(500).end(JSON.stringify({"error": "server error"}));
                }
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
                        http_res.status(404).end(JSON.stringify({"error": "address not registered"}));
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
            if(cache[req.params.name] == undefined){
                http_res.status(400).end(JSON.stringify({"success":false,"error": "name already registered"}));
                return;
            }
            //Temporarily commented out for testing purposes.
            //Backward compatibility patch to allow registrations without public keys:
            let publickey;
            let signature;
            if(!req.body.publickey && !req.body.signature){
                publickey = 0;
                signature = 0;
            }
            else{
                if (!req.body.publickey || req.body.publickey == "") {
                    http_res.status(400).end(JSON.stringify({"success": false, "error": "publickey not found or invalid"}));
                    return;
                }
                if (!req.body.signature || req.body.signature == "") {
                    http_res.status(400).end(JSON.stringify({"success": false, "error": "signature not found or invalid"}));
                }
                if(!verifySignature(req.params.name, req.body.publickey, req.body.signature)){
                    http_res.status(401).end(JSON.stringify({"success": false, "error": "signature verification failed"}));
                    return;
                }
                else{
                    publickey = req.body.publickey;
                    signature = req.body.signature;
                }
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
                                reg.reserveFor.sendTransaction(formatName(req.params.name), req.body.owner, addr, publickey, signature, {
                                    from: coinbase,
                                    gas: 3000000
                                }, function(terr, reg_c) {
                                    if (terr) {
                                        console.log("Transaction error " + JSON.stringify(terr));
                                        http_res.end(JSON.stringify(terr));
                                    } else {
                                        //Add the registration into the cache.
                                        cache[req.params.name] = {
                                            addr,
                                            publickey,
                                            signature
                                        };
                                        //Now we continue with the sending of the transactions.
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

if(argv['_'] != 0){
    loadNames(argv['_']);  
}
unlockAccount();
loadContract(startServer);
