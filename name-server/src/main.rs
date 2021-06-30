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

#[macro_use]
extern crate clap;

use std::fs;
use std::sync::Arc;
use clap::App;
use env_logger;
use serde_json::json;
use std::collections::HashMap;
use warp::Filter;

mod eth;
mod ns;
mod utils;

type NameServer = Arc<ns::NameServer>;

async fn handle_get_name(name: String, ns: NameServer)
                         -> Result<warp::reply::WithStatus<warp::reply::Json>, warp::Rejection> {

    if let Some(name) = utils::check_name(name) {

        if let Some(addr) = ns.get_addr(&name).await {

            let response = json!({
                "name": name,
                "addr": addr
            });

            Ok(warp::reply::with_status(warp::reply::json(&response),
                                        warp::http::StatusCode::OK))

        } else {

            Ok(warp::reply::with_status(warp::reply::json(&json!({"error": "name not registred"})),
                                        warp::http::StatusCode::NOT_FOUND))
        }

    } else {

        Ok(warp::reply::with_status(warp::reply::json(&json!({"error": "bad name format"})),
                                    warp::http::StatusCode::NOT_FOUND))
    }
}

async fn handle_get_addr(addr: String, ns: NameServer) -> Result<warp::reply::WithStatus<warp::reply::Json>, warp::Rejection> {


    if let Some(addr) = utils::check_addr(addr) {

        if let Some(name) = ns.get_name(&addr).await {

            let response = json!({
                "name": name
            });

            Ok(warp::reply::with_status(warp::reply::json(&response),
                                        warp::http::StatusCode::OK))

        } else {

            let response = json!({
                "error": "address not registred"
            });

            Ok(warp::reply::with_status(warp::reply::json(&response),
                                        warp::http::StatusCode::NOT_FOUND))
        }
    } else {

        Ok(warp::reply::with_status(warp::reply::json(&json!({"error": "bad address format"})),
                                    warp::http::StatusCode::BAD_REQUEST))
    }
}

async fn handle_post_name(name: String, req: HashMap<String, String>, ns: NameServer)
                          -> Result<warp::reply::WithStatus<warp::reply::Json>, warp::Rejection> {

    let mut response = json!({"success": true});
    let mut status   = warp::http::StatusCode::BAD_REQUEST;

    match (req.get("owner"), req.get("addr")) {

        (Some(owner), Some(addr)) => {

            if let Some(addr) = utils::check_addr(addr.to_string()) {

                if !name.eq(owner) {
                    response = json!({"error": "mismatch between URI and field `owner`"});
                } else {

                    match ns.register(owner, &addr).await {
                        Ok(_)  => status = warp::http::StatusCode::OK,
                        Err(_) => {
                            response = json!({"name": name, "addr": addr, "success": false});
                            status = warp::http::StatusCode::FORBIDDEN;
                        }
                    }

                }
            } else {

                //reply_ok!({"error": "bad address format"}, BAD_REQUEST);

                response = json!({"error": "bad address format"});
                status = warp::http::StatusCode::BAD_REQUEST;
            }
        },
        (Some(_), None) => {
            response = json!({"error": "missing field `addr`",
                              "success": false});
        },
        (None, Some(_)) => {
            response = json!({"error": "missing field `owner`",
                              "success": false});
        }
        _ => {
            response = json!({"error": "missing fields [`owner`, `addr`]",
                              "success": false});
        }
    }

    Ok(warp::reply::with_status(warp::reply::json(&response),
                                status))
}

fn with_ns(ns: NameServer) -> impl Filter<Extract = (NameServer,), Error = std::convert::Infallible> + Clone {
    warp::any().map(move || ns.clone())
}

#[tokio::main]
async fn main() {

    env_logger::init();

    let yaml = load_yaml!("cli.yml");
    let matches = App::from_yaml(yaml).get_matches();

    use std::net::{SocketAddr};

    let tmp: serde_json::value::Value = serde_json::from_str(&fs::read_to_string(matches.value_of("COUNCIL-JSON").unwrap())
                                                             .expect("Failed to read JSON contract")).expect("Failed to parse JSON contract");

    let council_abi = serde_json::to_vec(&tmp
                                         .get("contracts")
                                         .expect("Missing `contracts` field")
                                         .get("council.sol:Council")
                                         .expect("Missing `council.sol:Council` field")
                                         .get("abi")
                                         .expect("Missing `abi` field")).expect("Failed to deserialize council abi");

    let council_addr: &str = matches.value_of("COUNCIL-ADDR").unwrap();

    let eth_addr = matches.value_of("eth-addr").unwrap();

    let eth = eth::Eth::new(eth_addr, &council_addr, &council_abi).await;

    let ns: NameServer = Arc::new(ns::NameServer::new(eth));

    let get_name = warp::get()
        .and(warp::path!("name" / String))
        .and(with_ns(ns.clone()))
        .and_then(handle_get_name);

    let get_addr = warp::get()
        .and(warp::path!("addr" / String))
        .and(with_ns(ns.clone()))
        .and_then(handle_get_addr);

    let post_name = warp::post()
        .and(warp::path!("name" / String))
        .and(warp::body::content_length_limit(4096 * 4))
        .and(warp::body::json())
        .and(with_ns(ns.clone()))
        .and_then(handle_post_name);

    let routes = get_name.or(get_addr).or(post_name);

    let addr: SocketAddr = matches.value_of("server-addr").unwrap().parse().expect("Invalid server address");

    warp::serve(routes)
        .run(addr)
        .await;
}

