#!/usr/bin/env nodejs
/*
 *  Copyright (c) 2016-2020 Savoir-faire Linux Inc.
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
var async = require("async");
var BigNumber = require('bignumber.js');
var fs = require('fs');
var Web3 = require('web3');
var web3 = new Web3();
var path = require('path');
var fs = require('fs');
var argv = require('minimist')(process.argv.slice(2));

if(argv['_'] < 1)
    throw ("Specify Batch Input File as: nodejs " + path.basename(__filename) + " <filename>" );

function validateFile(filename){
    if ( path.isAbsolute(filename) && fs.existsSync(filename) )
        return filename
    else if ( !path.isAbsolute(filename) && fs.existsSync("./" +filename))
        return path.resolve(filename)
    return false
}
var providedPath = String(argv['_'][0])
batchInputFile = validateFile(providedPath);
if(!batchInputFile)
    throw "File " + providedPath + " does not exist"


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
console.log("Coinbase: "+ coinbase);
var balance = web3.eth.getBalance(coinbase);
console.log("Balance:" +balance.toString(10));

var REG_FILE = __dirname + "/contract/registrar.out.json";
var REG_ADDR_FILE = __dirname + "/contractAddress.txt";
var NAME_VALIDATOR = new RegExp('^[a-z0-9-_]{3,32}$');

var account;
var regAddress = "0xe53cb2ace8707526a5050bec7bcf979c57f8b44f";
var regData;
var regContract;
var reg;

function unlockAccount() {
    web3.personal.unlockAccount(coinbase, "toto");
}

function getRemainingGaz() {
    return web3.eth.getBalance(coinbase) / web3.eth.gasPrice;
}


function loadContract(onContractLoaded) {
    fs.readFile(REG_ADDR_FILE, function(err, content) {
        if (err) {
            throw "Contract Address issues, run server to initialize contract address first time";
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
                    throw "Contract Address issues, run server to initialize contract address"
                } else {
                    regContract.at(regAddress, function(err, result) {
                        console.log("Contract found and loaded from " + regAddress);
                        if(!err) {
                            reg = result;
                            onContractLoaded();
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
function registerName(addressparam, nameparam, ownerparam, pk, sig, mined_cb){
    try {
        var addr = formatAddress(addressparam);
        if (!addr) {
            console.log("Error parsing input address "+ addressparam);
            return;
        }
        try {
            ownerparam = formatAddress(ownerparam);
            if (!ownerparam)
                throw "no owner";
        } catch (err) {
            console.log("Error parsing input: " + err);
            return;
        }
        if (!checkName(nameparam)) {
            console.log("error: invalid name "+ nameparam);
            return;
        }
        console.log("Got reg request (" + nameparam + " -> " + addr + ") from " + ownerparam);

        reg.owner(nameparam, function(err, owner) {
            if (owner == 0) {
                reg.name(addr, function(err, res) {
                    try {
                        if (err)
                            console.log("Error checking name: " + err);
                        var name = parseString(res);
                        if (name) {
                            console.log("Address " + addr + " already registered with name: " + name);
                            return;
                        } else {
                            console.log("Remaing gaz: " + getRemainingGaz());
                            unlockAccount();
                            reg.reserveFor.sendTransaction(formatName(nameparam), ownerparam, addr, pk, sig, {
                                from: coinbase,
                                gas: 3000000
                            }, function(terr, reg_c) {
                                if (terr) {
                                    console.log("Transaction error " + JSON.stringify(terr));
                                } else {
                                    console.log("Transaction sent " + reg_c);
                                    // Send answer as soon as the transaction is queued
                                    console.log("Success!")
                                    web3.eth.awaitConsensus(reg_c, function(error) {
                                        mined_cb(reg_c)
                                        if (error) {
                                            console.log(error);
                                            return;
                                        }
                                    });
                                }
                            });
                        }
                    } catch (err) {
                        console.log("Address registration exception: " + err);
                    }
                });
            } else {
                if (owner == ownerparam) {
                    reg.addr(nameparam, function(err, reg_addr) {
                        if (reg_addr == addr) {
                            console.log("Success!");
                            return;
                        } else {
                            console.log("Error!" + err);
                            return;
                        }
                    });
                } else {
                    console.log("Error!");;
                    console.log("Owner "+ owner);
                    console.log("Ownerparam "+ ownerparam);
                    return;
                }
            }
        });
    } catch (err) {
        console.log("Address registration exception: " + err);
    }
}
function startWrites(){
    var NAME_LIST = JSON.parse(fs.readFileSync(batchInputFile, 'utf8'));
    console.log(String(NAME_LIST.length) + " inserts to do");
    //create parallel queue that does 256 registerNames parallely
    var q = async.queue(function(task, callback) {
        registerName(task['addr'], task['name'], task['owner'], task['publickey'], task['signature'], callback);
    }, 256);

    for (var i = 0; i < NAME_LIST.length; i++) {
        q.push(NAME_LIST[i], function(c){console.log("Mined registry: "+ c)});
        console.log("Queued " + i);
    }
}


unlockAccount();
loadContract(startWrites);