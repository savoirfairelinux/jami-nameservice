/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Copyright (c) 2021 Savoir-faire Linux Inc.
 *
 * Author: Olivier Dion <olivier.dion@savoirfairelinux.com>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * urnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

pragma solidity >= 0.8.4;

import "council.sol";
import "store.sol";

contract Logic {

        Store store;
        address owner;

        constructor(address council_at) {
                Council council = Council(council_at);
                store           = council.stores(0);
                owner           = council_at;
        }

        modifier if_owner() {
                require(msg.sender == owner);
                _;
        }

        function revoke_name(string calldata name) external if_owner {

                bytes32 name_key = string_to_bytes32(name);
                address addr     = store.get_address(name_key);

                /* Check that name is registered */
                require(address(0) != addr,
                        "Name not registered.");

                bytes32 addr_key = address_to_bytes32(addr);

                /* Commit */
                store.set_address(name_key, address(0));
                store.set_string(addr_key, "");
        }

        function string_to_bytes32(string memory str) private pure returns(bytes32) {
                return keccak256(bytes(str));
        }

        function address_to_bytes32(address addr) private pure returns(bytes32) {
                return bytes32(abi.encodePacked(addr));
        }

        function reserve_name_for_address(address addr, bytes32 challenge, string calldata name) external {

                /* Check that challenge is not zero */
                require(bytes32(0) != challenge,
                        "Can't have nonce equal to zero.");

                bytes32 key_name = string_to_bytes32(name);

                /* Check that the name is not already taken */
                require(address(0) == store.get_address(key_name),
                        "Name already taken!");

                bytes32 key_addr = address_to_bytes32(addr);

                /* Check that the address doesn't already have a name */
                require(0 == bytes(store.get_string(key_addr)).length,
                        "Address already has a name registered.");

                /* Commit */
                store.set_address(key_name, addr);
                store.set_string(key_addr, name);
                store.set_bytes32(key_addr, challenge);
        }

        function prune_name_for_address(address addr, bytes memory response_from_challenge) external {

                bytes32 key_addr = address_to_bytes32(addr);

                /* Check that address has a name */
                require(0 != bytes(store.get_string(key_addr)).length,
                        "No name at address.");

                /* Check if response of challenge is correct */
                require(store.get_bytes32(key_addr) == keccak256(response_from_challenge),
                        "Invalid response from challenge.");

                /* Commit */
                bytes32 key_name = string_to_bytes32(store.get_string(key_addr));

                store.set_address(key_name, address(0));
                store.set_string(key_addr, "");
        }

        /* Public  */

        function get_name_from_address(address addr) external view returns (string memory) {
                return store.get_string(address_to_bytes32(addr));
        }

        function get_address_from_name(string calldata name) external view returns (address addr) {
                return store.get_address(string_to_bytes32(name));
        }
}
