#!/usr/bin/env nodejs
var BigNumber = require('bignumber.js');
var fs = require('fs');
var Web3 = require('web3');

var web3 = new Web3();
web3.SolidityCoder = require('web3/lib/solidity/coder');

web3.setProvider(new web3.providers.HttpProvider('http://localhost:8545'));

var REG_ADDR_FILE = "contractAddress.txt";
var REG_ADDR = "0xe53cb2ace8707526a5050bec7bcf979c57f8b44f";
var REG_ABI_registerFor = ['bytes32', 'address', 'address'];
var NAME_MAP = {};

function loadContract() {
    fs.readFile(REG_ADDR_FILE, function(err, content) {
        if (err) {
            console.log("Can't read contract address: " + err);
            return;
        } else {
            REG_ADDR = String(content);
        }
        getAllNames();
    });
}

function getAllNames() {
    var totalBlocks = web3.eth.blockNumber;
    var nextBlock = 0;
    var rem = totalBlocks;
    var cb = function(error, block) {
        rem--;
        if (error) {
            console.log("Can't get block: " + error);
        } else {
            var transactionNum = block.transactions.length;
            for (var t=0; t<transactionNum; t++) {
                try {
                    var tr = block.transactions[t];
                    if (tr.to == REG_ADDR) {
                        var input = tr.input.substr(10);
                        var p = web3.SolidityCoder.decodeParams(REG_ABI_registerFor, input);
                        var n = web3.toUtf8(p[0]);
                        console.log("Entry: " + n + " -> " + p[1] + " " + p[2]);
                        NAME_MAP[n] = {"addr":p[2], "owner":p[1]};
                    } else {
                        console.log("Wrong contract: " + tr.to + " expected " + REG_ADDR);
                    }
                } catch (err) {
                    console.log("Error reading transaction: " + err);
                }
            }
            if (nextBlock < totalBlocks)
                web3.eth.getBlock(nextBlock++, true, cb);
        }
        if (rem == 0) {
            console.log("Found " + Object.keys(NAME_MAP).length + " name mappings");
            fs.writeFile("names.json", JSON.stringify(NAME_MAP));
        } else {
            console.log("Listing names: " + Math.round(100-100*rem/totalBlocks) + "%, " + rem + " remaining... ");
        }
    };
    // 256 concurrent requests
    for (; nextBlock < totalBlocks && nextBlock < 256; nextBlock++)
        web3.eth.getBlock(nextBlock, true, cb);
}

loadContract();
