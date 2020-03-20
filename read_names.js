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
const fs = require('fs');
const Web3 = require('web3');

const web3 = new Web3();
web3.setProvider(new web3.providers.HttpProvider('http://localhost:8545'));

const REG_ADDR_FILE = "contractAddress.txt";
const REG_ABI_reserveFor = ['bytes32', 'address', 'address', 'string', 'string'];
let REG_ADDR = "0xe53cb2ace8707526a5050bec7bcf979c57f8b44f";

function readContractAddress() {
    fs.readFile(REG_ADDR_FILE, function(err, content) {
        if (err) {
            console.log("Can't read contract address: " + err);
        } else {
            REG_ADDR = String(content).trim().toLowerCase();
        }
        web3.eth.getBlockNumber((err, content) => getAllNames(content));
    });
}

function getAllNames(totalBlocks) {
    let nextBlock = 0;
    let rem = totalBlocks;
    fs.unlinkSync('names.json');
    const outFd = fs.openSync('names.json', 'a');
    fs.write(outFd, '[\n', e => { if (e) console.log(e) });

    const cb = function(error, block) {
        rem--;
        if (error) {
            console.log("Can't get block: " + error);
        } else {
            const transactionNum = block.transactions.length;
            for (let t=0; t<transactionNum; t++) {
                try {
                    const tr = block.transactions[t];
                    if (tr.to && tr.to.toLowerCase() == REG_ADDR) {
                        const p = web3.eth.abi.decodeParameters(REG_ABI_reserveFor, tr.input.substr(10));
                        const n = web3.utils.hexToUtf8(p[0]);
                        console.log("Entry: " + n + " -> " + p[1] + " " + p[2]);
                        const newObj = {"name": n,"addr":p[2], "owner":p[1]};
                        if (p[3])
                            newObj["publickey"] = p[3];
                        if (p[4])
                            newObj["signature"] = p[4];
                        fs.write(outFd, JSON.stringify(newObj) + ',\n', e => { if (e) console.log(e) });
                    } else {
                        console.log("Wrong contract: " + tr.to + " expected " + REG_ADDR);
                    }
                } catch (err) {
                    console.log("Error reading transaction: " + err);
                }
            }
        }
        if (nextBlock < totalBlocks)
            web3.eth.getBlock(nextBlock++, true, cb);
        if (rem == 0) {
            console.log("Found " + NAME_LIST.length + " name mappings");
            fs.write(outFd, ']', e => { if (e) console.log(e) });
            fs.close(outFd, () => {});
        } else if (!error && block && block.transactions.length) {
            console.log("Listing names: " + Math.round(100-100*rem/totalBlocks) + "%, " + rem + " remaining... ");
        }
    };
    console.log("Starting... total blocks: " + totalBlocks);

    // 256 concurrent requests
    for (; nextBlock < totalBlocks && nextBlock < 256; nextBlock++)
        web3.eth.getBlock(nextBlock, true, cb);
}

readContractAddress();
