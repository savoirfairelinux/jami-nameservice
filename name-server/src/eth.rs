/*
 *  Copyright (C) 2004-2021 Savoir-faire Linux Inc.
 *
 *  Author: Olivier Dion <olivier.dion@savoirfairelinux.com>
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
 *  along with this program; if not, write to the Free Software
 *  Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301 USA.
 */

use log::{info, error};

use web3;
use web3::contract::{Contract, Options};
use web3::types::{Address, Bytes};

type Transport = web3::transports::Http;
pub type Name = [u8; 32];

pub struct Eth {
    web3:      web3::Web3<Transport>,
    coinbase: Address,
    logic: Contract<Transport>
}

impl Eth {

    pub async fn new(client_http_addr: &str, council_addr: &str, council_abi: &[u8]) -> Self {

        let transport = web3::transports::Http::new(client_http_addr).expect("Failed to setup web3 HTTP transport");
        let web3      = web3::Web3::new(transport);
        let coinbase  = web3.eth().coinbase().await.expect("Failed to get Ethereum coinbase");

        let addr = council_addr.parse().expect("Invalid contract's address");
        let contract_bytes = web3.eth().code(addr, None).await.expect("Failed to get code at contract's address");

        if contract_bytes.0.is_empty() {
            panic!("No code at address {}", addr);
        }

        info!("Found council");

        let council = Contract::from_json(web3.eth(), addr, council_abi).expect("Failed to create contract from JSON");

        let logic_addr: Address = council.query("get_logic", (), None, Options::default(), None).await.expect("Bad logic address");

        info!("Logic at address: {}", logic_addr);

        let logic_abi: Bytes = council.query("get_logic_abi", (), None, Options::default(), None).await.expect("Bad logic ABI");

        if 0 == logic_abi.0.len() {
            panic!("Empty logic ABI at address: {}", logic_addr);
        }

        let contract = Contract::from_json(web3.eth(), logic_addr, &logic_abi.0).expect("Failed to create contract from JSON");

        Eth {
            web3: web3,
            coinbase: coinbase,
            logic: contract
        }
    }

    pub async fn get_addr(&self, from_name: &String) -> Option<String> {

        let mut name: Name = Default::default();

        name[..from_name.len()].clone_from_slice(from_name.as_bytes());

        let result: Address = match self.logic.query("addr", name, None, Options::default(), None).await {
            Ok(result) => result,
            Err(err)   => {
                error!("Contract `addr`: {}", err);
                Default::default()
            }
        };

        match result.is_zero() {
            true  => None,
            false => Some(result.to_string())
        }
    }

    pub async fn get_name(&self, from_addr: &String) -> Option<String> {

        let addr: Address = match from_addr.parse() {
            Err(_) => {
                error!("Invalid address `{}` passed to Ethereum backend. This is a bug!", from_addr);
                return None;
            },
            Ok(addr) => addr
        };

        let result: Name = match self.logic.query("name", addr, None, Options::default(), None).await {
            Ok(result) => result,
            Err(err)   => {
                error!("Contract `name`: {}", err);
                Default::default()
            }
        };

        match result == Name::default() {
            true  => None,
            false => Some(String::from_utf8(result.to_vec()).unwrap())
        }
    }

    pub async fn register(&self, owner: &String, to_addr: &String) -> Result<u64, String> {

        let addr: Address = match to_addr.parse() {
            Err(err) => {
                error!("Invalid address `{}` passed to Ethereum backend: {}. This is a bug!", to_addr, err);
                return Err(String::from("Bad address"));
            },
            Ok(addr) => addr
        };

        let mut name: Name = Default::default();

        name[..owner.len()].clone_from_slice(owner.as_bytes());

        match self.logic.call_with_confirmations("register",
                                                 (name, addr),
                                                 self.coinbase,
                                                 Options::default(), 0).await {
            Ok(result) => Ok(result.status.unwrap().0[0]),
            Err(err)   => Err(err.to_string())
        }
    }
}
