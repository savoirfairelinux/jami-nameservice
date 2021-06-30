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

/*
 * This contract keep in its storage the address and ABI of another contract.
 * The owner of the contract is the only one that has write access.  Anyone has
 * read access.
 */
contract Proxy {

        address addr_;
        bytes   ABI_;

        address owner_;

        constructor() {
                owner_ = msg.sender;
        }

        function set(address addr, bytes memory ABI) public {

                require(msg.sender == owner_, "Only the owner have write access.");

                addr_ = addr;
                ABI_  = ABI;
        }

        function get() public view returns (address, bytes memory) {

                return (addr_, ABI_);
        }
}
