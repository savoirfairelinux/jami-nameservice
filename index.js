#!/usr/bin/env node
var connect = require('connect');
var express = require('express');
var http = require('http');
var Web3 = require('web3');
var web3 = new Web3();
web3.setProvider(new web3.providers.HttpProvider('http://localhost:8545'));
//console.log(web3);
var coinbase = web3.eth.coinbase;
console.log(coinbase);
var balance = web3.eth.getBalance(coinbase);
console.log(balance.toString(10));

var REG_ADDR = "0xcd4f2482b34a7391fa6f39e01b5c6a4b2e97e69e";
var REG_ABI = [{"constant":true,"inputs":[{"name":"_owner","type":"address"}],"name":"name","outputs":[{"name":"o_name","type":"bytes32"}],"type":"function"},{"constant":true,"inputs":[{"name":"_name","type":"bytes32"}],"name":"owner","outputs":[{"name":"","type":"address"}],"type":"function"},{"constant":true,"inputs":[{"name":"_name","type":"bytes32"}],"name":"content","outputs":[{"name":"","type":"bytes32"}],"type":"function"},{"constant":true,"inputs":[{"name":"_name","type":"bytes32"}],"name":"addr","outputs":[{"name":"","type":"address"}],"type":"function"},{"constant":false,"inputs":[{"name":"_name","type":"bytes32"}],"name":"reserve","outputs":[],"type":"function"},{"constant":true,"inputs":[{"name":"_name","type":"bytes32"}],"name":"subRegistrar","outputs":[{"name":"o_subRegistrar","type":"address"}],"type":"function"},{"constant":false,"inputs":[{"name":"_name","type":"bytes32"},{"name":"_newOwner","type":"address"}],"name":"transfer","outputs":[],"type":"function"},{"constant":false,"inputs":[{"name":"_name","type":"bytes32"},{"name":"_registrar","type":"address"}],"name":"setSubRegistrar","outputs":[],"type":"function"},{"constant":false,"inputs":[],"name":"Registrar","outputs":[],"type":"function"},{"constant":false,"inputs":[{"name":"_name","type":"bytes32"},{"name":"_a","type":"address"},{"name":"_primary","type":"bool"}],"name":"setAddress","outputs":[],"type":"function"},{"constant":false,"inputs":[{"name":"_name","type":"bytes32"},{"name":"_content","type":"bytes32"}],"name":"setContent","outputs":[],"type":"function"},{"constant":false,"inputs":[{"name":"_name","type":"bytes32"}],"name":"disown","outputs":[],"type":"function"},{"constant":true,"inputs":[{"name":"_name","type":"bytes32"}],"name":"register","outputs":[{"name":"","type":"address"}],"type":"function"},{"anonymous":false,"inputs":[{"indexed":true,"name":"name","type":"bytes32"}],"name":"Changed","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"name","type":"bytes32"},{"indexed":true,"name":"addr","type":"address"}],"name":"PrimaryChanged","type":"event"}];

var reg = web3.eth.contract(REG_ABI).at(REG_ADDR);

var app = express();
app.get("/name/:name", function(req, res){
	var r = reg.addr(req.params.name)
	res.end(JSON.stringify({"addr": r }));
});

http.createServer(app).listen(3000);
