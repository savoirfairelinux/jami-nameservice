var BigNumber = require('bignumber.js');
var fs = require('fs');
var Web3 = require('web3');
var web3 = new Web3();
var argv = require('minimist')(process.argv.slice(2));


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
                    initContract();
                } else {
                    regContract.at(regAddress, function(err, result) {
                        console.log("Contract found and loaded from " + regAddress);
                        if(!err) {
                            reg = result;
                            startWrites();
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
                    fs.writeFile(REG_ADDR_FILE, regAddress);
                    reg = contract;
                    startWrites();
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
function registerName(addressparam, nameparam, ownerparam){
    try {
        var addr = formatAddress(addressparam);
        if (!addr) {
            console.log("Error parsing input address");
            http_res.status(400).end(JSON.stringify({"success": false}));
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
            console.log("error: invalid name");
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
                            reg.reserveFor.sendTransaction(formatName(nameparam), ownerparam, addr, {
                                from: coinbase,
                                gas: 3000000
                            }, function(terr, reg_c) {
                                if (terr) {
                                    console.log("Transaction error " + JSON.stringify(terr));
                                    http_res.end(JSON.stringify(terr));
                                } else {
                                    console.log("Transaction sent " + reg_c);
                                    // Send answer as soon as the transaction is queued
                                    console.log("Success!")
                                    web3.eth.awaitConsensus(reg_c, function(error) {
                                        if (error) {
                                            console.log(error);
                                            return;
                                        }
                                        console.log("Ended registration for " + nameparam + " -> " + addr);
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
                        } else {
                            console.log("Error!");
                            return;
                        }
                    });
                } else {
                    console.log("Error!");
                    return;
                }
            }
        });
    } catch (err) {
        console.log("Address registration exception: " + err);
    }
}

function startWrites(){
    var NAME_LIST = JSON.parse(fs.readFileSync('names.json', 'utf8'));
    var NAME_LIST_LEN = NAME_LIST.length;
    console.log(String(NAME_LIST_LEN) + " inserts to do");
    NAME_LIST.map(function(obj, i){
        registerName(obj['addr'], obj['name'], obj['owner']);
        console.log("Inserted ("+String(i+1)+" of "+ String(NAME_LIST_LEN) +") : " 
            + JSON.stringify(obj));
    })
}


unlockAccount();
loadContract();