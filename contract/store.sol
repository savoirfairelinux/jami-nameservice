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

contract Store {

        address immutable owner;
        address logic;

        mapping(bytes32 => bool)    bytes32_to_bool;
        mapping(bytes32 => int256)  bytes32_to_int256;
        mapping(bytes32 => uint256) bytes32_to_uint256;
        mapping(bytes32 => string)  bytes32_to_string;
        mapping(bytes32 => bytes)   bytes32_to_bytes;
        mapping(bytes32 => address) bytes32_to_address;
        mapping(bytes32 => bytes32) bytes32_to_bytes32;

        modifier if_owner() {
                require(msg.sender == owner,
                        "Only the owner have the right to access this function.");
                _;
        }

        modifier if_logic() {
                require(msg.sender == logic,
                        "Only the logic have the right to access this function.");
                _;
        }

        constructor(address owner_is, address logic_is) {
                owner = owner_is;
                logic = logic_is;
        }

        function set_logic(address new_logic) external if_owner {
                logic = new_logic;
        }

        function get_bool(bytes32 at) public view returns(bool) {
                return bytes32_to_bool[at];
        }

        function get_int256(bytes32 at) public view returns(int256) {
                return bytes32_to_int256[at];
        }

        function get_uint256(bytes32 at) public view returns(uint256) {
                return bytes32_to_uint256[at];
        }

        function get_string(bytes32 at) public view returns(string memory) {
                return bytes32_to_string[at];
        }

        function get_bytes(bytes32 at) public view returns(bytes memory) {
                return bytes32_to_bytes[at];
        }

        function get_address(bytes32 at) public view returns(address) {
                return bytes32_to_address[at];
        }

        function get_bytes32(bytes32 at) public view returns(bytes32) {
                return bytes32_to_bytes32[at];
        }

        function set_bool(bytes32 at, bool value) public if_logic {
                bytes32_to_bool[at] = value;
        }

        function set_int256(bytes32 at, int256 value) public if_logic {
                bytes32_to_int256[at] = value;
        }

        function set_uint256(bytes32 at, uint256 value) public if_logic {
                bytes32_to_uint256[at] = value;
        }

        function set_string(bytes32 at, string calldata value) public if_logic {
                bytes32_to_string[at] = value;
        }

        function set_bytes(bytes32 at, bytes calldata value) public if_logic {
                bytes32_to_bytes[at] = value;
        }

        function set_address(bytes32 at, address value) public if_logic {
                bytes32_to_address[at] = value;
        }

        function set_bytes32(bytes32 at, bytes32 value) public if_logic {
                bytes32_to_bytes32[at] = value;
        }
}
