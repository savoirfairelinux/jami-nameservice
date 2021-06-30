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

use lru::LruCache;
use tokio::sync::Mutex;

use crate::eth::Eth;

pub struct NameServer {

    pub ns: Eth,

    addr_to_name: Mutex<LruCache<String, String>>,
    name_to_addr: Mutex<LruCache<String, String>>
}

impl NameServer {

    pub fn new(ns: Eth) -> Self {
        NameServer {
            ns: ns,
            addr_to_name: Mutex::new(LruCache::new(4096)),
            name_to_addr: Mutex::new(LruCache::new(4096))
        }
    }

    pub async fn get_addr(&self, name: &String) -> Option<String> {

        let mut cache = self.name_to_addr.lock().await;

        match cache.get(name) {

            None => {

                if let Some(addr) = self.ns.get_addr(name).await {
                    cache.put(name.clone(), addr.clone());
                    Some(addr)
                } else {
                    None
                }
            },
            Some(addr) => Some(addr.clone())
        }
    }

    pub async fn get_name(&self, addr: &String) -> Option<String> {

        let mut cache = self.addr_to_name.lock().await;

        match cache.get(addr) {

            None => {
                if let Some(name) = self.ns.get_name(&addr).await {
                    cache.put(addr.clone(), name.clone());
                    Some(name)
                } else {
                    None
                }
            },
            Some(name) => Some(name.clone())
        }
    }

    pub async fn register(&self, owner: &String, addr: &String) -> Result<(), ()> {

        let mut addr_cache = self.addr_to_name.lock().await;
        let name_cache = self.name_to_addr.lock();

        match addr_cache.get(addr) {
            Some(_) => Err(()),
            None => match self.ns.register(owner, addr).await {
                Ok(_) => {

                    addr_cache.put(addr.clone(), owner.clone());
                    drop(addr_cache);

                    name_cache.await.put(owner.clone(), addr.clone());
                    Ok(())
                }

                Err(_) => Err(())
            }
        }
    }
}
